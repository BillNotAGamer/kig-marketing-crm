import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { taskAssetProvider, taskAssetType } from "./enums";
import { task } from "./tasks";

export const taskAsset = pgTable(
  "task_asset",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "restrict" }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    provider: taskAssetProvider("provider").notNull(),
    providerFileId: varchar("provider_file_id", { length: 255 }).notNull(),
    sourceUrl: text("source_url").notNull(),
    fileName: varchar("file_name", { length: 512 }),
    mimeType: varchar("mime_type", { length: 255 }),
    assetType: taskAssetType("asset_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedById: uuid("deleted_by_id").references(() => user.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    check(
      "task_asset_provider_id_nonempty",
      sql`length(trim(${table.providerFileId})) > 0`,
    ),
    check(
      "task_asset_source_url_nonempty",
      sql`length(trim(${table.sourceUrl})) > 0`,
    ),
    check(
      "task_asset_delete_actor_paired",
      sql`(${table.deletedAt} IS NULL AND ${table.deletedById} IS NULL) OR (${table.deletedAt} IS NOT NULL AND ${table.deletedById} IS NOT NULL)`,
    ),
    index("task_asset_task_active_idx")
      .on(table.taskId)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("task_asset_active_file_unique")
      .on(table.taskId, table.provider, table.providerFileId)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);
export type TaskAsset = typeof taskAsset.$inferSelect;
export type NewTaskAsset = typeof taskAsset.$inferInsert;
