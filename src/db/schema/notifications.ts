import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { notificationType } from "./enums";

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    type: notificationType("type").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    message: text("message").notNull(),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: varchar("entity_id", { length: 255 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("notification_title_nonempty", sql`length(trim(${table.title})) > 0`),
    check(
      "notification_message_nonempty",
      sql`length(trim(${table.message})) > 0`,
    ),
    index("notification_user_read_created_idx").on(
      table.userId,
      table.readAt,
      table.createdAt,
    ),
  ],
);
export type Notification = typeof notification.$inferSelect;
export type NewNotification = typeof notification.$inferInsert;
