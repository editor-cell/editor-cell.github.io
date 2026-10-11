import { test, expect } from "playwright/test";
import { MEDIA } from "../../src/lib/breakpoints.ts";
import { serveFonts } from "./fonts.mjs";

test.beforeEach(async ({ page }) => serveFonts(page));

for (const width of [767, 767.5, 768]) {
  test(`CSS and JS select one layout in a ${width}px iframe`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route("http://127.0.0.1:4179/iframe-host", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><html><body></body></html>",
      }),
    );
    await page.goto("http://127.0.0.1:4179/iframe-host");
    await page.setContent(
      `<iframe src="/" style="width:${width}px;height:844px;border:0"></iframe>`,
    );
    const iframe = page.locator("iframe");
    expect((await iframe.boundingBox()).width).toBe(width);
    const frame = page.frames().find((item) => item.parentFrame());
    await expect(frame.locator(".atlas-top")).toBeVisible();
    const state = await frame.evaluate((media) => {
      const probe = document.createElement("div");
      probe.className = "hidden md:block";
      document.body.append(probe);
      const result = {
        phone: matchMedia(media.phone).matches,
        desktop: matchMedia(media.desktop).matches,
        utility: getComputedStyle(probe).display,
        card: getComputedStyle(document.querySelector(".atlas-card > .atlas-text")).display,
      };
      probe.remove();
      return result;
    }, MEDIA);
    // Chromium rounds an iframe's 767.5px CSS box to a 768px media viewport.
    // Either full layout is valid; a gap or a CSS/JS disagreement is not.
    expect(state.phone).not.toBe(state.desktop);
    if (width !== 767.5) expect(state.phone).toBe(width < 768);
    const phone = state.phone;
    console.log(`[width] ${width}px iframe: ${phone ? "phone" : "desktop"}, CSS and JS agree`);
    expect(state).toEqual({
      phone,
      desktop: !phone,
      utility: phone ? "none" : "block",
      card: phone ? "contents" : "flex",
    });
  });
}

test("the original two-column strip lasts through 800px, then opens to four", async ({ page }) => {
  for (const width of [768, 780, 800, 801]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("http://127.0.0.1:4179/");
    // The frozen issue has no strip. Exercise its real CSS without changing content.
    const columns = await page.evaluate(() => {
      const strip = document.createElement("ol");
      strip.className = "atlas-strip";
      document.body.append(strip);
      const count = getComputedStyle(strip).gridTemplateColumns.split(" ").length;
      strip.remove();
      return count;
    });
    expect(columns).toBe(width < 801 ? 2 : 4);
  }
});
