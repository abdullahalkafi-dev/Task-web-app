import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  workers: 1,
  use: { baseURL: "http://localhost:3100", screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "node ../frontend/e2e/stack.mjs", url: "http://localhost:3100/api/health", timeout: 120_000, reuseExistingServer: false },
});
