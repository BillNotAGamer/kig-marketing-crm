import { z } from "zod";
import type { Actor } from "../auth/session-core";
import { permitsTask } from "../tasks/policy";
import type { TaskAsset } from "../../db/schema/task-assets";
import {
  buildOpenUrl,
  buildPreviewUrl,
  type TaskAssetType,
} from "../drive/types";

export const addAssetSchema = z
  .object({
    sourceUrl: z.string().trim().min(1).max(2048),
  })
  .strict();

export const removeAssetSchema = z.object({}).strict();

export function canAddAsset(
  actor: Actor,
  task: { assignedToId: string; status: string; deletedAt: Date | null },
): boolean {
  if (task.deletedAt !== null) return false;
  if (actor.role === "HEAD") return true;
  return task.status === "OPEN" && task.assignedToId === actor.id;
}

export function canRemoveAsset(
  actor: Actor,
  task: { assignedToId: string; status: string; deletedAt: Date | null },
  asset: { createdById: string; deletedAt: Date | null },
): boolean {
  if (task.deletedAt !== null || asset.deletedAt !== null) return false;
  if (actor.role === "HEAD") return true;
  return (
    task.status === "OPEN" &&
    task.assignedToId === actor.id &&
    asset.createdById === actor.id
  );
}

export function canReadAssets(
  actor: Actor,
  task: { assignedToId: string; deletedAt: Date | null },
): boolean {
  return (
    task.deletedAt === null &&
    (permitsTask(actor.role, "task:read-team") ||
      task.assignedToId === actor.id)
  );
}

export interface TaskAssetDTO {
  id: string;
  taskId: string;
  provider: "GOOGLE_DRIVE";
  providerFileId: string;
  sourceUrl: string;
  fileName: string | null;
  mimeType: string | null;
  assetType: TaskAssetType;
  previewUrl: string;
  openUrl: string;
  createdAt: string;
  createdById: string;
  createdByName: string;
  canRemove: boolean;
}

export function toAssetDTO(
  asset: TaskAsset,
  creatorName: string,
  canRemove: boolean,
): TaskAssetDTO {
  return {
    id: asset.id,
    taskId: asset.taskId,
    provider: "GOOGLE_DRIVE",
    providerFileId: asset.providerFileId,
    sourceUrl: asset.sourceUrl,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    assetType: asset.assetType,
    previewUrl: buildPreviewUrl(asset.providerFileId, asset.assetType),
    openUrl: buildOpenUrl(asset.providerFileId, asset.assetType),
    createdAt: asset.createdAt.toISOString(),
    createdById: asset.createdById,
    createdByName: creatorName,
    canRemove,
  };
}

export interface TaskAssetView {
  assets: TaskAssetDTO[];
  canAdd: boolean;
}
