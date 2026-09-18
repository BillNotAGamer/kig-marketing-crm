import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { format } from "prettier";
import { normalizeAuthSchema } from "./normalize-auth-schema";

const require = createRequire(resolve("package.json"));
const cli = join(require.resolve("auth/api"), "..", "index.mjs");
const check = process.argv.includes("--check");
const temp = mkdtempSync(join(tmpdir(), "kig-auth-schema-"));
const output = join(temp, "auth.generated.ts");
try {
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "generate",
      "--config",
      "scripts/auth-schema.config.mts",
      "--adapter",
      "drizzle",
      "--dialect",
      "postgresql",
      "--output",
      output,
      "--yes",
    ],
    {
      stdio: "inherit",
      env: { ...process.env, BETTER_AUTH_TELEMETRY_DISABLED: "1" },
    },
  );
  if (result.status !== 0)
    throw new Error("Better Auth CLI generation failed.");
  const raw = readFileSync(output, "utf8");
  const normalized = await format(normalizeAuthSchema(raw), {
    parser: "typescript",
  });
  const rawPath = "src/db/schema/auth.generated.ts";
  const targetPath = "src/db/schema/auth.ts";
  if (check) {
    if (
      readFileSync(rawPath, "utf8") !== raw ||
      readFileSync(targetPath, "utf8") !== normalized
    ) {
      throw new Error(
        "Auth schema drift detected; regenerate and review the diff.",
      );
    }
    console.log(
      "Better Auth schema regeneration matches both committed artifacts.",
    );
  } else {
    writeFileSync(rawPath, raw);
    writeFileSync(targetPath, normalized);
    console.log(
      "Raw and normalized Better Auth schemas written. Review both files before migration generation.",
    );
  }
} finally {
  const resolvedTemp = resolve(temp);
  if (
    resolve(output) !== join(resolvedTemp, "auth.generated.ts") ||
    resolve(join(resolvedTemp, "..")) !== resolve(tmpdir()) ||
    !resolvedTemp.startsWith(join(resolve(tmpdir()), "kig-auth-schema-"))
  ) {
    throw new Error(
      "Refusing cleanup outside the dedicated auth schema temporary directory.",
    );
  }
  rmSync(resolvedTemp, { recursive: true, force: true });
}
