import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { task, user, auditLog, notification, brand } from "../../db/schema";
import type { Task } from "../../db/schema/tasks";
import {
  createAuth,
  type AuthDatabase,
  type Transaction,
} from "../auth/factory";
import { authorizedActor, type Actor } from "../auth/session-core";
import { AccessError } from "../auth/permissions";
import type { ServerEnv } from "../env-schema";
import { administrationLock } from "../users/service";
import {
  canAssignTask,
  canReadTask,
  permitsTask,
  requireTaskPermission,
  type TaskPermission,
} from "./policy";
import {
  createTaskSchema,
  emptyTaskCommandSchema,
  reassignTaskSchema,
  taskIdSchema,
  taskMetadataSchema,
} from "./validation";
import type { AssigneeOption, TaskDTO } from "./types";

const creator = alias(user, "task_creator");
const assignee = alias(user, "task_assignee");
const projection = {
  id: task.id,
  title: task.title,
  description: task.description,
  priority: task.priority,
  status: task.status,
  assignedDate: task.assignedDate,
  dueDate: task.dueDate,
  brandId: task.brandId,
  brandName: brand.name,
  createdById: task.createdById,
  assignedToId: task.assignedToId,
  creator: { id: creator.id, name: creator.name },
  assignee: { id: assignee.id, name: assignee.name },
  completedAt: task.completedAt,
  cancelledAt: task.cancelledAt,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
};
function queryTasks(tx: Transaction, actor: Actor, id?: string) {
  return tx
    .select(projection)
    .from(task)
    .innerJoin(creator, eq(task.createdById, creator.id))
    .innerJoin(assignee, eq(task.assignedToId, assignee.id))
    .leftJoin(brand, eq(task.brandId, brand.id))
    .where(
      and(
        isNull(task.deletedAt),
        permitsTask(actor.role, "task:read-team")
          ? undefined
          : eq(task.assignedToId, actor.id),
        id ? eq(task.id, id) : undefined,
      ),
    );
}
type JoinedTask = Awaited<ReturnType<typeof queryTasks>>[number];
function dto(row: JoinedTask): TaskDTO {
  return {
    ...row,
    brandId: row.brandId ?? null,
    brandName: row.brandName ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
async function getDTO(tx: Transaction, actor: Actor, id: string) {
  const [row] = await queryTasks(tx, actor, id);
  if (!row) throw new AccessError(404, "Task not found.");
  return dto(row);
}
function snapshot(row: Task) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    assignedDate: row.assignedDate,
    dueDate: row.dueDate,
    brandId: row.brandId ?? null,
    createdById: row.createdById,
    assignedToId: row.assignedToId,
    status: row.status,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    deletedById: row.deletedById,
  };
}
type TaskAuditAction =
  | "CREATE_TASK"
  | "UPDATE_TASK"
  | "REASSIGN_TASK"
  | "CANCEL_TASK"
  | "DELETE_TASK";
async function audit(
  tx: Transaction,
  actor: Actor,
  action: TaskAuditAction,
  after: Task,
  before?: Task,
) {
  await tx.insert(auditLog).values({
    actorUserId: actor.id,
    action,
    entityType: "task",
    entityId: after.id,
    beforeData: before ? snapshot(before) : undefined,
    afterData: snapshot(after),
  });
}
type Notice =
  "TASK_ASSIGNED" | "TASK_UPDATED" | "TASK_REASSIGNED" | "TASK_CANCELLED";
async function notify(tx: Transaction, actor: Actor, row: Task, type: Notice) {
  if (row.assignedToId === actor.id && type !== "TASK_REASSIGNED") return;
  const titles: Record<Notice, string> = {
    TASK_ASSIGNED: "New task assigned",
    TASK_UPDATED: "Task updated",
    TASK_REASSIGNED: "Task reassigned to you",
    TASK_CANCELLED: "Task cancelled",
  };
  await tx.insert(notification).values({
    userId: row.assignedToId,
    type,
    title: titles[type],
    message: row.title,
    entityType: "task",
    entityId: row.id,
  });
}
async function lockTask(
  tx: Transaction,
  actor: Actor,
  id: string,
  open: boolean,
) {
  const [row] = await tx
    .select()
    .from(task)
    .where(eq(task.id, taskIdSchema.parse(id)))
    .for("update");
  if (!row || !canReadTask(actor, row))
    throw new AccessError(404, "Task not found.");
  if (open && row.status !== "OPEN")
    throw new AccessError(409, "Only OPEN tasks support this operation.");
  return row;
}
async function assignmentTarget(tx: Transaction, actor: Actor, id: string) {
  const [target] = await tx
    .select({ id: user.id, role: user.role, banned: user.banned })
    .from(user)
    .where(eq(user.id, id));
  if (!target || !canAssignTask(actor, target))
    throw new AccessError(403, "Assignee is unavailable or not permitted.");
}

