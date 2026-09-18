import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import { authOptions } from "./auth/options";

function createAuth() {
  const env = getServerEnv();
  return betterAuth({
    ...authOptions,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
      transaction: true,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
// No external HTTP auth handler is exposed in Phase 1.
