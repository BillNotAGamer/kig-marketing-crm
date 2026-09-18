import { loadEnvConfig } from "@next/env";
import { serverEnvSchema } from "../src/lib/env-schema";

export function requireDevelopmentDatabase(): string {
  loadEnvConfig(process.cwd());
  if (process.env.KIG_DATABASE_ENV !== "development") {
    throw new Error(
      "Database command requires explicit KIG_DATABASE_ENV=development authorization. Production is not supported by Phase 1 tooling.",
    );
  }
  const result = serverEnvSchema.shape.DATABASE_URL.safeParse(
    process.env.DATABASE_URL,
  );
  if (!result.success)
    throw new Error("An authorized development DATABASE_URL is required.");
  const target = new URL(result.data);
  if (/prod(uction)?/i.test(target.hostname + target.pathname)) {
    throw new Error(
      "Database identity appears to be production; refusing database access.",
    );
  }
  return result.data;
}

export function safeDatabaseError(error: unknown): string {
  // Driver error messages/stacks can contain connection data. Do not echo them.
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]+$/.test(error.code)
      ? ` (${error.code})`
      : "";
  return `Database operation failed${code}; inspect privately without logging credentials.`;
}
