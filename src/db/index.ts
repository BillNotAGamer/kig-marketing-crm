import "server-only";
import { getServerEnv } from "@/lib/env";
import { createDatabase, type Database } from "./connection";

const globalDatabase = globalThis as typeof globalThis & {
  kigDatabase?: Database;
};
let productionDatabase: Database | undefined;

export function getDb(): Database {
  const env = getServerEnv();
  if (process.env.NODE_ENV === "production") {
    return (productionDatabase ??= createDatabase(env.DATABASE_URL));
  }
  return (globalDatabase.kigDatabase ??= createDatabase(env.DATABASE_URL));
}
export type { Database } from "./connection";
