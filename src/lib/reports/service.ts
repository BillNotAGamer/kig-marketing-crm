import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { task, taskDailyUpdate, user } from "../../db/schema";
import {
  createAuth,
  type AuthDatabase,
  type Transaction,
} from "../auth/factory";
import { authorizedActor, type Actor } from "../auth/session-core";
import type { ServerEnv } from "../env-schema";
import { currentBusinessDate } from "../tasks/validation";
import {
  deriveReportMetrics,
  getDefaultReportRange,
  reportsQuerySchema,
  type RawProgressReportForReport,
  type RawTaskForReport,
  type RawUserForReport,
  type ReportsDto,
} from "./model";

export function reportsService(
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

  async function getReportsData(
    headers: Headers,
    rawQuery: unknown,
  ): Promise<ReportsDto> {
    const businessToday = currentBusinessDate(clock());
    const parsed = reportsQuerySchema.parse(rawQuery);
    const defaultRange = getDefaultReportRange(businessToday);
    const from = parsed.from || defaultRange.from;
    const to = parsed.to || defaultRange.to;

    return execute(headers, async (tx, actor) => {
      const isTeamView = actor.role !== "EMPLOYEE";

      // 1. Query daily updates in range respecting task visibility
      const reportWhere = isTeamView
        ? and(
            gte(taskDailyUpdate.reportDate, from),
            lte(taskDailyUpdate.reportDate, to),
            isNull(task.deletedAt),
          )
        : and(
            gte(taskDailyUpdate.reportDate, from),
            lte(taskDailyUpdate.reportDate, to),
            isNull(task.deletedAt),
            eq(task.assignedToId, actor.id),
          );

      const reportRows = await tx
        .select({
          taskId: taskDailyUpdate.taskId,
          userId: taskDailyUpdate.userId,
          reportDate: taskDailyUpdate.reportDate,
          status: taskDailyUpdate.status,
        })
        .from(taskDailyUpdate)
        .innerJoin(task, eq(taskDailyUpdate.taskId, task.id))
        .where(reportWhere);

      // 2. Query visible tasks
      const taskWhere = isTeamView
        ? isNull(task.deletedAt)
        : and(isNull(task.deletedAt), eq(task.assignedToId, actor.id));

      const taskRows = await tx
        .select({
          id: task.id,
          title: task.title,
          status: task.status,
          assignedDate: task.assignedDate,
          dueDate: task.dueDate,
          assignedToId: task.assignedToId,
          completedAt: task.completedAt,
          deletedAt: task.deletedAt,
        })
        .from(task)
        .where(taskWhere);

      // 3. Query all users
      const userRows = await tx
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          banned: user.banned,
        })
        .from(user);

      const mappedReports: RawProgressReportForReport[] = reportRows.map(
        (r) => ({
          taskId: r.taskId,
          userId: r.userId,
          reportDate: r.reportDate,
          status: r.status,
        }),
      );

      const mappedTasks: RawTaskForReport[] = taskRows.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assignedDate: t.assignedDate,
        dueDate: t.dueDate,
        assignedToId: t.assignedToId,
        completedAt: t.completedAt,
        deletedAt: t.deletedAt,
      }));

      const mappedUsers: RawUserForReport[] = userRows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as "ADMIN" | "HEAD" | "DEPUTY" | "EMPLOYEE",
        banned: u.banned,
      }));

      return deriveReportMetrics({
        from,
        to,
        businessToday,
        isTeamView,
        actorId: actor.id,
        reportsInRange: mappedReports,
        tasks: mappedTasks,
        allUsers: mappedUsers,
      });
    });
  }

  return {
    getReportsData,
  };
}
