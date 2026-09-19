// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseServerEnv, serverEnvSchema } from "./env-schema";

describe("private server environment validation", () => {
  it("requires all three server variables without emitting values", () => {
    expect(() => parseServerEnv({})).toThrow(
      "DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, KIG_DATABASE_ENV",
    );
    const privateValue = "do-not-echo-this-rejected-value";
    try {
      parseServerEnv({
        DATABASE_URL: privateValue,
        BETTER_AUTH_SECRET: privateValue,
        BETTER_AUTH_URL: privateValue,
        KIG_DATABASE_ENV: "development",
      });
      throw new Error("Expected validation failure");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(privateValue);
      expect((error as Error).message).toContain(
        "Invalid or missing server environment",
      );
    }
  });
  it("rejects non-PostgreSQL connection protocols and short auth secrets", () => {
    expect(
      serverEnvSchema.shape.DATABASE_URL.safeParse("https://example.invalid")
        .success,
    ).toBe(false);
    expect(
      serverEnvSchema.shape.BETTER_AUTH_SECRET.safeParse("short").success,
    ).toBe(false);
    expect(
      Object.keys(serverEnvSchema.shape).some((key) =>
        key.startsWith("NEXT_PUBLIC_"),
      ),
    ).toBe(false);
  });
});
