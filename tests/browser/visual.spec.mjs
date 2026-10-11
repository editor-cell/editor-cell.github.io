import { test, expect } from "playwright/test";
import { serveFonts } from "./fonts.mjs";
test.beforeEach(async ({ page }) => serveFonts(page));

for (const lang of ["en", "tr"]) {
  for (const width of [390, 1280]) {
    for (const look of ["classic", "bordo", "night", "kahve"]) {
      for (const [pageName, path, depths] of [
        ["home", "/", [1, 2, 3]],
        ["section", "/health", [2]],
        ["reading", "/read/carbon-books", [2]],
      ]) {
        for (const depth of depths) {
          test(`${lang} ${width} ${look} ${pageName} depth ${depth}`, async ({ page }) => {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
            await page.clock.setFixedTime(new Date("2026-10-11T12:00:00Z"));
            await page.addInitScript(
              ({ look, depth }) => {
                localStorage.setItem("orbis-look", look);
                localStorage.setItem("orbis-depth", String(depth));
              },
              { look, depth },
            );
            await page.goto(`http://127.0.0.1:4180${lang === "tr" ? "/tr" : ""}${path}`);
            await page.evaluate(async () => {
              await document.fonts.load('16px "Bodoni Moda"');
              await document.fonts.ready;
            });
            expect(
              await page.evaluate(() =>
                [...document.fonts].some(
                  (font) => font.family === "Bodoni Moda" && font.status === "loaded",
                ),
              ),
            ).toBe(true);
            await expect(page.locator("html")).toHaveAttribute("lang", lang);
            if (pageName === "home") {
              await page.locator(`[data-depth-step="${depth}"]`).click();
              await expect(page.locator(".atlas-top")).toHaveAttribute("data-depth", String(depth));
            }
            await page.evaluate(async () => {
              for (const image of document.images) image.loading = "eager";
              await Promise.all(
                [...document.images].map((image) => image.decode().catch(() => {})),
              );
            });
            await page.waitForTimeout(400);
            await expect(page).toHaveScreenshot(
              `${lang}-${width}-${look}-${pageName}-${depth}.png`,
              { fullPage: true },
            );
          });
        }
      }
    }
  }
}
