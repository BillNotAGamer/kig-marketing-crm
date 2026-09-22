import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { task, user } from "../../db/schema";
import {
  createAuth,
  type AuthDatabase,
  type Transaction,
} from "../auth/factory";
import { authorizedActor, type Actor } from "../auth/session-core";
import type { ServerEnv } from "../env-schema";
import { currentBusinessDate } from "../tasks/validation";
import {
  escapeSqlLikePattern,
  taskSearchQuerySchema,
  type SearchTaskResultItem,
  type TaskSearchResultDto,
} from "./model";

const assignee = alias(user, "search_task_assignee");

export function searchService(
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

  async function searchTasks(
    headers: Headers,
    rawQuery: unknown,
  ): Promise<TaskSearchResultDto> {
    const query = taskSearchQuerySchema.parse(rawQuery);
    const businessToday = currentBusinessDate(clock());

    return execute(headers, async (tx) => {
      const conditions = [isNull(task.deletedAt)];

      if (query.assigneeId) {
        conditions.push(eq(task.assignedToId, query.assigneeId));
      }

      // Keyword query
      if (query.q && query.q.length > 0) {
        const pattern = `%${escapeSqlLikePattern(query.q)}%`;
        conditions.push(
          or(
            ilike(task.title, pattern),
            ilike(task.description, pattern),
            ilike(assignee.name, pattern),
          )!,
        );
      }

      // Status filter
      if (query.status) {
        conditions.push(eq(task.status, query.status));
      }

      // Priority filter
      if (query.priority) {
        conditions.push(eq(task.priority, query.priority));
      }

      // Date filters
      if (query.fromAssigned) {
        conditions.push(gte(task.assignedDate, query.fromAssigned));
      }
      if (query.toAssigned) {
        conditions.push(lte(task.assignedDate, query.toAssigned));
      }
      if (query.fromDue) {
        conditions.push(gte(task.dueDate, query.fromDue));
      }
      if (query.toDue) {
        conditions.push(lte(task.dueDate, query.toDue));
      }

      const whereClause = and(...conditions);

      // Count query
      const [totalCountResult] = await tx
        .select({ count: count() })
        .from(task)
        .leftJoin(assignee, eq(task.assignedToId, assignee.id))
        .where(whereClause);

      const total = Number(totalCountResult?.count || 0);
      const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
      const offset = (query.page - 1) * query.pageSize;

      // Select items
      const rows = await tx
        .select({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assignedDate: task.assignedDate,
          dueDate: task.dueDate,
          assignedToId: task.assignedToId,
          assignedToName: assignee.name,
          updatedAt: task.updatedAt,
        })
        .from(task)
        .leftJoin(assignee, eq(task.assignedToId, assignee.id))
        .where(whereClause)
        .orderBy(desc(task.updatedAt), desc(task.id))
        .limit(query.pageSize)
        .offset(offset);

      const items: SearchTaskResultItem[] = rows.map((r) => {
        const isOverdue =
          r.status === "OPEN" &&
          r.dueDate !== null &&
          r.dueDate < businessToday;

        return {
          id: r.id,
          title: r.title,
          description: r.description,
          status: r.status,
          priority: r.priority,
          assignedDate: r.assignedDate,
          dueDate: r.dueDate,
          assignedToId: r.assignedToId,
          assignedToName: r.assignedToName || "Chưa phân công",
          isOverdue,
          updatedAt:
            r.updatedAt instanceof Date
              ? r.updatedAt.toISOString()
              : String(r.updatedAt),
        };
      });

      return {
        items,
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages,
        query,
      };
    });
  }

  return {
    searchTasks,
  };
}
