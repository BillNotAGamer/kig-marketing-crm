import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { taskProgressStatus } from "./enums";
import { task } from "./tasks";

export const taskDailyUpdate = pgTable(
  "task_daily_update",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    reportDate: date("report_date", { mode: "string" }).notNull(),
    status: taskProgressStatus("status").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    correctedAt: timestamp("corrected_at", { withTimezone: true }),
    correctedById: uuid("corrected_by_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    correctionReason: text("correction_reason"),
  },
  (table) => [
    unique("task_daily_update_task_date_unique").on(
      table.taskId,
      table.reportDate,
    ),
    check(
      "task_daily_update_reason_consistent",
      sql`(${table.status} = 'NOT_COMPLETED' AND ${table.reason} IS NOT NULL AND length(trim(${table.reason})) > 0) OR (${table.status} = 'COMPLETED' AND ${table.reason} IS NULL)`,
    ),
    check(
      "task_daily_update_correction_consistent",
      sql`(${table.correctedAt} IS NULL AND ${table.correctedById} IS NULL AND ${table.correctionReason} IS NULL) OR (${table.correctedAt} IS NOT NULL AND ${table.correctedById} IS NOT NULL AND ${table.correctionReason} IS NOT NULL AND length(trim(${table.correctionReason})) > 0)`,
    ),
    index("task_daily_update_user_date_idx").on(table.userId, table.reportDate),
  ],
);
export type TaskDailyUpdate = typeof taskDailyUpdate.$inferSelect;
export type NewTaskDailyUpdate = typeof taskDailyUpdate.$inferInsert;
