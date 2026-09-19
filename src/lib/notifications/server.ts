import "server-only";
import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { notificationsService } from "./service";

export function getNotifications() {
  return notificationsService(getDb(), getServerEnv());
}
