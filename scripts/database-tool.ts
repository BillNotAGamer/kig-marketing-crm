import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import postgres from "postgres";
import {
  requireDevelopmentDatabase,
  requireMigrateDatabase,
  safeDatabaseError,
} from "./database-env";

async function main() {
  const command = process.argv[2];
  if (!["bootstrap", "migrate", "studio"].includes(command ?? ""))
    throw new Error("Expected bootstrap, migrate or studio.");
  const url =
    command === "migrate"
      ? requireMigrateDatabase()
      : requireDevelopmentDatabase();
  const client = postgres(url, { max: 1, connect_timeout: 10, prepare: false });
  try {
    // Read-only preflight.
    const tables = await client<
      { table_name: string }[]
    >`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const journal =
      await client`SELECT to_regclass('drizzle.__drizzle_migrations') AS journal`;
    const types =
      await client`SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e'`;
    if (
      command === "bootstrap" &&
      (tables.length > 0 || types.length > 0 || journal[0]?.journal !== null)
    ) {
      throw new Error(
        "Bootstrap requires an empty development schema and no migration journal. Nothing was mutated.",
      );
    }
    if (
      command === "migrate" &&
      process.env.KIG_DATABASE_ENV === "production"
    ) {
      if (!journal[0]?.journal) {
        throw new Error(
          "Production migration requires an existing Drizzle migration journal.",
        );
      }
      const tableNames = new Set(tables.map((t) => t.table_name));
      if (!tableNames.has("task") || !tableNames.has("user")) {
        throw new Error(
          "Production migration requires existing task and user tables.",
        );
      }
      if (tableNames.has("brand")) {
        throw new Error(
          "Production migration preflight detected existing brand table; migration aborted.",
        );
      }
    }
  } finally {
    await client.end();
  }
  const require = createRequire(resolve("package.json"));
  const cli = join(dirname(require.resolve("drizzle-kit")), "bin.cjs");
  const args = [
    cli,
    command === "bootstrap" ? "migrate" : command,
    ...(command === "studio" ? ["--host=127.0.0.1"] : []),
  ];
  if (command === "studio")
    console.log("Starting development-only Drizzle Studio on 127.0.0.1:4983.");
  // Capture CLI output so unexpected failures cannot echo a database URL.
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0)
    throw new Error(
      "Drizzle command failed; output withheld to protect connection credentials.",
    );
  console.log(
    command === "bootstrap" || command === "migrate"
      ? "Migrations applied. Run npm run db:verify next."
      : "Drizzle Studio session ended.",
  );
}
main().catch((error: unknown) => {
  const expected =
    error instanceof Error &&
    (error.message.startsWith("Database command requires") ||
      error.message.startsWith("An authorized") ||
      error.message.startsWith("Database identity") ||
      error.message.startsWith("Bootstrap") ||
      error.message.startsWith("Production migration") ||
      error.message.startsWith("Drizzle command") ||
      error.message.startsWith("Expected"));
  console.error(expected ? error.message : safeDatabaseError(error));
  process.exitCode = 1;
});
