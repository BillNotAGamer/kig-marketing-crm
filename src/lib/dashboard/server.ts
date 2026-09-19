import "server-only";
import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { dashboardService } from "./service";

export function getDashboard() {
  return dashboardService(getDb(), getServerEnv());
}
