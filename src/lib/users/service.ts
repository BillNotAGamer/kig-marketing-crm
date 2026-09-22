import { and, count, eq, desc, isNull, ne } from "drizzle-orm";
import {
  user,
  session,
  auditLog,
  account,
  task,
  taskAsset,
  taskDailyUpdate,
  brand,
  notification,
} from "../../db/schema";
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
  canPermanentlyDeleteUser,
} from "./policy";
import { DELETED_USER_SENTINEL_ID } from "./sentinel";
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
  | "CHANGE_OWN_PASSWORD"
  | "DELETE_USER";
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

async function preserveActiveAdminForDelete(
  tx: Transaction,
  target: typeof user.$inferSelect,
) {
  if (target.role === "ADMIN" && !target.banned) {
    const activeAdmins = await tx
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.role, "ADMIN"), eq(user.banned, false)));

    if (activeAdmins.length <= 1) {
      throw new AccessError(
        409,
        "The final ACTIVE ADMIN cannot be permanently deleted.",
      );
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
        (
          await tx
            .select()
            .from(user)
            .where(ne(user.id, DELETED_USER_SENTINEL_ID))
            .orderBy(desc(user.createdAt))
        )
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
                : command.operation === "delete-user"
                  ? "user:delete"
                  : "user:enable";
      return execute(headers, permission, async (tx, auth, actor) => {
        const target = await targetUser(tx, targetId);
        if (targetId === DELETED_USER_SENTINEL_ID) {
          throw new AccessError(403, "Cannot manage system sentinel.");
        }
        if (!canViewManagedUser(actor, target)) {
          throw new AccessError(404, "User not found.");
        }
        const before = userSummary(target);

        if (command.operation === "delete-user") {
          if (!canPermanentlyDeleteUser(actor, target)) {
            throw new AccessError(403, "Access denied.");
          }
          if (command.confirmationEmail) {
            if (
              command.confirmationEmail.toLowerCase().trim() !==
              target.email.toLowerCase().trim()
            ) {
              throw new AccessError(
                400,
                "Email xác nhận không khớp với email của người dùng.",
              );
            }
          }

          await preserveActiveAdminForDelete(tx, target);

          const [openTasks] = await tx
            .select({ count: count() })
            .from(task)
            .where(
              and(
                eq(task.assignedToId, targetId),
                eq(task.status, "OPEN"),
                isNull(task.deletedAt),
              ),
            );
          const openCount = Number(openTasks?.count || 0);
          if (openCount > 0) {
            throw new AccessError(
              409,
              `Người dùng đang có ${openCount} công việc chưa hoàn thành. Vui lòng chuyển giao công việc trước khi xóa.`,
            );
          }

          // 1. Repoint historical Task references to sentinel
          await tx
            .update(task)
            .set({ createdById: DELETED_USER_SENTINEL_ID })
            .where(eq(task.createdById, targetId));

          await tx
            .update(task)
            .set({ assignedToId: DELETED_USER_SENTINEL_ID })
            .where(eq(task.assignedToId, targetId));

          await tx
            .update(task)
            .set({ deletedById: DELETED_USER_SENTINEL_ID })
            .where(eq(task.deletedById, targetId));

          // 2. Repoint Task Asset references to sentinel
          await tx
            .update(taskAsset)
            .set({ createdById: DELETED_USER_SENTINEL_ID })
            .where(eq(taskAsset.createdById, targetId));

          await tx
            .update(taskAsset)
            .set({ deletedById: DELETED_USER_SENTINEL_ID })
            .where(eq(taskAsset.deletedById, targetId));

          // 3. Repoint Daily Progress references to sentinel
          await tx
            .update(taskDailyUpdate)
            .set({ userId: DELETED_USER_SENTINEL_ID })
            .where(eq(taskDailyUpdate.userId, targetId));

          await tx
            .update(taskDailyUpdate)
            .set({ correctedById: DELETED_USER_SENTINEL_ID })
            .where(eq(taskDailyUpdate.correctedById, targetId));

          // 4. NULL brand.created_by_id
          await tx
            .update(brand)
            .set({ createdById: null })
            .where(eq(brand.createdById, targetId));

          // 5. Delete private notifications
          await tx
            .delete(notification)
            .where(eq(notification.userId, targetId));

          // 6. Delete sessions
          await tx.delete(session).where(eq(session.userId, targetId));

          // 7. Delete Better Auth account rows
          await tx.delete(account).where(eq(account.userId, targetId));

          // 8. Write audit log entry (before deleting user row)
          await tx.insert(auditLog).values({
            actorUserId: actor.id,
            action: "DELETE_USER",
            entityType: "user",
            entityId: targetId,
            beforeData: before,
            afterData: null,
            metadata: {
              deletedBy: actor.id,
              deletedByEmail: actor.email,
              deletedByRole: actor.role,
              targetRole: target.role,
              targetEmail: target.email,
            },
          });

          // 9. Delete user row
          await tx.delete(user).where(eq(user.id, targetId));

          return { success: true, deletedUserId: targetId };
        }
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
