import { vi, describe, it, expect } from "vitest";

vi.mock("next/font/google", () => ({
  Quicksand: () => ({ variable: "--font-quicksand" }),
}));

import { metadata } from "./layout";

describe("Root Layout Metadata", () => {
  it("defines canonical title and description without development wording", () => {
    expect(metadata.title).toBe("KIG Marketing CRM");
    expect(metadata.description).toBe(
      "Internal Marketing task-management CRM for KIG Holding.",
    );
    expect(JSON.stringify(metadata)).not.toContain("Phase 0");
    expect(JSON.stringify(metadata)).not.toContain("foundation");
  });

  it("configures official SVG logo as favicon and shortcut", () => {
    expect(metadata.icons).toEqual({
      icon: "/images/kig-no-bg-logo.svg",
      shortcut: "/images/kig-no-bg-logo.svg",
    });
  });
});
