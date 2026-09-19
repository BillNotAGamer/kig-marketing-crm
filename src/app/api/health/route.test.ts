// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readiness } from "./route";
describe("readiness endpoint", () => {
  it("returns minimal no-store readiness", async () => {
    const response = await readiness({
      execute: vi.fn().mockResolvedValue([]),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ready" });
  });
  it("sanitizes database failure", async () => {
    const response = await readiness({
      execute: vi
        .fn()
        .mockRejectedValue(new Error("postgres://secret@host/db")),
    });
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("postgres");
  });
});
