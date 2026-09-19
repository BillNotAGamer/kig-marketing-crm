import "server-only";
import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { auditService } from "./service";

export function getAudit() {
  return auditService(getDb(), getServerEnv());
}
