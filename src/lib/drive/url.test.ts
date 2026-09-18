import { describe, expect, it } from "vitest";
import { parseGoogleDriveUrl } from "./url";
import { buildOpenUrl, buildPreviewUrl, classifyMimeType } from "./types";

describe("Google Drive URL parsing and validation", () => {
  it("parses valid drive.google.com/file/d/ URLs", () => {
    const parsed = parseGoogleDriveUrl(
      "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing",
    );
    expect(parsed.fileId).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms");
    expect(parsed.kind).toBe("file");
  });

  it("parses drive.google.com/open?id= URLs", () => {
    const parsed = parseGoogleDriveUrl(
      "https://drive.google.com/open?id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    );
    expect(parsed.fileId).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms");
    expect(parsed.kind).toBe("file");
  });

  it("parses Google Docs, Sheets, and Slides URLs", () => {
    const doc = parseGoogleDriveUrl(
      "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?tab=t.0",
    );
    expect(doc.fileId).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms");
    expect(doc.kind).toBe("document");

    const sheet = parseGoogleDriveUrl(
      "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0",
    );
    expect(sheet.fileId).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms");
    expect(sheet.kind).toBe("spreadsheet");

    const slide = parseGoogleDriveUrl(
      "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing",
    );
    expect(slide.fileId).toBe("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms");
    expect(slide.kind).toBe("presentation");
  });

  it("extracts resourcekey when present", () => {
    const parsed = parseGoogleDriveUrl(
      "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?resourcekey=0-AbCdEf12345",
    );
    expect(parsed.resourceKey).toBe("0-AbCdEf12345");
  });

  it("rejects non-Google and spoofed hosts", () => {
    expect(() =>
      parseGoogleDriveUrl(
        "https://drive.google.com.attacker.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view",
      ),
    ).toThrow(/Only drive\.google\.com and docs\.google\.com are supported/);

    expect(() =>
      parseGoogleDriveUrl(
        "https://evil-site.example/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      ),
    ).toThrow(/Only drive\.google\.com and docs\.google\.com are supported/);
  });

  it("rejects non-HTTPS protocols", () => {
    expect(() =>
      parseGoogleDriveUrl(
        "http://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view",
      ),
    ).toThrow(/HTTPS is required/);

    expect(() => parseGoogleDriveUrl("javascript:alert('xss')")).toThrow();
  });

  it("rejects Google Drive folder URLs", () => {
    expect(() =>
      parseGoogleDriveUrl(
        "https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      ),
    ).toThrow(/folders cannot be attached/);

    expect(() =>
      parseGoogleDriveUrl(
        "https://drive.google.com/drive/u/0/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      ),
    ).toThrow(/folders cannot be attached/);
  });

  it("rejects invalid, empty, or malformed file IDs", () => {
    expect(() =>
      parseGoogleDriveUrl("https://drive.google.com/file/d//view"),
    ).toThrow(/valid Google Drive file ID/);

    expect(() =>
      parseGoogleDriveUrl("https://drive.google.com/open?id=short"),
    ).toThrow(/valid Google Drive file ID/);

    expect(() => parseGoogleDriveUrl("not-a-url")).toThrow(/Malformed/);
    expect(() => parseGoogleDriveUrl("   ")).toThrow(/required/);
  });
});

describe("MIME type classification", () => {
  it("classifies images, videos, and PDFs", () => {
    expect(classifyMimeType("image/png")).toBe("IMAGE");
    expect(classifyMimeType("image/jpeg")).toBe("IMAGE");
    expect(classifyMimeType("image/webp")).toBe("IMAGE");
    expect(classifyMimeType("video/mp4")).toBe("VIDEO");
    expect(classifyMimeType("video/quicktime")).toBe("VIDEO");
    expect(classifyMimeType("application/pdf")).toBe("PDF");
  });

  it("classifies Google Docs and standard document formats", () => {
    expect(classifyMimeType("application/vnd.google-apps.document")).toBe(
      "DOCUMENT",
    );
    expect(
      classifyMimeType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("DOCUMENT");
    expect(classifyMimeType("application/msword")).toBe("DOCUMENT");
    expect(classifyMimeType("text/plain")).toBe("DOCUMENT");
  });

  it("classifies Google Sheets and standard spreadsheets", () => {
    expect(classifyMimeType("application/vnd.google-apps.spreadsheet")).toBe(
      "SPREADSHEET",
    );
    expect(
      classifyMimeType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe("SPREADSHEET");
    expect(classifyMimeType("text/csv")).toBe("SPREADSHEET");
  });

  it("classifies Google Slides and presentations", () => {
    expect(classifyMimeType("application/vnd.google-apps.presentation")).toBe(
      "PRESENTATION",
    );
    expect(classifyMimeType("application/vnd.ms-powerpoint")).toBe(
      "PRESENTATION",
    );
    expect(
      classifyMimeType(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    ).toBe("PRESENTATION");
  });

  it("falls back to OTHER for unknown/binary types or empty input", () => {
    expect(classifyMimeType("application/octet-stream")).toBe("OTHER");
    expect(classifyMimeType("application/zip")).toBe("OTHER");
    expect(classifyMimeType(null)).toBe("OTHER");
    expect(classifyMimeType(undefined)).toBe("OTHER");
  });
});

describe("Preview and Open URL generation", () => {
  const fileId = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms";

  it("generates correct preview URL for documents, sheets, slides, and files", () => {
    expect(buildPreviewUrl(fileId, "DOCUMENT")).toBe(
      `https://docs.google.com/document/d/${fileId}/preview`,
    );
    expect(buildPreviewUrl(fileId, "SPREADSHEET")).toBe(
      `https://docs.google.com/spreadsheets/d/${fileId}/preview`,
    );
    expect(buildPreviewUrl(fileId, "PRESENTATION")).toBe(
      `https://docs.google.com/presentation/d/${fileId}/preview`,
    );
    expect(buildPreviewUrl(fileId, "IMAGE")).toBe(
      `https://drive.google.com/file/d/${fileId}/preview`,
    );
    expect(buildPreviewUrl(fileId, "VIDEO")).toBe(
      `https://drive.google.com/file/d/${fileId}/preview`,
    );
    expect(buildPreviewUrl(fileId, "PDF")).toBe(
      `https://drive.google.com/file/d/${fileId}/preview`,
    );
  });

  it("preserves resourcekey in preview and open URLs", () => {
    const preview = buildPreviewUrl(fileId, "IMAGE", "0-resourceKey123");
    expect(preview).toContain("resourcekey=0-resourceKey123");

    const open = buildOpenUrl(fileId, "DOCUMENT", "0-resourceKey123");
    expect(open).toContain("resourcekey=0-resourceKey123");
  });
});
