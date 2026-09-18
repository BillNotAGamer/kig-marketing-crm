import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const origin = new URL(process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000");
if (
  origin.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(origin.hostname)
)
  throw new Error("Browser tests require a local HTTP application origin.");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // All browser contexts share the loopback IP and Better Auth's production rate limit.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: origin.origin,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run start -- --hostname ${origin.hostname} --port ${origin.port || "80"}`,
    url: origin.origin,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
