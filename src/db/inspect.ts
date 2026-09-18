import { getTableConfig, type AnyPgTable } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export const databaseTables: AnyPgTable[] = [
  schema.user,
  schema.session,
  schema.account,
  schema.verification,
  schema.task,
  schema.taskDailyUpdate,
  schema.taskAsset,
  schema.notification,
  schema.auditLog,
];
export const applicationEnums = [
  schema.taskStatus,
  schema.taskPriority,
  schema.taskProgressStatus,
  schema.taskAssetProvider,
  schema.taskAssetType,
  schema.notificationType,
];

export async function inspectDatabase(client: import("postgres").Sql) {
  const columns = await client<
    {
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
    }[]
  >`SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public'`;
  const constraints = await client<
    {
      table_name: string;
      conname: string;
      contype: string;
      confdeltype: string;
      definition: string;
    }[]
  >`SELECT r.relname AS table_name,c.conname,c.contype,c.confdeltype,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public'`;
  const indexes = await client<
    { tablename: string; indexname: string; indexdef: string }[]
  >`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public'`;
  const enums = await client<
    { typname: string; enumlabel: string }[]
  >`SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY e.enumsortorder`;
  for (const table of databaseTables) {
    const config = getTableConfig(table);
    for (const column of config.columns) {
      const actual = columns.find(
        (c) => c.table_name === config.name && c.column_name === column.name,
      );
      if (!actual)
        throw new Error(
          `Missing database column ${config.name}.${column.name}`,
        );
      if (column.notNull && actual.is_nullable !== "NO")
        throw new Error(`Unexpected nullability ${config.name}.${column.name}`);
      const expectedType = column.getSQLType();
      if (
        (expectedType === "uuid" && actual.data_type !== "uuid") ||
        (expectedType === "date" && actual.data_type !== "date") ||
        (expectedType.startsWith("timestamp") &&
          actual.data_type !== "timestamp with time zone")
      )
        throw new Error(`Wrong database type ${config.name}.${column.name}`);
    }
    for (const check of config.checks) {
      if (
        !constraints.some(
          (c) =>
            c.table_name === config.name &&
            c.conname === check.name &&
            c.contype === "c",
        )
      )
        throw new Error(`Missing CHECK ${check.name}`);
    }
    for (const key of config.foreignKeys) {
      const actual = constraints.find(
        (c) =>
          c.table_name === config.name &&
          c.conname === key.getName() &&
          c.contype === "f",
      );
      if (!actual || actual.confdeltype !== "r")
        throw new Error(`Missing/reconfigured restrictive FK ${key.getName()}`);
    }
    for (const key of config.uniqueConstraints) {
      if (
        !constraints.some(
          (c) =>
            c.conname === key.getName() &&
            c.table_name === config.name &&
            c.contype === "u",
        )
      )
        throw new Error(`Missing UNIQUE ${key.getName()}`);
    }
    for (const index of config.indexes) {
      const actual = indexes.find(
        (i) => i.tablename === config.name && i.indexname === index.config.name,
      );
      if (
        !actual ||
        (index.config.where &&
          !/WHERE.*deleted_at IS NULL/i.test(actual.indexdef)) ||
        (index.config.unique &&
          !actual.indexdef.startsWith("CREATE UNIQUE INDEX"))
      )
        throw new Error(`Missing/reconfigured index ${index.config.name}`);
    }
  }
  const daily = constraints.find(
    (c) => c.conname === "task_daily_update_task_date_unique",
  );
  if (!daily || !/UNIQUE \(task_id, report_date\)/.test(daily.definition))
    throw new Error("Wrong daily report uniqueness");
  for (const definition of applicationEnums) {
    const labels = enums
      .filter((e) => e.typname === definition.enumName)
      .map((e) => e.enumlabel);
    if (JSON.stringify(labels) !== JSON.stringify(definition.enumValues))
      throw new Error(`Enum mismatch ${definition.enumName}`);
  }
  return {
    tables: databaseTables.length,
    applicationTables: 5,
    enums: applicationEnums.length,
  };
}
