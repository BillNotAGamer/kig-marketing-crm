import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { authOptions } from "../src/lib/auth/options";

// CLI-only instance: no DB, URL, handler route or reusable secret.
// --adapter drizzle --dialect postgresql is the supported offline generator mode.
export const auth = betterAuth({
  ...authOptions,
  secret: randomBytes(32).toString("base64url"),
});
