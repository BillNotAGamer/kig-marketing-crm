import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { task, user, taskDailyUpdate } from "../../db/schema";
import {
  createAuth,
  type AuthDatabase,
  type Transaction,
} from "../auth/factory";
import { authorizedActor, type Actor } from "../auth/session-core";
import type { ServerEnv } from "../env-schema";
import {
  calendarQuerySchema,
  deriveEmployeeTodayTasks,
  type CalendarTaskDTO,
  type TodayCategorizedTask,
} from "./model";
import { currentBusinessDate } from "./date";

const creator = alias(user, "task_creator");
const assignee = alias(user, "task_assignee");

const taskProjection = {
  id: task.id,
  title: task.title,
  description: task.description,
  status: task.status,
  priority: task.priority,
  assignedDate: task.assignedDate,
  dueDate: task.dueDate,
  createdById: task.createdById,
  assignedToId: task.assignedToId,
  creator: { id: creator.id, name: creator.name },
  assignee: { id: assignee.id, name: assignee.name },
};

export function calendarService(
  db: AuthDatabase,
  env: ServerEnv,
  clock: () => Date = () => new Date(),
) {
  async function execute<T>(
    headers: Headers,
    work: (tx: Transaction, actor: Actor) => Promise<T>,
  ): Promise<T> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock_shared(24091802)`);
      const auth = createAuth(tx, env);
      const actor = await authorizedActor(tx, auth, headers);
      return work(tx, actor);
    });
  }

  async function listCalendarTasks(
    headers: Headers,
    rawInput: unknown,
  ): Promise<{ tasks: CalendarTaskDTO[]; businessToday: string }> {
    const input = calendarQuerySchema.parse(rawInput);
    const businessToday = currentBusinessDate(clock);

    return execute(headers, async (tx) => {
      // Query tasks matching date range - all visible non-deleted tasks
      const rows = await tx
        .select(taskProjection)
        .from(task)
        .innerJoin(creator, eq(task.createdById, creator.id))
        .innerJoin(assignee, eq(task.assignedToId, assignee.id))
        .where(
          and(
            isNull(task.deletedAt),
            or(
              and(
                sql`${task.assignedDate} >= ${input.from}`,
                sql`${task.assignedDate} <= ${input.to}`,
              ),
              and(
                sql`${task.dueDate} IS NOT NULL`,
                sql`${task.dueDate} >= ${input.from}`,
                sql`${task.dueDate} <= ${input.to}`,
              ),
            ),
          ),
        )
        .orderBy(
          asc(task.assignedDate),
          asc(task.dueDate),
          desc(task.priority),
          asc(task.title),
        );

      if (rows.length === 0) {
        return { tasks: [], businessToday };
      }

      // Find tasks that intersect today to look up today's daily progress
      const todayCandidateIds = rows
        .filter(
          (r) =>
            r.assignedDate === businessToday ||
            r.dueDate === businessToday ||
            (r.status === "OPEN" && r.dueDate && r.dueDate < businessToday),
        )
        .map((r) => r.id);

      const progressMap = new Map<
        string,
        "COMPLETED" | "NOT_COMPLETED" | "NOT_REPORTED"
      >();

      if (todayCandidateIds.length > 0) {
        const todayUpdates = await tx
          .select({
            taskId: taskDailyUpdate.taskId,
            status: taskDailyUpdate.status,
          })
          .from(taskDailyUpdate)
          .where(
            and(
              inArray(taskDailyUpdate.taskId, todayCandidateIds),
              eq(taskDailyUpdate.reportDate, businessToday),
            ),
          );

        for (const update of todayUpdates) {
          progressMap.set(update.taskId, update.status);
        }
      }

      const tasks: CalendarTaskDTO[] = rows.map((r) => {
        let todayProgressStatus:
          "COMPLETED" | "NOT_COMPLETED" | "NOT_REPORTED" | null = null;

        const isTodayRelevant =
          r.assignedDate === businessToday ||
          r.dueDate === businessToday ||
          (r.status === "OPEN" && r.dueDate && r.dueDate < businessToday);

        if (isTodayRelevant) {
          todayProgressStatus = progressMap.get(r.id) ?? "NOT_REPORTED";
        }

        return {
          id: r.id,
          title: r.title,
          description: r.description,
          status: r.status,
          priority: r.priority,
          assignedDate: r.assignedDate,
          dueDate: r.dueDate,
          createdById: r.createdById,
          assignedToId: r.assignedToId,
          creator: r.creator,
          assignee: r.assignee,
          todayProgressStatus,
        };
      });

      return { tasks, businessToday };
    });
  }

  async function getTodayOverview(headers: Headers): Promise<{
    tasks: CalendarTaskDTO[];
    businessToday: string;
    categorized: TodayCategorizedTask[];
    actorRole: string;
    actorId: string;
  }> {
    const businessToday = currentBusinessDate(clock);

    return execute(headers, async (tx, actor) => {
      const isTeamReader = actor.role !== "EMPLOYEE";

      // Query tasks relevant to today: assigned today, due today, or overdue OPEN tasks
      const rows = await tx
        .select(taskProjection)
        .from(task)
        .innerJoin(creator, eq(task.createdById, creator.id))
        .innerJoin(assignee, eq(task.assignedToId, assignee.id))
        .where(
          and(
            isNull(task.deletedAt),
            isTeamReader ? undefined : eq(task.assignedToId, actor.id),
            or(
              eq(task.assignedDate, businessToday),
              eq(task.dueDate, businessToday),
              and(
                eq(task.status, "OPEN"),
                sql`${task.dueDate} IS NOT NULL`,
                sql`${task.dueDate} < ${businessToday}`,
              ),
            ),
          ),
        )
        .orderBy(
          desc(task.priority),
          asc(task.dueDate),
          asc(task.assignedDate),
          asc(task.title),
        );

      const taskIds = rows.map((r) => r.id);
      const progressMap = new Map<
        string,
        "COMPLETED" | "NOT_COMPLETED" | "NOT_REPORTED"
      >();

      if (taskIds.length > 0) {
        const todayUpdates = await tx
          .select({
            taskId: taskDailyUpdate.taskId,
            status: taskDailyUpdate.status,
          })
          .from(taskDailyUpdate)
          .where(
            and(
              inArray(taskDailyUpdate.taskId, taskIds),
              eq(taskDailyUpdate.reportDate, businessToday),
            ),
          );

        for (const update of todayUpdates) {
          progressMap.set(update.taskId, update.status);
        }
      }

      const tasks: CalendarTaskDTO[] = rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        priority: r.priority,
        assignedDate: r.assignedDate,
        dueDate: r.dueDate,
        createdById: r.createdById,
        assignedToId: r.assignedToId,
        creator: r.creator,
        assignee: r.assignee,
        todayProgressStatus: progressMap.get(r.id) ?? "NOT_REPORTED",
      }));

      const categorized = deriveEmployeeTodayTasks(tasks, businessToday);

      return {
        tasks,
        businessToday,
        categorized,
        actorRole: actor.role,
        actorId: actor.id,
      };
    });
  }

  return {
    listCalendarTasks,
    getTodayOverview,
  };
}

export type CalendarService = ReturnType<typeof calendarService>;
