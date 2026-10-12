import { defineConfig } from "playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  globalSetup: "./tests/browser/fonts.mjs",
  fullyParallel: true,
  workers: 4,
  timeout: 45000,
  retries: 0,
  outputDir: "artifacts/browser",
  reporter: [["list"], ["html", { outputFolder: "artifacts/browser-report", open: "never" }]],
  use: {
    browserName: "chromium",
    ignoreHTTPSErrors: Boolean(process.env.ORBIS_BROWSER_PROXY),
    locale: "en-GB",
    timezoneId: "UTC",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    proxy: process.env.ORBIS_BROWSER_PROXY
      ? { server: new URL(process.env.ORBIS_BROWSER_PROXY).origin, bypass: "127.0.0.1,localhost" }
      : undefined,
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
