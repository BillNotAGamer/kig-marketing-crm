// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mutationRequestError } from "./http-security";
const origin = "https://crm.example.invalid";
describe("mutation request boundary", () => {
  it.each([
    undefined,
    "https://evil.invalid",
    "http://crm.example.invalid",
    "https://crm.example.invalid.evil.test",
  ])("rejects missing or foreign origin %s", (value) => {
    const headers = new Headers({ "content-type": "application/json" });
    if (value) headers.set("origin", value);
    expect(
      mutationRequestError(
        new Request(origin, { method: "POST", headers }),
        origin,
      )?.status,
    ).toBe(403);
  });
  it("requires JSON and accepts exact origin JSON", () => {
    expect(
      mutationRequestError(
        new Request(origin, { method: "POST", headers: { origin } }),
        origin,
      )?.status,
    ).toBe(415);
    expect(
      mutationRequestError(
        new Request(origin, {
          method: "POST",
          headers: {
            origin,
            "content-type": "application/json; charset=utf-8",
          },
        }),
        origin,
      ),
    ).toBeNull();
  });
});
