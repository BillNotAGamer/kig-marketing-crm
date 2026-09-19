// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";
import { createGoogleDriveClient } from "./drive/client";

describe("production security policy", () => {
  it("sets restrictive global headers while allowing approved Drive frames", async () => {
    const rules = await nextConfig.headers!();
    const headers = Object.fromEntries(
      rules[0].headers.map((h) => [h.key, h.value]),
    );
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["Content-Security-Policy"]).toContain(
      "https://drive.google.com",
    );
    expect(headers["Content-Security-Policy"]).not.toContain(" *");
  });
  it("rejects unsafe production URL and placeholder secret", async () => {
    const { parseServerEnv } = await import("./env-schema");
    expect(() =>
      parseServerEnv({
        DATABASE_URL: "postgres://localhost/db",
        BETTER_AUTH_SECRET: "change-me-development-secret-value",
        BETTER_AUTH_URL: "http://localhost:3000",
        KIG_DATABASE_ENV: "production",
      }),
    ).toThrow();
  });
  it("requires complete bounded Drive configuration in production", async () => {
    const { parseServerEnv } = await import("./env-schema");
    const base = {
      DATABASE_URL: "postgres://localhost/db",
      BETTER_AUTH_SECRET: "a".repeat(40),
      BETTER_AUTH_URL: "https://crm.example.invalid",
      KIG_DATABASE_ENV: "production",
    } as const;
    expect(() =>
      parseServerEnv({
        ...base,
        GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: "service@example.invalid",
        GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY: "private",
      }),
    ).toThrow();
    expect(
      parseServerEnv({
        ...base,
        GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: "service@example.invalid",
        GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY: "private",
        GOOGLE_DRIVE_ALLOWED_FOLDER_ID: "folder_123",
      }).GOOGLE_DRIVE_ALLOWED_FOLDER_ID,
    ).toBe("folder_123");
  });
  it("never falls back to the mock outside development", async () => {
    vi.stubEnv("KIG_DATABASE_ENV", "production");
    const client = createGoogleDriveClient({
      DATABASE_URL: "postgres://localhost/db",
      BETTER_AUTH_SECRET: "a".repeat(40),
      BETTER_AUTH_URL: "https://crm.example.invalid",
      KIG_DATABASE_ENV: "production",
    });
    await expect(client.getFileMetadata("file_123")).rejects.toMatchObject({
      status: 503,
    });
    vi.unstubAllEnvs();
  });
});
