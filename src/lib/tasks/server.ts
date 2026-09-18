import "server-only";
import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { taskService } from "./service";
import { tasksHttp } from "./http";

export function getTasks() {
  return taskService(getDb(), getServerEnv());
}
export function handleTasks(request: Request, id?: string, command?: string) {
  const env = getServerEnv();
  return tasksHttp(request, getTasks(), env.BETTER_AUTH_URL, id, command);
}