export function taskService(db: AuthDatabase, env: ServerEnv) {
  async function execute<T>(
    headers: Headers,
    mutation: boolean,
    work: (tx: Transaction, actor: Actor) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      // Shared reads/exclusive writes coordinate canonical account state with Phase 2 administration.
      await tx.execute(
        mutation
          ? administrationLock
          : sql`SELECT pg_advisory_xact_lock_shared(24091802)`,
      );
      const actor = await authorizedActor(tx, createAuth(tx, env), headers);
      return work(tx, actor);
    });
  }
  async function mutate(
    headers: Headers,
    id: string,
    permission: TaskPermission,
    open: boolean,
    work: (tx: Transaction, actor: Actor, before: Task) => Promise<Task>,
    action: TaskAuditAction,
    notice?: Notice,
  ) {
    return execute(headers, true, async (tx, actor) => {
      requireTaskPermission(actor, permission);
      const before = await lockTask(tx, actor, id, open);
      const after = await work(tx, actor, before);
      await audit(tx, actor, action, after, before);
      if (notice) await notify(tx, actor, after, notice);
      return permission === "task:delete"
        ? { success: true as const }
        : getDTO(tx, actor, id);
    });
  }
  return {
    listTasks: (headers: Headers) =>
      execute(headers, false, async (tx, actor) =>
        (
          await queryTasks(tx, actor).orderBy(
            desc(task.assignedDate),
            desc(task.createdAt),
          )
        ).map(dto),
      ),
    getTask: (headers: Headers, id: string) =>
      execute(headers, false, async (tx, actor) =>
        getDTO(tx, actor, taskIdSchema.parse(id)),
      ),
    listAssignees: (headers: Headers) =>
      execute(headers, false, async (tx, actor): Promise<AssigneeOption[]> =>
        (
          await tx
            .select({ id: user.id, name: user.name, role: user.role })
            .from(user)
            .where(
              and(
                eq(user.banned, false),
                actor.role === "ADMIN" || actor.role === "HEAD"
                  ? undefined
                  : actor.role === "DEPUTY"
                    ? or(eq(user.id, actor.id), eq(user.role, "EMPLOYEE"))
                    : eq(user.id, actor.id),
              ),
            )
            .orderBy(user.name)
        ).map((row) => ({ ...row, role: row.role as AssigneeOption["role"] })),
      ),
    createTask: (headers: Headers, input: unknown) =>
      execute(headers, true, async (tx, actor) => {
        const values = createTaskSchema.parse(input);
        requireTaskPermission(
          actor,
          values.assignedToId === actor.id
            ? "task:create-self"
            : "task:create-for-others",
        );
        await assignmentTarget(tx, actor, values.assignedToId);
        const [brandExists] = await tx
          .select({ id: brand.id })
          .from(brand)
          .where(eq(brand.id, values.brandId));
        if (!brandExists) throw new AccessError(400, "Brand not found.");
        const [row] = await tx
          .insert(task)
          .values({
            ...values,
            createdById: actor.id,
            status: "OPEN",
            completedAt: null,
            cancelledAt: null,
            deletedAt: null,
            deletedById: null,
          })
          .returning();
        await audit(tx, actor, "CREATE_TASK", row);
        await notify(tx, actor, row, "TASK_ASSIGNED");
        return getDTO(tx, actor, row.id);
      }),
    updateTaskMetadata: async (
      headers: Headers,
      id: string,
      input: unknown,
    ) => {
      const values = taskMetadataSchema.parse(input);
      return mutate(
        headers,
        id,
        "task:update",
        true,
        async (tx) => {
          const [brandExists] = await tx
            .select({ id: brand.id })
            .from(brand)
            .where(eq(brand.id, values.brandId));
          if (!brandExists) throw new AccessError(400, "Brand not found.");
          const [row] = await tx
            .update(task)
            .set({ ...values, updatedAt: new Date() })
            .where(eq(task.id, id))
            .returning();
          return row;
        },
        "UPDATE_TASK",
        "TASK_UPDATED",
      );
    },
    reassignTask: async (headers: Headers, id: string, input: unknown) => {
      const values = reassignTaskSchema.parse(input);
      return mutate(
        headers,
        id,
        "task:reassign",
        true,
        async (tx, actor, before) => {
          await assignmentTarget(tx, actor, values.assignedToId);
          if (before.assignedToId === values.assignedToId)
            throw new AccessError(409, "Choose a different assignee.");
          const [row] = await tx
            .update(task)
            .set({ assignedToId: values.assignedToId, updatedAt: new Date() })
            .where(eq(task.id, id))
            .returning();
          return row;
        },
        "REASSIGN_TASK",
        "TASK_REASSIGNED",
      );
    },
    cancelTask: async (headers: Headers, id: string, input: unknown) => {
      emptyTaskCommandSchema.parse(input);
      return mutate(
        headers,
        id,
        "task:cancel",
        true,
        async (tx) => {
          const now = new Date();
          const [row] = await tx
            .update(task)
            .set({
              status: "CANCELLED",
              cancelledAt: now,
              completedAt: null,
              updatedAt: now,
            })
            .where(eq(task.id, id))
            .returning();
          return row;
        },
        "CANCEL_TASK",
        "TASK_CANCELLED",
      );
    },
    softDeleteTask: async (headers: Headers, id: string, input: unknown) => {
      emptyTaskCommandSchema.parse(input);
      return mutate(
        headers,
        id,
        "task:delete",
        false,
        async (tx, actor) => {
          const now = new Date();
          const [row] = await tx
            .update(task)
            .set({ deletedAt: now, deletedById: actor.id, updatedAt: now })
            .where(eq(task.id, id))
            .returning();
          return row;
        },
        "DELETE_TASK",
      );
    },
  };
}
