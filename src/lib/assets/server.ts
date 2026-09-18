import "server-only";
import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";
import { assetService } from "./service";
import { assetsHttp } from "./http";

export function getAssets() {
  return assetService(getDb(), getServerEnv());
}

export function handleAssets(
  request: Request,
  taskId: string,
  assetId?: string,
  isRemove = false,
) {
  return assetsHttp(
    request,
    getAssets(),
    getServerEnv().BETTER_AUTH_URL,
    taskId,
    assetId,
    isRemove,
  );
}
