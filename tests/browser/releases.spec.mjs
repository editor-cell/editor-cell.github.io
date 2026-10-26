import { test, expect } from "playwright/test";
import { serveFonts } from "./fonts.mjs";
test.beforeEach(async ({ page }) => serveFonts(page));
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { placeSite } from "../../scripts/publish-output.mjs";
import { siteServer } from "../../scripts/site-server.mjs";

test.describe.configure({ mode: "serial" });

for (const retain of [true, false]) {
  test(`an open A tab reaches another reading after B: retain=${retain}`, async ({
    page,
  }, info) => {
    const root = resolve("artifacts/release-tests", info.testId);
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root, { recursive: true });
    placeSite(process.env.ORBIS_RELEASE_A, root);
    const server = siteServer(root);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const documents = [];
      // A superseded navigation can be aborted by the router; count completed
      // documents, so one displayed reload is not mistaken for two.
      page.on("requestfinished", (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame())
          documents.push(new URL(request.url()).pathname);
      });
      await page.goto(base + "/");
      await page.waitForFunction(() => !("$_TSR" in self));
      placeSite(process.env.ORBIS_RELEASE_B, root);
      if (!retain)
        for (const path of JSON.parse(readFileSync(resolve(root, ".site-output.json"))).retained)
          rmSync(resolve(root, path));
      await page.locator('button[aria-controls="site-menu"]').click();
      await page.locator('#site-menu a[href="/health"]').click();
      await expect(page).toHaveURL(base + "/health");
      // Without the old code the tab reloads itself once; a click made while that reload is
      // still under way is lost, so the reader (and this test) clicks once it has finished.
      if (!retain) await expect.poll(() => documents.length).toBe(2);
      await page.waitForLoadState("networkidle");
      await page.locator('main a[href="/read/bread-and-diabetes"]:visible').first().click();
      await expect(page).toHaveURL(base + "/read/bread-and-diabetes");
      const story = JSON.parse(readFileSync("tests/fixtures/stories/bread-and-diabetes.json"));
      await expect(page.locator("h1")).toHaveText(story.locales.en.title);
      expect(documents.length).toBeLessThanOrEqual(2);
      if (retain) expect(documents).toEqual(["/"]);
      else expect(documents.length).toBe(2);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
}

test("permanently missing entry scripts reload just once", async ({ page }) => {
  let navigations = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
  });
  await page.route("**/assets/*.js", (route) =>
    route.fulfill({ status: 404, contentType: "text/html", body: "Missing script" }),
  );
  await page.goto("http://127.0.0.1:4179/read/carbon-books").catch(() => {});
  await expect.poll(() => navigations).toBe(2);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
    window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
  });
  await page.waitForTimeout(500);
  expect(navigations).toBe(2);
});
