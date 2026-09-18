import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/db/**/*.integration.ts"],
    fileParallelism: false,
    // Multi-step auth tests include real network roundtrips and password hashing.
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});
