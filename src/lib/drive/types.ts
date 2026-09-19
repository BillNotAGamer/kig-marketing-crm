export type TaskAssetType =
  | "IMAGE"
  | "VIDEO"
  | "DOCUMENT"
  | "SPREADSHEET"
  | "PRESENTATION"
  | "PDF"
  | "OTHER";

export type TaskAssetProvider = "GOOGLE_DRIVE";

export interface DriveMetadata {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  resourceKey?: string;
  driveId?: string;
  trashed?: boolean;
  parents?: string[];
}

export interface DriveClient {
  getFileMetadata(fileId: string, resourceKey?: string): Promise<DriveMetadata>;
}

export function classifyMimeType(mimeType?: string | null): TaskAssetType {
  if (!mimeType) return "OTHER";
  const lower = mimeType.toLowerCase().trim();
  if (lower.startsWith("image/")) return "IMAGE";
  if (lower.startsWith("video/")) return "VIDEO";
  if (lower === "application/pdf") return "PDF";
  if (
    lower === "application/vnd.google-apps.spreadsheet" ||
    lower === "application/vnd.ms-excel" ||
    lower ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    lower === "text/csv"
  ) {
    return "SPREADSHEET";
  }
  if (
    lower === "application/vnd.google-apps.document" ||
    lower === "application/msword" ||
    lower ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.startsWith("text/") ||
    lower === "application/rtf"
  ) {
    return "DOCUMENT";
  }
  if (
    lower === "application/vnd.google-apps.presentation" ||
    lower === "application/vnd.ms-powerpoint" ||
    lower ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "PRESENTATION";
  }
  return "OTHER";
}

export function buildPreviewUrl(
  fileId: string,
  assetType: TaskAssetType,
  resourceKey?: string,
): string {
  let baseUrl: string;
  switch (assetType) {
    case "DOCUMENT":
      baseUrl = `https://docs.google.com/document/d/${encodeURIComponent(fileId)}/preview`;
      break;
    case "SPREADSHEET":
      baseUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(fileId)}/preview`;
      break;
    case "PRESENTATION":
      baseUrl = `https://docs.google.com/presentation/d/${encodeURIComponent(fileId)}/preview`;
      break;
    default:
      baseUrl = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
      break;
  }
  if (resourceKey) {
    const url = new URL(baseUrl);
    url.searchParams.set("resourcekey", resourceKey);
    return url.toString();
  }
  return baseUrl;
}

export function buildOpenUrl(
  fileId: string,
  assetType: TaskAssetType,
  resourceKey?: string,
): string {
  let baseUrl: string;
  switch (assetType) {
    case "DOCUMENT":
      baseUrl = `https://docs.google.com/document/d/${encodeURIComponent(fileId)}/edit`;
      break;
    case "SPREADSHEET":
      baseUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(fileId)}/edit`;
      break;
    case "PRESENTATION":
      baseUrl = `https://docs.google.com/presentation/d/${encodeURIComponent(fileId)}/edit`;
      break;
    default:
      baseUrl = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
      break;
  }
  if (resourceKey) {
    const url = new URL(baseUrl);
    url.searchParams.set("resourcekey", resourceKey);
    return url.toString();
  }
  return baseUrl;
}
