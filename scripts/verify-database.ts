import postgres from "postgres";
import { inspectDatabase } from "../src/db/inspect";
import { requireVerifyDatabase, safeDatabaseError } from "./database-env";

async function main() {
  const url = requireVerifyDatabase();
  const client = postgres(url, { max: 1, connect_timeout: 10, prepare: false });
  try {
    const result = await inspectDatabase(client);
    console.log(
      `Verified ${result.tables} tables (${result.applicationTables} application), ${result.enums} enums, required columns, constraints and indexes.`,
    );
  } finally {
    await client.end();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error &&
      /^(Database command requires|An authorized|Database identity|Missing|Wrong|Unexpected|Enum mismatch)/.test(
        error.message,
      )
      ? error.message
      : safeDatabaseError(error),
  );
  process.exitCode = 1;
});
