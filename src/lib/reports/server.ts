import "server-only";
import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { reportsService } from "./service";

export function getReports() {
  return reportsService(getDb(), getServerEnv());
}
