import "dotenv/config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testIgnore: ["**/unit/**", "**/integration/**"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: process.env.PLAYWRIGHT_CHANNEL === "chromium" ? undefined : "chrome",
    headless: true,
    actionTimeout: 15000,
    trace: "off",
    screenshot: "off",
  },
});
