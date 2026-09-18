// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PgDialect, getTableConfig } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { databaseTables, applicationEnums } from "./inspect";

const migration = readFileSync("drizzle/0000_initial_v1_1.sql", "utf8");
const dialect = new PgDialect();
function checkSql(table: Parameters<typeof getTableConfig>[0], name: string) {
  const check = getTableConfig(table).checks.find((c) => c.name === name);
  expect(check, name).toBeDefined();
  return dialect.sqlToQuery(check!.value).sql;
}

describe("PostgreSQL V1.1 persistence metadata and generated SQL (offline)", () => {
  it("has exactly nine UUID tables, five application tables and six approved enums", () => {
    expect(
      databaseTables.map((table) => getTableConfig(table).name).sort(),
    ).toEqual([
      "account",
      "audit_log",
      "notification",
      "session",
      "task",
      "task_asset",
      "task_daily_update",
      "user",
      "verification",
    ]);
    for (const table of databaseTables) {
      const id = getTableConfig(table).columns.find((c) => c.name === "id")!;
      expect(id.getSQLType()).toBe("uuid");
      expect(id.primary).toBe(true);
      expect(id.hasDefault).toBe(true);
    }
    expect(applicationEnums.map((e) => [e.enumName, e.enumValues])).toEqual([
      ["task_status", ["OPEN", "COMPLETED", "CANCELLED"]],
      ["task_priority", ["LOW", "NORMAL", "HIGH", "URGENT"]],
      ["task_progress_status", ["COMPLETED", "NOT_COMPLETED"]],
      ["task_asset_provider", ["GOOGLE_DRIVE"]],
      [
        "task_asset_type",
        [
          "IMAGE",
          "VIDEO",
          "DOCUMENT",
          "SPREADSHEET",
          "PRESENTATION",
          "PDF",
          "OTHER",
        ],
      ],
      [
        "notification_type",
        ["TASK_ASSIGNED", "TASK_UPDATED", "TASK_REASSIGNED", "TASK_CANCELLED"],
      ],
    ]);
    expect(schema.task.status.default).toBe("OPEN");
    expect(schema.task.priority.default).toBe("NORMAL");
  });
  it("keeps business dates as DATE strings and every event timestamp as TIMESTAMPTZ", () => {
    for (const column of [
      schema.task.assignedDate,
      schema.task.dueDate,
      schema.taskDailyUpdate.reportDate,
    ]) {
      expect(column.getSQLType()).toBe("date");
      expect(column.mapFromDriverValue("2026-09-18")).toBe("2026-09-18");
    }
    for (const table of databaseTables)
      for (const column of getTableConfig(table).columns) {
        if (column.getSQLType().startsWith("timestamp"))
          expect(column.getSQLType()).toBe("timestamp with time zone");
      }
  });
  it("uses RESTRICT for all 13 foreign keys and leaves audit actor nullable", () => {
    const keys = databaseTables.flatMap((t) => getTableConfig(t).foreignKeys);
    expect(keys).toHaveLength(13);
    for (const key of keys) {
      expect(key.onDelete).toBe("restrict");
      for (const column of key.reference().columns)
        expect(column.getSQLType()).toBe("uuid");
    }
    expect(schema.auditLog.actorUserId.notNull).toBe(false);
    expect(schema.task.createdById.notNull).toBe(true);
    expect(schema.task.assignedToId.notNull).toBe(true);
  });
  it("has blank-title, date-order, lifecycle and delete-actor CHECKs", () => {
    expect(checkSql(schema.task, "task_title_nonempty")).toContain(
      'length(trim("task"."title")) > 0',
    );
    expect(checkSql(schema.task, "task_date_order")).toContain(
      '"task"."due_date" >= "task"."assigned_date"',
    );
    const lifecycle = checkSql(schema.task, "task_lifecycle_consistent");
    expect(lifecycle).toContain(
      '\'OPEN\' AND "task"."completed_at" IS NULL AND "task"."cancelled_at" IS NULL',
    );
    expect(lifecycle).toContain(
      '\'COMPLETED\' AND "task"."completed_at" IS NOT NULL AND "task"."cancelled_at" IS NULL',
    );
    expect(lifecycle).toContain(
      '\'CANCELLED\' AND "task"."cancelled_at" IS NOT NULL AND "task"."completed_at" IS NULL',
    );
    const deletion = checkSql(schema.task, "task_delete_actor_paired");
    expect(deletion).toContain(
      '"deleted_at" IS NULL AND "task"."deleted_by_id" IS NULL',
    );
    expect(deletion).toContain(
      '"deleted_at" IS NOT NULL AND "task"."deleted_by_id" IS NOT NULL',
    );
  });
  it("requires NOT_COMPLETED reason, forbids COMPLETED reason and pairs all correction fields", () => {
    const reason = checkSql(
      schema.taskDailyUpdate,
      "task_daily_update_reason_consistent",
    );
    expect(reason).toContain("'NOT_COMPLETED'");
    expect(reason).toContain('"reason" IS NOT NULL');
    expect(reason).toContain('length(trim("task_daily_update"."reason")) > 0');
    expect(reason).toContain(
      '\'COMPLETED\' AND "task_daily_update"."reason" IS NULL',
    );
    const correction = checkSql(
      schema.taskDailyUpdate,
      "task_daily_update_correction_consistent",
    );
    for (const column of [
      "corrected_at",
      "corrected_by_id",
      "correction_reason",
    ]) {
      expect(correction).toContain(`"${column}" IS NULL`);
      expect(correction).toContain(`"${column}" IS NOT NULL`);
    }
    expect(correction).toContain(
      'length(trim("task_daily_update"."correction_reason")) > 0',
    );
    const unique = getTableConfig(schema.taskDailyUpdate).uniqueConstraints;
    expect(unique).toHaveLength(1);
    expect(unique[0].columns.map((c) => c.name)).toEqual([
      "task_id",
      "report_date",
    ]);
  });
  it("rejects blank asset IDs/URLs and permits reattachment only through active partial uniqueness", () => {
    expect(
      checkSql(schema.taskAsset, "task_asset_provider_id_nonempty"),
    ).toContain('length(trim("task_asset"."provider_file_id")) > 0');
    expect(
      checkSql(schema.taskAsset, "task_asset_source_url_nonempty"),
    ).toContain('length(trim("task_asset"."source_url")) > 0');
    expect(
      checkSql(schema.taskAsset, "task_asset_delete_actor_paired"),
    ).toContain('"deleted_by_id" IS NOT NULL');
    const index = getTableConfig(schema.taskAsset).indexes.find(
      (i) => i.config.unique,
    )!;
    expect(
      index.config.columns.map((c) => ("name" in c ? c.name : "expression")),
    ).toEqual(["task_id", "provider", "provider_file_id"]);
    expect(dialect.sqlToQuery(index.config.where!).sql).toBe(
      '"task_asset"."deleted_at" IS NULL',
    );
  });
  it("has all 14 CHECKs and 14 approved indexes, including six active partial indexes", () => {
    const configs = databaseTables.map(getTableConfig);
    expect(configs.flatMap((c) => c.checks)).toHaveLength(14);
    expect(configs.flatMap((c) => c.indexes)).toHaveLength(14);
    expect(
      configs.flatMap((c) => c.indexes).filter((i) => i.config.where),
    ).toHaveLength(6);
    for (const table of [schema.notification, schema.auditLog])
      for (const check of getTableConfig(table).checks)
        expect(dialect.sqlToQuery(check.value).sql).toContain("length(trim(");
  });
  it("compiles all named multiple-user relations alongside the generated auth relations", () => {
    const db = drizzle.mock({ schema });
    const sql = db.query.user
      .findMany({
        with: {
          sessions: true,
          accounts: true,
          createdTasks: true,
          assignedTasks: true,
          deletedTasks: true,
          dailyUpdates: true,
          correctedUpdates: true,
          createdAssets: true,
          deletedAssets: true,
          notifications: true,
          auditLogs: true,
        },
      })
      .toSQL();
    expect(sql.sql).toContain('"user"');
    expect(
      db.query.task
        .findMany({
          with: {
            createdBy: true,
            assignedTo: true,
            deletedBy: true,
            dailyUpdates: true,
            assets: true,
          },
        })
        .toSQL().sql,
    ).toContain('"task"');
  });
  it("has one clean initial migration with matching DDL and no destructive operations/cascades", () => {
    expect(readdirSync("drizzle").filter((f) => f.endsWith(".sql"))).toEqual([
      "0000_initial_v1_1.sql",
    ]);
    expect(migration.match(/CREATE TABLE /g)).toHaveLength(9);
    expect(migration.match(/CREATE TYPE /g)).toHaveLength(6);
    expect(migration.match(/FOREIGN KEY /g)).toHaveLength(13);
    expect(migration.match(/ CHECK /g)).toHaveLength(14);
    expect(migration.match(/CREATE (?:UNIQUE )?INDEX /g)).toHaveLength(14);
    expect(migration).toContain('UNIQUE("task_id","report_date")');
    expect(migration).toContain('WHERE "task_asset"."deleted_at" IS NULL');
    expect(migration).not.toMatch(
      /\b(?:DROP|TRUNCATE|DELETE FROM|CASCADE|NOT_REPORTED)\b/i,
    );
    expect(migration).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(migration).not.toMatch(/"[a-z_]+" timestamp(?:,| NOT| DEFAULT)/);
  });
});
