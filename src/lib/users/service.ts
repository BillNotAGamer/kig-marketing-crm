import { and, eq, desc } from "drizzle-orm";
import { user, session, auditLog, account } from "../../db/schema";
import type { ServerEnv } from "../env-schema";
import {
  createAuth,
  type Transaction,
  type AuthDatabase,
} from "../auth/factory";
import { AccessError, type Permission } from "../auth/permissions";
import { authorizedActor, type Actor } from "../auth/session-core";
import {
  createUserSchema,
  ownPasswordSchema,
  userCommandSchema,
  userIdSchema,
} from "../auth/validation";
import type { AppRole } from "../auth/roles";
import {
  canCreateRole,
  canViewManagedUser,
  canEditIdentity,
  canAssignRole,
  canDisableUser,
  canEnableUser,
  canResetPassword,
} from "./policy";
export { administrationLock, ADMINISTRATION_ADVISORY_LOCK_ID } from "./locks";
import { administrationLock } from "./locks";
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
async function preserveActiveAdminOrHead(
  tx: Transaction,
  target: typeof user.$inferSelect,
  nextRole?: AppRole,
) {
  if (target.banned) return;

  const activeAdmins = await tx
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, "ADMIN"), eq(user.banned, false)));

  if (activeAdmins.length === 0) {
    // STATE A: active ADMIN count === 0.
    // Preserve at least one ACTIVE HEAD.
    if (target.role === "HEAD" && nextRole !== "HEAD") {
      const activeHeads = await tx
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.role, "HEAD"), eq(user.banned, false)));
      if (activeHeads.length <= 1) {
        throw new AccessError(
          409,
          "The final ACTIVE HEAD cannot be disabled or demoted.",
        );
      }
    }
  } else {
    // STATE B: active ADMIN count >= 1.
    // Enforce at least one ACTIVE ADMIN.
    if (target.role === "ADMIN" && nextRole !== "ADMIN") {
      if (activeAdmins.length <= 1) {
        throw new AccessError(
          409,
          "The final ACTIVE ADMIN cannot be disabled or demoted.",
        );
      }
    }
  }
}

export function userService(db: AuthDatabase, env: ServerEnv) {
  async function execute<T>(
    headers: Headers,
    permission: Permission,
    work: (
      tx: Transaction,
      auth: ReturnType<typeof createAuth>,
      actor: Actor,
    ) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      await tx.execute(administrationLock);
      const auth = createAuth(tx, env);
      const actor = await authorizedActor(tx, auth, headers, permission);
      return work(tx, auth, actor);
    });
  }

  return {
    list: (headers: Headers) =>
      execute(headers, "user:read", async (tx, _auth, actor) =>
        (await tx.select().from(user).orderBy(desc(user.createdAt)))
          .filter((target) => canViewManagedUser(actor, target))
          .map(userSummary),
      ),
    create: (headers: Headers, input: unknown) =>
      execute(headers, "user:create", async (tx, auth, actor) => {
        const values = createUserSchema.parse(input);
        if (!canCreateRole(actor.role, values.role as AppRole)) {
          throw new AccessError(403, "Access denied.");
        }
        const result = await auth.api.createUser({ body: values });
        const summary = userSummary(await targetUser(tx, result.user.id));
        await writeAudit(
          tx,
          actor.id,
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
      return execute(headers, permission, async (tx, auth, actor) => {
        const target = await targetUser(tx, targetId);
        if (!canViewManagedUser(actor, target)) {
          throw new AccessError(404, "User not found.");
        }
        const before = userSummary(target);
        let action: AuditAction;
        switch (command.operation) {
          case "update":
            if (!canEditIdentity(actor, target)) {
              throw new AccessError(403, "Access denied.");
            }
            await tx
              .update(user)
              .set({
                name: command.name,
                email: command.email,
                ...(target.email !== command.email
                  ? { emailVerified: false }
                  : {}),
                updatedAt: new Date(),
              })
              .where(eq(user.id, targetId));
            if (target.email !== command.email) {
              await tx.delete(session).where(eq(session.userId, targetId));
            }
            action = "UPDATE_USER";
            break;
          case "change-role":
            if (!canAssignRole(actor, target, command.role as AppRole)) {
              throw new AccessError(403, "Access denied.");
            }
            await preserveActiveAdminOrHead(
              tx,
              target,
              command.role as AppRole,
            );
            await tx
              .update(user)
              .set({
                role: command.role,
                updatedAt: new Date(),
              })
              .where(eq(user.id, targetId));
            await tx.delete(session).where(eq(session.userId, targetId));
            action = "CHANGE_ROLE";
            break;
          case "disable":
            if (!canDisableUser(actor, target)) {
              throw new AccessError(403, "Access denied.");
            }
            await preserveActiveAdminOrHead(tx, target, undefined);
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
            action = "DISABLE_USER";
            break;
          case "enable":
            if (!canEnableUser(actor, target)) {
              throw new AccessError(403, "Access denied.");
            }
            await tx
              .update(user)
              .set({
                banned: false,
                banReason: null,
                banExpires: null,
                updatedAt: new Date(),
              })
              .where(eq(user.id, targetId));
            action = "ENABLE_USER";
            break;
          case "reset-password":
            if (targetId === actor.id) {
              throw new AccessError(
                400,
                "Use change own password with current-password validation.",
              );
            }
            if (!canResetPassword(actor, target)) {
              throw new AccessError(403, "Access denied.");
            }
            const ctx = await auth.$context;
            const hashedPassword = await ctx.password.hash(command.password);
            const [existingAccount] = await tx
              .select()
              .from(account)
              .where(
                and(
                  eq(account.userId, targetId),
                  eq(account.providerId, "credential"),
                ),
              );
            if (existingAccount) {
              await tx
                .update(account)
                .set({
                  password: hashedPassword,
                  updatedAt: new Date(),
                })
                .where(eq(account.id, existingAccount.id));
            } else {
              await tx.insert(account).values({
                userId: targetId,
                accountId: target.id,
                providerId: "credential",
                password: hashedPassword,
              });
            }
            await tx.delete(session).where(eq(session.userId, targetId));
            action = "RESET_PASSWORD";
            break;
        }
        const after = userSummary(await targetUser(tx, targetId));
        await writeAudit(tx, actor.id, action, targetId, before, after);
        return after;
      });
    },
    changeOwnPassword: (headers: Headers, input: unknown) =>
      execute(headers, "user:change-own-password", async (tx, auth, actor) => {
        const values = ownPasswordSchema.parse(input);
        await auth.api.changePassword({
          headers,
          body: { ...values, revokeOtherSessions: false },
        });
        await tx.delete(session).where(eq(session.userId, actor.id));
        await writeAudit(tx, actor.id, "CHANGE_OWN_PASSWORD", actor.id);
        return { success: true };
      }),
  };
}
