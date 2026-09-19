import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const brand = pgTable(
  "brand",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 100 }).notNull(),
    createdById: uuid("created_by_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("brand_name_nonempty", sql`length(trim(${table.name})) > 0`),
    uniqueIndex("brand_normalized_name_unique").on(table.normalizedName),
  ],
);

export type Brand = typeof brand.$inferSelect;
export type NewBrand = typeof brand.$inferInsert;
