import { and, desc, eq, sql } from "drizzle-orm";
import { task, taskDailyUpdate, auditLog } from "../../db/schema";
import type { Task } from "../../db/schema/tasks";
import type { TaskDailyUpdate } from "../../db/schema/task-daily-updates";
import {
  createAuth,
  type AuthDatabase,
  type Transaction,
} from "../auth/factory";
import { authorizedActor, type Actor } from "../auth/session-core";
import { AccessError } from "../auth/permissions";
import type { ServerEnv } from "../env-schema";
import { administrationLock } from "../users/service";
import { canReadTask } from "../tasks/policy";
import { currentBusinessDate, taskIdSchema } from "../tasks/validation";
import {
  canSubmitProgress,
  correctionSchema,
  progressDTO,
  requireCorrection,
  submitProgressSchema,
  todayProgress,
  type ProgressView,
} from "./model";

async function accessibleTask(
  tx: Transaction,
  actor: Actor,
  id: string,
  lock: boolean,
) {
  const query = tx
    .select()
    .from(task)
    .where(eq(task.id, taskIdSchema.parse(id)));
  const [row] = await (lock ? query.for("update") : query);
  if (!row || !canReadTask(actor, row))
    throw new AccessError(404, "Task not found.");
  return row;
}
function taskSnapshot(row: Task) {
  return {
    id: row.id,
    status: row.status,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}
function reportSnapshot(row: TaskDailyUpdate) {
  return {
    ...progressDTO(row),
    taskId: row.taskId,
    userId: row.userId,
    correctedById: row.correctedById,
  };
}
async function audit(
  tx: Transaction,
  actor: Actor,
  action:
    "MARK_TASK_COMPLETED" | "MARK_TASK_NOT_COMPLETED" | "CORRECT_TASK_PROGRESS",
  before: Task,
  after: Task,
  report: TaskDailyUpdate,
  original?: TaskDailyUpdate,
) {
  await tx.insert(auditLog).values({
    actorUserId: actor.id,
    action,
    entityType: "task",
    entityId: before.id,
    beforeData: {
      task: taskSnapshot(before),
      progress: original ? reportSnapshot(original) : null,
    },
    afterData: { task: taskSnapshot(after), progress: reportSnapshot(report) },
  });
}
// The injectable clock is server-owned. HTTP/form payloads never control it.
export function progressService(
  db: AuthDatabase,
  env: ServerEnv,
  clock: () => Date = () => new Date(),
) {
  async function execute<T>(
    headers: Headers,
    mutation: boolean,
    work: (tx: Transaction, actor: Actor) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      await tx.execute(
        mutation
          ? administrationLock
          : sql`SELECT pg_advisory_xact_lock_shared(24091802)`,
      );
      const actor = await authorizedActor(tx, createAuth(tx, env), headers);
      return work(tx, actor);
    });
  }
  async function getTaskProgress(
    headers: Headers,
    id: string,
  ): Promise<ProgressView> {
    return execute(headers, false, async (tx, actor) => {
      const parent = await accessibleTask(tx, actor, id, false);
      const history = (
        await tx
          .select()
          .from(taskDailyUpdate)
          .where(eq(taskDailyUpdate.taskId, id))
          .orderBy(desc(taskDailyUpdate.reportDate), desc(taskDailyUpdate.id))
      ).map(progressDTO);
      const today = todayProgress(history, currentBusinessDate(clock()));
      return {
        history,
        today,
        canSubmit: canSubmitProgress(actor, parent) && !today.report,
        canCorrect:
          actor.role === "HEAD" &&
          parent.status !== "CANCELLED" &&
          history.length > 0,
      };
    });
  }
  return {
    getTaskProgress,
    getTaskProgressHistory: async (headers: Headers, id: string) =>
      (await getTaskProgress(headers, id)).history,
    getTodayTaskProgress: async (headers: Headers, id: string) =>
      (await getTaskProgress(headers, id)).today,
    submitTaskProgress: (headers: Headers, id: string, input: unknown) =>
      execute(headers, true, async (tx, actor) => {
        const values = submitProgressSchema.parse(input);
        const parent = await accessibleTask(tx, actor, id, true);
        if (parent.assignedToId !== actor.id)
          throw new AccessError(
            403,
            "Only the current assignee can submit progress.",
          );
        if (!canSubmitProgress(actor, parent))
          throw new AccessError(409, "Only OPEN tasks accept normal progress.");
        const now = clock();
        const reportDate = currentBusinessDate(now);
        const existing = await tx
          .select({ id: taskDailyUpdate.id })
          .from(taskDailyUpdate)
          .where(
            and(
              eq(taskDailyUpdate.taskId, id),
              eq(taskDailyUpdate.reportDate, reportDate),
            ),
          );
        if (existing.length)
          throw new AccessError(
            409,
            "This task already has a report for today.",
          );
        const [report] = await tx
          .insert(taskDailyUpdate)
          .values({
            taskId: id,
            userId: actor.id,
            reportDate,
            status: values.status,
            reason: values.status === "NOT_COMPLETED" ? values.reason : null,
            createdAt: now,
          })
          .returning();
        let after = parent;
        if (values.status === "COMPLETED") {
          [after] = await tx
            .update(task)
            .set({
              status: "COMPLETED",
              completedAt: now,
              cancelledAt: null,
              updatedAt: now,
            })
            .where(eq(task.id, id))
            .returning();
        }
        await audit(
          tx,
          actor,
          values.status === "COMPLETED"
            ? "MARK_TASK_COMPLETED"
            : "MARK_TASK_NOT_COMPLETED",
          parent,
          after,
          report,
        );
        return progressDTO(report);
      }),
    correctTaskProgress: (
      headers: Headers,
      id: string,
      progressId: string,
      input: unknown,
    ) =>
      execute(headers, true, async (tx, actor) => {
        if (actor.role !== "HEAD")
          throw new AccessError(403, "HEAD authorization required.");
        const values = correctionSchema.parse(input);
        taskIdSchema.parse(progressId);
        const parent = await accessibleTask(tx, actor, id, true);
        if (parent.status === "CANCELLED")
          throw new AccessError(
            409,
            "Correction cannot undo task cancellation.",
          );
        const [latest] = await tx
          .select()
          .from(taskDailyUpdate)
          .where(eq(taskDailyUpdate.taskId, id))
          .orderBy(desc(taskDailyUpdate.reportDate), desc(taskDailyUpdate.id))
          .limit(1)
          .for("update");
        if (!latest) throw new AccessError(404, "Progress report not found.");
        requireCorrection(latest, progressId, values.status);
        if (
          parent.status !==
          (latest.status === "COMPLETED" ? "COMPLETED" : "OPEN")
        )
          throw new AccessError(
            409,
            "Report and task lifecycle disagree; administrative investigation required.",
          );
        const now = clock();
        const [report] = await tx
          .update(taskDailyUpdate)
          .set({
            status: values.status,
            reason: values.status === "NOT_COMPLETED" ? values.reason : null,
            correctedAt: now,
            correctedById: actor.id,
            correctionReason: values.correctionReason,
          })
          .where(eq(taskDailyUpdate.id, latest.id))
          .returning();
        const [after] = await tx
          .update(task)
          .set({
            status: values.status === "COMPLETED" ? "COMPLETED" : "OPEN",
            completedAt: values.status === "COMPLETED" ? now : null,
            cancelledAt: null,
            updatedAt: now,
          })
          .where(eq(task.id, id))
          .returning();
        await audit(
          tx,
          actor,
          "CORRECT_TASK_PROGRESS",
          parent,
          after,
          report,
          latest,
        );
        return progressDTO(report);
      }),
  };
}
