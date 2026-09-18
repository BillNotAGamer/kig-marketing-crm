import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { auditLog, task, taskAsset, user } from "../../db/schema";
import { createAuth, type AuthDatabase } from "../auth/factory";
import { AccessError } from "../auth/permissions";
import { authorizedActor } from "../auth/session-core";
import type { ServerEnv } from "../env-schema";
import { classifyMimeType, type DriveClient } from "../drive/types";
import { createGoogleDriveClient } from "../drive/client";
import { parseGoogleDriveUrl } from "../drive/url";
import {
  addAssetSchema,
  canAddAsset,
  canReadAssets,
  canRemoveAsset,
  removeAssetSchema,
  toAssetDTO,
  type TaskAssetDTO,
  type TaskAssetView,
} from "./model";

const administrationLock = sql`SELECT pg_advisory_xact_lock(24091802)`;
const readCoordinationLock = sql`SELECT pg_advisory_xact_lock_shared(24091802)`;

export function assetService(
  db: AuthDatabase,
  env: ServerEnv,
  injectedDriveClient?: DriveClient,
) {
  const drive = injectedDriveClient ?? createGoogleDriveClient(env);

  return {
    async addAsset(
      headers: Headers,
      taskId: string,
      rawInput: unknown,
    ): Promise<TaskAssetDTO> {
      const parsedInput = addAssetSchema.safeParse(rawInput);
      if (!parsedInput.success) {
        throw new AccessError(400, "Invalid asset payload.");
      }

      // Parse and validate the Google Drive URL first
      const parsedUrl = parseGoogleDriveUrl(parsedInput.data.sourceUrl);

      // Retrieve Google Drive metadata OUTSIDE the database transaction
      const metadata = await drive.getFileMetadata(
        parsedUrl.fileId,
        parsedUrl.resourceKey,
      );

      const assetType = classifyMimeType(metadata.mimeType);
      const canonicalSourceUrl =
        metadata.webViewLink ||
        `https://drive.google.com/file/d/${metadata.id}/view`;

      return await db.transaction(async (tx) => {
        await tx.execute(administrationLock);
        const auth = createAuth(tx, env);
        const actor = await authorizedActor(tx, auth, headers);

        const [taskRow] = await tx
          .select()
          .from(task)
          .where(eq(task.id, taskId))
          .for("update");

        if (!taskRow || taskRow.deletedAt !== null) {
          throw new AccessError(404, "Task not found.");
        }

        if (!canAddAsset(actor, taskRow)) {
          throw new AccessError(
            403,
            "Access denied: you are not authorized to attach deliverables to this task.",
          );
        }

        // Check for active duplicate file on this task
        const [existing] = await tx
          .select({ id: taskAsset.id })
          .from(taskAsset)
          .where(
            and(
              eq(taskAsset.taskId, taskId),
              eq(taskAsset.provider, "GOOGLE_DRIVE"),
              eq(taskAsset.providerFileId, metadata.id),
              isNull(taskAsset.deletedAt),
            ),
          );

        if (existing) {
          throw new AccessError(
            409,
            "This Google Drive file is already attached as an active deliverable for this task.",
          );
        }

        const [inserted] = await tx
          .insert(taskAsset)
          .values({
            taskId: taskRow.id,
            createdById: actor.id,
            provider: "GOOGLE_DRIVE",
            providerFileId: metadata.id,
            sourceUrl: canonicalSourceUrl,
            fileName: metadata.name,
            mimeType: metadata.mimeType,
            assetType,
          })
          .returning();

        await tx.insert(auditLog).values({
          actorUserId: actor.id,
          action: "ADD_TASK_ASSET",
          entityType: "TASK_ASSET",
          entityId: inserted.id,
          afterData: {
            taskId: taskRow.id,
            assetId: inserted.id,
            provider: "GOOGLE_DRIVE",
            providerFileId: metadata.id,
            fileName: metadata.name,
            assetType,
            createdById: actor.id,
          },
        });

        const canRemove = canRemoveAsset(actor, taskRow, inserted);
        return toAssetDTO(inserted, actor.name, canRemove);
      });
    },

    async removeAsset(
      headers: Headers,
      taskId: string,
      assetId: string,
      rawInput: unknown,
    ): Promise<void> {
      const parsedInput = removeAssetSchema.safeParse(rawInput);
      if (!parsedInput.success) {
        throw new AccessError(400, "Invalid payload for asset removal.");
      }

      await db.transaction(async (tx) => {
        await tx.execute(administrationLock);
        const auth = createAuth(tx, env);
        const actor = await authorizedActor(tx, auth, headers);

        const [taskRow] = await tx
          .select()
          .from(task)
          .where(eq(task.id, taskId))
          .for("update");

        if (!taskRow || taskRow.deletedAt !== null) {
          throw new AccessError(404, "Task not found.");
        }

        const [assetRow] = await tx
          .select()
          .from(taskAsset)
          .where(
            and(
              eq(taskAsset.id, assetId),
              eq(taskAsset.taskId, taskId),
              isNull(taskAsset.deletedAt),
            ),
          )
          .for("update");

        if (!assetRow) {
          throw new AccessError(404, "Asset not found or already removed.");
        }

        if (!canRemoveAsset(actor, taskRow, assetRow)) {
          throw new AccessError(
            403,
            "Access denied: you are not authorized to remove this deliverable.",
          );
        }

        const now = new Date();
        await tx
          .update(taskAsset)
          .set({
            deletedAt: now,
            deletedById: actor.id,
          })
          .where(eq(taskAsset.id, assetId));

        await tx.insert(auditLog).values({
          actorUserId: actor.id,
          action: "REMOVE_TASK_ASSET",
          entityType: "TASK_ASSET",
          entityId: assetId,
          beforeData: {
            taskId: taskRow.id,
            assetId: assetRow.id,
            provider: assetRow.provider,
            providerFileId: assetRow.providerFileId,
            fileName: assetRow.fileName,
            assetType: assetRow.assetType,
            createdById: assetRow.createdById,
          },
          afterData: {
            deletedAt: now.toISOString(),
            deletedById: actor.id,
          },
        });
      });
    },

    async getTaskAssets(
      headers: Headers,
      taskId: string,
    ): Promise<TaskAssetView> {
      return await db.transaction(async (tx) => {
        await tx.execute(readCoordinationLock);
        const auth = createAuth(tx, env);
        const actor = await authorizedActor(tx, auth, headers);

        const [taskRow] = await tx
          .select({
            id: task.id,
            assignedToId: task.assignedToId,
            status: task.status,
            deletedAt: task.deletedAt,
          })
          .from(task)
          .where(eq(task.id, taskId));

        if (!taskRow || !canReadAssets(actor, taskRow)) {
          throw new AccessError(404, "Task not found.");
        }

        const rows = await tx
          .select({
            asset: taskAsset,
            creatorName: user.name,
          })
          .from(taskAsset)
          .leftJoin(user, eq(taskAsset.createdById, user.id))
          .where(and(eq(taskAsset.taskId, taskId), isNull(taskAsset.deletedAt)))
          .orderBy(asc(taskAsset.createdAt), asc(taskAsset.id));

        const canAdd = canAddAsset(actor, taskRow);
        const assets = rows.map((r) =>
          toAssetDTO(
            r.asset,
            r.creatorName ?? "Unknown",
            canRemoveAsset(actor, taskRow, r.asset),
          ),
        );

        return {
          assets,
          canAdd,
        };
      });
    },
  };
}
