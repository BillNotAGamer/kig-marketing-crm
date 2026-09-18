import { randomBytes, randomUUID } from "node:crypto";
import { inArray, like, or } from "drizzle-orm";
import { createDatabase } from "../db/connection";
import { account, auditLog, session, user, verification } from "../db/schema";
import { createAuth } from "../lib/auth/factory";
import { parseServerEnv } from "../lib/env-schema";
import { administrationLock } from "../lib/users/service";
import { requireDevelopmentDatabase } from "../../scripts/database-env";

// Test-only committed fixtures for separate browser requests/connections.
// Namespace ownership is checked before cleanup; never a production seed.
export async function authFixtures() {
  const db = createDatabase(requireDevelopmentDatabase());
  const env = parseServerEnv(process.env);
  const prefix = `phase2-${randomUUID()}-`;
  const password = randomBytes(24).toString("base64url");
  const email = (label: string) => `${prefix}${label}@example.invalid`;
  const created: {
    id: string;
    email: string;
    role: "HEAD" | "DEPUTY" | "EMPLOYEE";
  }[] = [];
  async function cleanup() {
    try {
      await db.transaction(async (tx) => {
        await tx.execute(administrationLock);
        const owned = await tx
          .select({ id: user.id })
          .from(user)
          .where(like(user.email, `${prefix}%@example.invalid`));
        const ids = owned.map((row) => row.id);
        if (!ids.length) return;
        await tx
          .delete(auditLog)
          .where(
            or(
              inArray(auditLog.actorUserId, ids),
              inArray(auditLog.entityId, ids),
            ),
          );
        await tx.delete(session).where(inArray(session.userId, ids));
        await tx.delete(account).where(inArray(account.userId, ids));
        await tx
          .delete(verification)
          .where(like(verification.identifier, `${prefix}%@example.invalid`));
        await tx.delete(user).where(inArray(user.id, ids));
      });
    } finally {
      await db.$client.end();
    }
  }
  try {
    await db.transaction(async (tx) => {
      await tx.execute(administrationLock);
      const auth = createAuth(tx, env);
      for (const role of ["HEAD", "DEPUTY", "EMPLOYEE"] as const) {
        const value = await auth.api.createUser({
          body: {
            name: `Fixture ${role}`,
            email: email(role.toLowerCase()),
            password,
            role,
          },
        });
        created.push({ id: value.user.id, email: value.user.email, role });
      }
    });
    return {
      db,
      env,
      prefix,
      password,
      email,
      head: created[0],
      deputy: created[1],
      employee: created[2],
      cleanup,
    };
  } catch (error: unknown) {
    await cleanup();
    throw error;
  }
}
