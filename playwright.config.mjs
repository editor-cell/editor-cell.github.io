import { defineConfig } from "playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: true,
  workers: 4,
  timeout: 45000,
  retries: 0,
  outputDir: "artifacts/browser",
  reporter: [["list"], ["html", { outputFolder: "artifacts/browser-report", open: "never" }]],
  snapshotPathTemplate: "{testDir}/../visual-reference/{arg}{ext}",
  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", threshold: 0, maxDiffPixels: 0 },
  },
  use: {
    browserName: "chromium",
    locale: "en-GB",
    timezoneId: "UTC",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    launchOptions: process.env.ORBIS_CHROMIUM
      ? {
          executablePath: process.env.ORBIS_CHROMIUM,
          args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--no-zygote"],
        }
      : {},
  },
  webServer: [
    {
      command: `node scripts/site-server.mjs "${process.env.ORBIS_READER_ROOT ?? "dist/client"}" 4179`,
      url: "http://127.0.0.1:4179",
      reuseExistingServer: false,
    },
    {
      command: `node scripts/site-server.mjs "${process.env.ORBIS_VISUAL_ROOT ?? "dist/client"}" 4180`,
      url: "http://127.0.0.1:4180",
      reuseExistingServer: false,
    },
  ],
});
