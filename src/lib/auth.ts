import "server-only";
import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { createAuth } from "./auth/factory";
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth(getDb(), getServerEnv()));
}
