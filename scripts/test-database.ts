import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { requireDevelopmentDatabase, safeDatabaseError } from "./database-env";

try {
  // Load the private development environment before Vitest sets NODE_ENV=test.
  // Next's test-mode loader intentionally skips .env.local inside workers.
  requireDevelopmentDatabase();
  const require = createRequire(resolve("package.json"));
  const cli = join(
    dirname(require.resolve("vitest/package.json")),
    "vitest.mjs",
  );
  const result = spawnSync(
    process.execPath,
    [cli, "run", "--config", "vitest.db.config.mts"],
    { stdio: "inherit", env: process.env },
  );
  process.exitCode = result.status ?? 1;
} catch (error: unknown) {
  console.error(
    error instanceof Error &&
      /^(Database command requires|An authorized|Database identity)/.test(
        error.message,
      )
      ? error.message
      : safeDatabaseError(error),
  );
  process.exitCode = 1;
}
