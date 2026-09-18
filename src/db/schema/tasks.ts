import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { taskPriority, taskStatus } from "./enums";

export const task = pgTable(
  "task",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    status: taskStatus("status").default("OPEN").notNull(),
    priority: taskPriority("priority").default("NORMAL").notNull(),
    assignedDate: date("assigned_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    assignedToId: uuid("assigned_to_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedById: uuid("deleted_by_id").references(() => user.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    check("task_title_nonempty", sql`length(trim(${table.title})) > 0`),
    check(
      "task_date_order",
      sql`${table.dueDate} IS NULL OR ${table.dueDate} >= ${table.assignedDate}`,
    ),
    check(
      "task_lifecycle_consistent",
      sql`(${table.status} = 'OPEN' AND ${table.completedAt} IS NULL AND ${table.cancelledAt} IS NULL) OR (${table.status} = 'COMPLETED' AND ${table.completedAt} IS NOT NULL AND ${table.cancelledAt} IS NULL) OR (${table.status} = 'CANCELLED' AND ${table.cancelledAt} IS NOT NULL AND ${table.completedAt} IS NULL)`,
    ),
    check(
      "task_delete_actor_paired",
      sql`(${table.deletedAt} IS NULL AND ${table.deletedById} IS NULL) OR (${table.deletedAt} IS NOT NULL AND ${table.deletedById} IS NOT NULL)`,
    ),
    index("task_assignee_date_active_idx")
      .on(table.assignedToId, table.assignedDate)
      .where(sql`${table.deletedAt} IS NULL`),
    index("task_assignee_status_active_idx")
      .on(table.assignedToId, table.status)
      .where(sql`${table.deletedAt} IS NULL`),
    index("task_status_date_active_idx")
      .on(table.status, table.assignedDate)
      .where(sql`${table.deletedAt} IS NULL`),
    index("task_due_date_active_idx")
      .on(table.dueDate)
      .where(sql`${table.deletedAt} IS NULL`),
    index("task_creator_idx").on(table.createdById),
  ],
);
export type Task = typeof task.$inferSelect;
export type NewTask = typeof task.$inferInsert;
