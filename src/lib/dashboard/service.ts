import { and, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
  deriveDashboardMetrics,
  type DashboardDto,
  type ReportRecordForDashboard,
  type TaskRecordForDashboard,
  type UserRecordForDashboard,
} from "./model";

const assignee = alias(user, "dashboard_task_assignee");

export function dashboardService(
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

  async function getDashboardData(headers: Headers): Promise<DashboardDto> {
    const businessToday = currentBusinessDate(clock());

    return execute(headers, async (tx, actor) => {
      const isTeamView = actor.role !== "EMPLOYEE";

      // 1. Query visible tasks
      const taskWhere = isTeamView
        ? isNull(task.deletedAt)
        : and(isNull(task.deletedAt), eq(task.assignedToId, actor.id));

      const taskRows = await tx
        .select({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          assignedDate: task.assignedDate,
          dueDate: task.dueDate,
          assignedToId: task.assignedToId,
          assignedToName: assignee.name,
          deletedAt: task.deletedAt,
        })
        .from(task)
        .leftJoin(assignee, eq(task.assignedToId, assignee.id))
        .where(taskWhere);

      // 2. Query today's official daily updates
      // Join with task to respect task visibility
      const reportWhere = isTeamView
        ? and(
            eq(taskDailyUpdate.reportDate, businessToday),
            isNull(task.deletedAt),
          )
        : and(
            eq(taskDailyUpdate.reportDate, businessToday),
            isNull(task.deletedAt),
            eq(task.assignedToId, actor.id),
          );

      const reportRows = await tx
        .select({
          taskId: taskDailyUpdate.taskId,
          userId: taskDailyUpdate.userId,
          reportDate: taskDailyUpdate.reportDate,
          status: taskDailyUpdate.status,
          reason: taskDailyUpdate.reason,
        })
        .from(taskDailyUpdate)
        .innerJoin(task, eq(taskDailyUpdate.taskId, task.id))
        .where(reportWhere);

      // 3. Query users for team view
      const userRows = await tx
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          banned: user.banned,
        })
        .from(user);

      const mappedTasks: TaskRecordForDashboard[] = taskRows.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignedDate: t.assignedDate,
        dueDate: t.dueDate,
        assignedToId: t.assignedToId,
        assignedToName: t.assignedToName || undefined,
        deletedAt: t.deletedAt,
      }));

      const mappedReports: ReportRecordForDashboard[] = reportRows.map((r) => ({
        taskId: r.taskId,
        userId: r.userId,
        reportDate: r.reportDate,
        status: r.status,
        reason: r.reason,
      }));

      const mappedUsers: UserRecordForDashboard[] = userRows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as "ADMIN" | "HEAD" | "DEPUTY" | "EMPLOYEE",
        banned: u.banned,
      }));

      return deriveDashboardMetrics({
        tasks: mappedTasks,
        todayReports: mappedReports,
        allUsers: mappedUsers,
        businessToday,
        isTeamView,
        actorId: actor.id,
      });
    });
  }

  return {
    getDashboardData,
  };
}
