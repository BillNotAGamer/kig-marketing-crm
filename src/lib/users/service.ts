import { and, eq, sql, desc } from "drizzle-orm";
import { user, session, auditLog } from "../../db/schema";
import type { ServerEnv } from "../env-schema";
import {
  createAuth,
  type Transaction,
  type AuthDatabase,
} from "../auth/factory";
import { AccessError, type Permission } from "../auth/permissions";
import { authorizedActor } from "../auth/session-core";
import {
  createUserSchema,
  ownPasswordSchema,
  userCommandSchema,
  userIdSchema,
} from "../auth/validation";

export const administrationLock = sql`SELECT pg_advisory_xact_lock(24091802)`;
export function userSummary(value: typeof user.$inferSelect) {
  return {
    id: value.id,
    name: value.name,
    email: value.email,
    role: value.role,
    banned: value.banned,
    createdAt: value.createdAt.toISOString(),
  };
}
type Summary = ReturnType<typeof userSummary>;
type AuditAction =
  | "CREATE_USER"
  | "UPDATE_USER"
  | "CHANGE_ROLE"
  | "DISABLE_USER"
  | "ENABLE_USER"
  | "RESET_PASSWORD"
  | "CHANGE_OWN_PASSWORD";
async function writeAudit(
  tx: Transaction,
  actorId: string,
  action: AuditAction,
  targetId: string,
  before?: Summary,
  after?: Summary,
) {
  await tx.insert(auditLog).values({
    actorUserId: actorId,
    action,
    entityType: "user",
    entityId: targetId,
    beforeData: before,
    afterData: after,
  });
}
async function targetUser(tx: Transaction, id: string) {
  const [target] = await tx.select().from(user).where(eq(user.id, id));
  if (!target) throw new AccessError(404, "User not found.");
  return target;
}
async function preserveActiveHead(
  tx: Transaction,
  target: typeof user.$inferSelect,
) {
  if (target.role === "HEAD" && !target.banned) {
    const heads = await tx
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.role, "HEAD"), eq(user.banned, false)));
    if (heads.length <= 1)
      throw new AccessError(
        409,
        "The final ACTIVE HEAD cannot be disabled or demoted.",
      );
  }
}
export function userService(db: AuthDatabase, env: ServerEnv) {
  async function execute<T>(
    headers: Headers,
    permission: Permission,
    work: (
      tx: Transaction,
      auth: ReturnType<typeof createAuth>,
      actorId: string,
    ) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      await tx.execute(administrationLock);
      const auth = createAuth(tx, env);
      const actor = await authorizedActor(tx, auth, headers, permission);
      return work(tx, auth, actor.id);
    });
  }
  return {
    list: (headers: Headers) =>
      execute(headers, "user:read", async (tx) =>
        (await tx.select().from(user).orderBy(desc(user.createdAt))).map(
          userSummary,
        ),
      ),
    create: (headers: Headers, input: unknown) =>
      execute(headers, "user:create", async (tx, auth, actorId) => {
        const values = createUserSchema.parse(input);
        const result = await auth.api.createUser({ headers, body: values });
        const summary = userSummary(await targetUser(tx, result.user.id));
        await writeAudit(
          tx,
          actorId,
          "CREATE_USER",
          result.user.id,
          undefined,
          summary,
        );
        return summary;
      }),
    command: async (headers: Headers, id: string, input: unknown) => {
      const targetId = userIdSchema.parse(id);
      const command = userCommandSchema.parse(input);
      const permission: Permission =
        command.operation === "change-role"
          ? "user:change-role"
          : command.operation === "reset-password"
            ? "user:reset-password"
            : command.operation === "update"
              ? "user:update"
              : command.operation === "disable"
                ? "user:disable"
                : "user:enable";
      return execute(headers, permission, async (tx, auth, actorId) => {
        const target = await targetUser(tx, targetId);
        const before = userSummary(target);
        let action: AuditAction;
        switch (command.operation) {
          case "update":
            await auth.api.adminUpdateUser({
              headers,
              body: {
                userId: targetId,
                data: {
                  name: command.name,
                  email: command.email,
                  ...(target.email !== command.email
                    ? { emailVerified: false }
                    : {}),
                },
              },
            });
            if (target.email !== command.email)
              await tx.delete(session).where(eq(session.userId, targetId));
            action = "UPDATE_USER";
            break;
          case "change-role":
            if (command.role !== "HEAD") await preserveActiveHead(tx, target);
            await auth.api.setRole({
              headers,
              body: { userId: targetId, role: command.role },
            });
            await tx.delete(session).where(eq(session.userId, targetId));
            action = "CHANGE_ROLE";
            break;
          case "disable":
            await preserveActiveHead(tx, target);
            if (targetId === actorId) {
              // Better Auth banUser forbids self-ban; the approved business rule permits it when another ACTIVE HEAD remains.
              await tx
                .update(user)
                .set({
                  banned: true,
                  banReason: "Administrative deactivation",
                  banExpires: null,
                  updatedAt: new Date(),
                })
                .where(eq(user.id, targetId));
              await tx.delete(session).where(eq(session.userId, targetId));
            } else
              await auth.api.banUser({
                headers,
                body: {
                  userId: targetId,
                  banReason: "Administrative deactivation",
                },
              });
            action = "DISABLE_USER";
            break;
          case "enable":
            await auth.api.unbanUser({ headers, body: { userId: targetId } });
            action = "ENABLE_USER";
            break;
          case "reset-password":
            if (targetId === actorId)
              throw new AccessError(
                400,
                "Use change own password with current-password validation.",
              );
            await auth.api.setUserPassword({
              headers,
              body: { userId: targetId, newPassword: command.password },
            });
            await tx.delete(session).where(eq(session.userId, targetId));
            action = "RESET_PASSWORD";
            break;
        }
        const after = userSummary(await targetUser(tx, targetId));
        await writeAudit(tx, actorId, action, targetId, before, after);
        return after;
      });
    },
    changeOwnPassword: (headers: Headers, input: unknown) =>
      execute(headers, "user:reset-password", async (tx, auth, actorId) => {
        const values = ownPasswordSchema.parse(input);
        await auth.api.changePassword({
          headers,
          body: { ...values, revokeOtherSessions: false },
        });
        await tx.delete(session).where(eq(session.userId, actorId));
        await writeAudit(tx, actorId, "CHANGE_OWN_PASSWORD", actorId);
        return { success: true };
      }),
  };
}
