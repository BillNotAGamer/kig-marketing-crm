import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../src/db/schema";

export function createScriptDatabase(url: string, options?: { max?: number }) {
  const client = postgres(url, {
    max: options?.max ?? 1,
    connect_timeout: 10,
    prepare: false,
  });
  const db = drizzle(client, { schema });
  return {
    db,
    client,
    async close() {
      await client.end();
    },
  };
}

export type ScriptDatabaseHelper = ReturnType<typeof createScriptDatabase>;
export type ScriptDatabase = ScriptDatabaseHelper["db"];
