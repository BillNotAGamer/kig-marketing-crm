import { and, count, eq } from "drizzle-orm";
import { user, session, auditLog } from "../../src/db/schema";
import { administrationLock } from "../../src/lib/users/locks";
import type { ScriptDatabase } from "./database";

export interface PromotionCheckResult {
  totalUsers: number;
  activeAdmins: number;
  activeHeads: number;
  activeDeputies: number;
  activeEmployees: number;
  bannedUsers: number;
  isReady: boolean;
  targetUser?: {
    id: string;
    role: string;
    banned: boolean;
    isEligible: boolean;
  } | null;
}

export async function checkPromotionReadiness(
  db: ScriptDatabase,
  targetEmail?: string,
): Promise<PromotionCheckResult> {
  const [totalUserRow] = await db.select({ count: count() }).from(user);
  const totalUsers = Number(totalUserRow?.count ?? 0);

  const [adminCountRow] = await db
    .select({ count: count() })
    .from(user)
    .where(and(eq(user.role, "ADMIN"), eq(user.banned, false)));
  const activeAdmins = Number(adminCountRow?.count ?? 0);

  const [headCountRow] = await db
    .select({ count: count() })
    .from(user)
    .where(and(eq(user.role, "HEAD"), eq(user.banned, false)));
  const activeHeads = Number(headCountRow?.count ?? 0);

  const [deputyCountRow] = await db
    .select({ count: count() })
    .from(user)
    .where(and(eq(user.role, "DEPUTY"), eq(user.banned, false)));
  const activeDeputies = Number(deputyCountRow?.count ?? 0);

  const [employeeCountRow] = await db
    .select({ count: count() })
    .from(user)
    .where(and(eq(user.role, "EMPLOYEE"), eq(user.banned, false)));
  const activeEmployees = Number(employeeCountRow?.count ?? 0);

  const [bannedCountRow] = await db
    .select({ count: count() })
    .from(user)
    .where(eq(user.banned, true));
  const bannedUsers = Number(bannedCountRow?.count ?? 0);

  let targetUser: PromotionCheckResult["targetUser"] = null;
  if (targetEmail) {
    const [found] = await db
      .select({ id: user.id, role: user.role, banned: user.banned })
      .from(user)
      .where(eq(user.email, targetEmail.toLowerCase()));
    if (found) {
      targetUser = {
        id: found.id,
        role: found.role,
        banned: found.banned,
        isEligible: found.role === "HEAD" && !found.banned,
      };
    }
  }

  const isReady = activeAdmins === 0 && activeHeads >= 1;

  return {
    totalUsers,
    activeAdmins,
    activeHeads,
    activeDeputies,
    activeEmployees,
    bannedUsers,
    isReady,
    targetUser,
  };
}

export interface PromoteAdminResult {
  targetId: string;
  activeAdmins: number;
}

export async function executePromotion(
  db: ScriptDatabase,
  targetEmail: string,
): Promise<PromoteAdminResult> {
  const normalizedEmail = targetEmail.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Target email is required.");
  }

  let targetId = "";

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
      .where(eq(user.email, normalizedEmail));

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

    targetId = target.id;

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
  });

  // 8. Post-commit verification
  const [postAdminRow] = await db
    .select({ count: count() })
    .from(user)
    .where(and(eq(user.role, "ADMIN"), eq(user.banned, false)));

  const postActiveAdmins = Number(postAdminRow?.count ?? 0);
  if (postActiveAdmins !== 1) {
    throw new Error(
      `CRITICAL: Post-promotion verification failed. Expected active ADMIN count = 1, found ${postActiveAdmins}`,
    );
  }

  return {
    targetId,
    activeAdmins: postActiveAdmins,
  };
}
