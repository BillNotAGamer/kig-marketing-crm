import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { user, session, auditLog } from "../src/db/schema";
import { administrationLock } from "../src/lib/users/service";

async function main() {
  const dbEnv = process.env.KIG_DATABASE_ENV;
  const allowPromotion = process.env.KIG_ALLOW_PRODUCTION_ADMIN_PROMOTION;

  if (dbEnv === "production" && allowPromotion !== "true") {
    console.error(
      "Refusing execution: Production admin promotion requires transient KIG_ALLOW_PRODUCTION_ADMIN_PROMOTION=true",
    );
    process.exit(1);
  }

  let targetEmail = process.env.KIG_FIRST_ADMIN_EMAIL?.trim();

  if (!targetEmail) {
    if (process.stdin.isTTY) {
      const rl = readline.createInterface({ input, output });
      try {
        const answer = await rl.question(
          "Enter email address of existing active HEAD to promote to ADMIN: ",
        );
        targetEmail = answer.trim();
      } finally {
        rl.close();
      }
    } else {
      console.error(
        "Refusing execution: Target email not provided. Set KIG_FIRST_ADMIN_EMAIL environment variable.",
      );
      process.exit(1);
    }
  }

  if (!targetEmail) {
    console.error("Refusing execution: Target email is empty.");
    process.exit(1);
  }

  const db = getDb();

  console.log("Starting first ADMIN promotion transaction...");

  await db.transaction(async (tx) => {
    // 1. Acquire advisory lock
    await tx.execute(administrationLock);

    // 2. Query fresh active ADMIN count - require 0
    const [adminCountRow] = await tx
      .select({ count: count() })
      .from(user)
      .where(and(eq(user.role, "ADMIN"), eq(user.banned, false)));

    const activeAdmins = Number(adminCountRow?.count ?? 0);
    if (activeAdmins > 0) {
      throw new Error(
        `Active ADMIN already exists (count: ${activeAdmins}). Promotion tool refuses execution once an ADMIN exists.`,
      );
    }

    // 3. Resolve target user
    const [target] = await tx
      .select()
      .from(user)
      .where(eq(user.email, targetEmail.toLowerCase()));

    if (!target) {
      throw new Error("Target user not found.");
    }

    if (target.banned) {
      throw new Error("Target user is inactive/banned. Refusing promotion.");
    }

    if (target.role !== "HEAD") {
      throw new Error(
        `Target user has role '${target.role}'. Promotion is restricted to active HEAD accounts only.`,
      );
    }

    // 4. Summaries for audit
    const beforeData = {
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      banned: target.banned,
      createdAt: target.createdAt.toISOString(),
    };
    const afterData = {
      ...beforeData,
      role: "ADMIN",
    };

    // 5. Atomically update role to ADMIN
    await tx
      .update(user)
      .set({
        role: "ADMIN",
        updatedAt: new Date(),
      })
      .where(eq(user.id, target.id));

    // 6. Insert CHANGE_ROLE audit log
    await tx.insert(auditLog).values({
      actorUserId: target.id,
      action: "CHANGE_ROLE",
      entityType: "user",
      entityId: target.id,
      beforeData,
      afterData,
    });

    // 7. Revoke all target sessions
    await tx.delete(session).where(eq(session.userId, target.id));

    console.log("Promotion updated in transaction. Ready to commit.");
  });

  // 8. Post-commit verification
  const [postAdminRow] = await db
    .select({ count: count() })
    .from(user)
    .where(and(eq(user.role, "ADMIN"), eq(user.banned, false)));

  const postActiveAdmins = Number(postAdminRow?.count ?? 0);
  if (postActiveAdmins !== 1) {
    console.error(
      `CRITICAL: Post-promotion verification failed. Expected active ADMIN count = 1, found ${postActiveAdmins}`,
    );
    process.exit(1);
  }

  console.log(
    "Promotion successful! Exactly 1 active ADMIN is now configured.",
  );
  console.log("Target user must re-authenticate to receive new ADMIN session.");
}

main().catch((err) => {
  console.error("Promotion failed:", err.message);
  process.exit(1);
});
