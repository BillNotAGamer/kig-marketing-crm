import { randomBytes, randomUUID } from "node:crypto";
import { inArray, like, or } from "drizzle-orm";
import { createDatabase } from "../db/connection";
import {
  account,
  auditLog,
  session,
  user,
  verification,
  task,
  taskAsset,
  taskDailyUpdate,
  notification,
} from "../db/schema";
import { createAuth } from "../lib/auth/factory";
import { parseServerEnv } from "../lib/env-schema";
import { administrationLock } from "../lib/users/service";
import { requireDevelopmentDatabase } from "../../scripts/database-env";

// Test-only committed fixtures for separate browser requests/connections.
// Namespace ownership is checked before cleanup; never a production seed.
export async function authFixtures(
  phase: "phase2" | "phase3" | "phase4" = "phase2",
) {
  const db = createDatabase(requireDevelopmentDatabase());
  const env = parseServerEnv(process.env);
  const prefix = `${phase}-${randomUUID()}-`;
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
        // Only tasks created by this namespace belong to this fixture.
        const tasks = await tx
          .select({ id: task.id })
          .from(task)
          .where(inArray(task.createdById, ids));
        const taskIds = tasks.map((row) => row.id);
        if (taskIds.length) {
          await tx.delete(taskAsset).where(inArray(taskAsset.taskId, taskIds));
          await tx
            .delete(taskDailyUpdate)
            .where(inArray(taskDailyUpdate.taskId, taskIds));
        }
        await tx
          .delete(notification)
          .where(
            or(
              inArray(notification.userId, ids),
              taskIds.length
                ? inArray(notification.entityId, taskIds)
                : undefined,
            ),
          );
        await tx
          .delete(auditLog)
          .where(
            or(
              inArray(auditLog.actorUserId, ids),
              inArray(auditLog.entityId, ids),
              taskIds.length ? inArray(auditLog.entityId, taskIds) : undefined,
            ),
          );
        if (taskIds.length)
          await tx.delete(task).where(inArray(task.id, taskIds));
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
      const roles =
        phase !== "phase2"
          ? ([
              "HEAD",
              "DEPUTY",
              "EMPLOYEE",
              "EMPLOYEE",
              "DEPUTY",
              "EMPLOYEE",
            ] as const)
          : (["HEAD", "DEPUTY", "EMPLOYEE"] as const);
      for (const [index, role] of roles.entries()) {
        const value = await auth.api.createUser({
          body: {
            name: `Fixture ${role}${index >= 3 ? ` ${index === 5 ? "INACTIVE" : "B"}` : ""}`,
            email: email(
              index >= 3
                ? `${role.toLowerCase()}-${index}`
                : role.toLowerCase(),
            ),
            password,
            role,
          },
        });
        created.push({ id: value.user.id, email: value.user.email, role });
        if (index === 5)
          await tx
            .update(user)
            .set({
              banned: true,
              banExpires: null,
              banReason: "Inactive test fixture",
            })
            .where(inArray(user.id, [value.user.id]));
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
      employeeB: created[3],
      deputyB: created[4],
      inactive: created[5],
      cleanup,
    };
  } catch (error: unknown) {
    await cleanup();
    throw error;
  }
}
