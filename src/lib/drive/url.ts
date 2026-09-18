import { AccessError } from "../auth/permissions";

const ALLOWED_HOSTS = new Set(["drive.google.com", "docs.google.com"]);
const FILE_ID_REGEX = /^[a-zA-Z0-9_-]{10,120}$/;

export interface ParsedDriveUrl {
  fileId: string;
  resourceKey?: string;
  kind: "file" | "document" | "spreadsheet" | "presentation";
}

export function parseGoogleDriveUrl(rawUrl: string): ParsedDriveUrl {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new AccessError(400, "Google Drive URL is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new AccessError(400, "Malformed Google Drive URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new AccessError(400, "Invalid Google Drive URL: HTTPS is required.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(hostname)) {
    throw new AccessError(
      400,
      "Invalid URL: Only drive.google.com and docs.google.com are supported.",
    );
  }

  const pathname = parsed.pathname;

  // Explicitly reject Google Drive folders
  if (
    pathname.includes("/folders/") ||
    pathname.endsWith("/folders") ||
    parsed.searchParams.get("id")?.startsWith("folders/")
  ) {
    throw new AccessError(
      400,
      "Google Drive folders cannot be attached as task deliverables.",
    );
  }

  const resourceKey =
    parsed.searchParams.get("resourcekey") ||
    parsed.searchParams.get("resourceKey") ||
    undefined;

  let fileId: string | null = null;
  let kind: ParsedDriveUrl["kind"] = "file";

  if (hostname === "drive.google.com") {
    if (pathname.includes("/file/d/")) {
      const parts = pathname.split("/").filter(Boolean);
      const dIndex = parts.indexOf("d");
      if (dIndex !== -1 && dIndex + 1 < parts.length) {
        fileId = parts[dIndex + 1];
      }
    } else if (
      (pathname === "/open" || pathname === "/uc" || pathname === "/") &&
      parsed.searchParams.has("id")
    ) {
      fileId = parsed.searchParams.get("id");
    }
  } else if (hostname === "docs.google.com") {
    const parts = pathname.split("/").filter(Boolean);
    const dIndex = parts.indexOf("d");
    if (dIndex !== -1 && dIndex + 1 < parts.length) {
      fileId = parts[dIndex + 1];
    }
    if (parts[0] === "document") {
      kind = "document";
    } else if (parts[0] === "spreadsheets") {
      kind = "spreadsheet";
    } else if (parts[0] === "presentation") {
      kind = "presentation";
    }
  }

  if (!fileId || !FILE_ID_REGEX.test(fileId)) {
    throw new AccessError(
      400,
      "Could not extract a valid Google Drive file ID from the provided URL.",
    );
  }

  return {
    fileId,
    resourceKey,
    kind,
  };
}
