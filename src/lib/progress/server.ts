import "server-only";
import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { progressService } from "./service";
import { progressHttp } from "./http";
export function getProgress() {
  return progressService(getDb(), getServerEnv());
}
export function handleProgress(
  request: Request,
  id: string,
  progressId?: string,
) {
  return progressHttp(
    request,
    getProgress(),
    getServerEnv().BETTER_AUTH_URL,
    id,
    progressId,
  );
}
