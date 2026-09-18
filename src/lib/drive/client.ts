import { JWT } from "google-auth-library";
import { AccessError } from "../auth/permissions";
import type { ServerEnv } from "../env-schema";
import type { DriveClient, DriveMetadata } from "./types";

const DRIVE_METADATA_SCOPE =
  "https://www.googleapis.com/auth/drive.metadata.readonly";

function normalizePrivateKey(rawKey: string): string {
  let key = rawKey.replace(/\\n/g, "\n").trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).replace(/\\n/g, "\n").trim();
  }
  if (!key.includes("-----BEGIN PRIVATE KEY-----")) {
    key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----\n`;
  }
  return key;
}

const DEFAULT_DEV_FILES: Record<string, Partial<DriveMetadata>> = {
  "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms": {
    name: "Brand Guidelines 2026.pdf",
    mimeType: "application/pdf",
    webViewLink:
      "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view",
  },
  "file-doc-1": {
    name: "Q3 Campaign Brief.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    webViewLink: "https://docs.google.com/document/d/file-doc-1/edit",
  },
  "file-sheet-1": {
    name: "Marketing Spend.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    webViewLink: "https://docs.google.com/spreadsheets/d/file-sheet-1/edit",
  },
  "file-image-1": {
    name: "Hero Banner.png",
    mimeType: "image/png",
    webViewLink: "https://drive.google.com/file/d/file-image-1/view",
  },
  "file-video-1": {
    name: "Campaign Video.mp4",
    mimeType: "video/mp4",
    webViewLink: "https://drive.google.com/file/d/file-video-1/view",
  },
  "file-pdf-1": {
    name: "Q3 Results.pdf",
    mimeType: "application/pdf",
    webViewLink: "https://drive.google.com/file/d/file-pdf-1/view",
  },
  "file-trashed-1": {
    name: "Old Draft.pdf",
    mimeType: "application/pdf",
    trashed: true,
  },
  "file-folder-1": {
    name: "Assets Folder",
    mimeType: "application/vnd.google-apps.folder",
  },
};

export class GoogleDriveApiClient implements DriveClient {
  private client: JWT | null = null;
  private sharedDriveId?: string;

  constructor(env: ServerEnv) {
    this.sharedDriveId = env.GOOGLE_DRIVE_SHARED_DRIVE_ID;
    if (
      env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL &&
      env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY
    ) {
      const privateKey = normalizePrivateKey(
        env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY,
      );
      this.client = new JWT({
        email: env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: [DRIVE_METADATA_SCOPE],
      });
    }
  }

  async getFileMetadata(
    fileId: string,
    resourceKey?: string,
  ): Promise<DriveMetadata> {
    if (
      process.env.KIG_DATABASE_ENV === "development" &&
      fileId in DEFAULT_DEV_FILES
    ) {
      const devFile = DEFAULT_DEV_FILES[fileId];
      if (devFile.trashed) {
        throw new AccessError(
          400,
          "The requested Google Drive file has been trashed.",
        );
      }
      if (devFile.mimeType === "application/vnd.google-apps.folder") {
        throw new AccessError(
          400,
          "Google Drive folders cannot be attached as task deliverables.",
        );
      }
      return {
        id: fileId,
        name: devFile.name ?? `Document-${fileId}`,
        mimeType: devFile.mimeType ?? "application/pdf",
        webViewLink:
          devFile.webViewLink ??
          `https://drive.google.com/file/d/${fileId}/view`,
        resourceKey,
        driveId: devFile.driveId,
        trashed: false,
      };
    }

    if (!this.client) {
      throw new AccessError(
        503,
        "Google Drive integration is not configured with service account credentials.",
      );
    }

    const params = new URLSearchParams({
      fields: "id,name,mimeType,webViewLink,resourceKey,driveId,trashed",
      supportsAllDrives: "true",
    });

    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`;

    const headers: Record<string, string> = {};
    if (resourceKey) {
      headers["X-Goog-Drive-Resource-Keys"] = `${fileId}/${resourceKey}`;
    }

    try {
      const response = await this.client.request<DriveMetadata>({
        url,
        method: "GET",
        headers,
      });

      const data = response.data;

      if (!data || !data.id) {
        throw new AccessError(
          404,
          "Google Drive file not found or inaccessible.",
        );
      }

      if (data.trashed) {
        throw new AccessError(
          400,
          "The requested Google Drive file has been trashed.",
        );
      }

      if (data.mimeType === "application/vnd.google-apps.folder") {
        throw new AccessError(
          400,
          "Google Drive folders cannot be attached as task deliverables.",
        );
      }

      if (this.sharedDriveId && data.driveId !== this.sharedDriveId) {
        throw new AccessError(
          403,
          "The requested file does not belong to the authorized Shared Drive.",
        );
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof AccessError) {
        throw error;
      }

      // Check HTTP status code from Google API error response without logging raw credentials
      const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status: unknown }).status === "number"
          ? (error as { status: number }).status
          : undefined;

      if (status === 404) {
        throw new AccessError(
          404,
          "Google Drive file not found or inaccessible to the service account.",
        );
      }

      if (status === 403) {
        throw new AccessError(
          403,
          "Permission denied: the service account cannot access this Google Drive file.",
        );
      }

      throw new AccessError(
        503,
        "Failed to retrieve Google Drive file metadata. Please verify the URL and permissions.",
      );
    }
  }
}

export class MockDriveClient implements DriveClient {
  private files = new Map<string, DriveMetadata>();
  private sharedDriveId?: string;

  constructor(
    initialFiles?: Record<string, Partial<DriveMetadata>>,
    sharedDriveId?: string,
  ) {
    this.sharedDriveId = sharedDriveId;
    if (initialFiles) {
      for (const [id, meta] of Object.entries(initialFiles)) {
        this.registerFile(id, meta);
      }
    }
  }

  registerFile(id: string, metadata: Partial<DriveMetadata>) {
    this.files.set(id, {
      id,
      name: metadata.name ?? `Document-${id}`,
      mimeType: metadata.mimeType ?? "application/pdf",
      webViewLink:
        metadata.webViewLink ?? `https://drive.google.com/file/d/${id}/view`,
      resourceKey: metadata.resourceKey,
      driveId: metadata.driveId,
      trashed: metadata.trashed ?? false,
    });
  }

  async getFileMetadata(
    fileId: string,
    resourceKey?: string,
  ): Promise<DriveMetadata> {
    if (fileId.startsWith("not-found") || fileId.includes("not-found")) {
      throw new AccessError(
        404,
        "Google Drive file not found or inaccessible to the service account.",
      );
    }

    let file = this.files.get(fileId);
    if (!file) {
      // In development fixture mode, generate a mock deliverable for arbitrary valid IDs
      file = {
        id: fileId,
        name: `Deliverable-${fileId.slice(0, 8)}.pdf`,
        mimeType: "application/pdf",
        webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
        trashed: false,
      };
    }

    if (file.trashed) {
      throw new AccessError(
        400,
        "The requested Google Drive file has been trashed.",
      );
    }

    if (file.mimeType === "application/vnd.google-apps.folder") {
      throw new AccessError(
        400,
        "Google Drive folders cannot be attached as task deliverables.",
      );
    }

    if (this.sharedDriveId && file.driveId !== this.sharedDriveId) {
      throw new AccessError(
        403,
        "The requested file does not belong to the authorized Shared Drive.",
      );
    }

    return {
      ...file,
      resourceKey: resourceKey ?? file.resourceKey,
    };
  }
}

export function createGoogleDriveClient(env: ServerEnv): DriveClient {
  if (
    env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL &&
    env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY
  ) {
    return new GoogleDriveApiClient(env);
  }
  if (process.env.KIG_DATABASE_ENV === "development") {
    return new MockDriveClient(
      DEFAULT_DEV_FILES,
      env.GOOGLE_DRIVE_SHARED_DRIVE_ID,
    );
  }
  return new GoogleDriveApiClient(env);
}
