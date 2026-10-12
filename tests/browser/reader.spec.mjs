import { test, expect } from "playwright/test";
import { serveFonts } from "./fonts.mjs";
test.beforeEach(async ({ page }) => serveFonts(page));

/** Opens a page and waits until it has taken over from the written-out HTML, so a tap
 * right after loading is not lost (TanStack removes $_TSR then). */
async function open(page, url) {
  const response = await page.goto(url);
  await page.waitForFunction(() => !("$_TSR" in self), null, { timeout: 15000 });
  return response;
}

for (const width of [390, 1280]) {
  test(`reader controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await open(page, "http://127.0.0.1:4179/");
    expect(response.status()).toBe(200);
    // On GitHub's machine a tap in the first moments after loading is sometimes lost (the
    // page is still starting); a reader would tap again, and so does the test, for up to
    // ten seconds. A button that never works still fails.
    for (const depth of [1, 2, 3]) {
      await expect(async () => {
        await page.locator(`[data-depth-step="${depth}"]`).click();
        await expect(page.locator(".atlas-top")).toHaveAttribute("data-depth", String(depth), {
          timeout: 1000,
        });
      }).toPass({ timeout: 10000 });
    }
    await page.locator('button[aria-controls="site-menu"]').click();
    await expect(page.locator("#site-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#site-menu")).toHaveCount(0);
    await open(page, "http://127.0.0.1:4179/search");
    await page.locator('input[type="search"]').fill("carbon");
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('main a[href="/read/carbon-books"]')).toBeVisible();
    await page.locator('button[aria-controls="site-menu"]').click();
    await page
      .locator("#site-menu")
      .getByRole("button", { name: /Languages/ })
      .click();
    await page.locator("#site-menu").getByRole("button", { name: "Türkçe", exact: true }).click();
    await expect(page).toHaveURL(/\/tr\/search/);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await open(page, "http://127.0.0.1:4179/tr/read/carbon-books");
    const chain = page.locator(".doc-chain-toggle");
    await chain.click();
    await expect(chain).toHaveAttribute("aria-expanded", "true");
    await chain.click();
    await expect(chain).toHaveAttribute("aria-expanded", "false");
    await open(page, "http://127.0.0.1:4179/tr/");
    await page.locator('button[aria-controls="site-menu"]').click();
    await page.locator("#site-menu").getByRole("button", { name: /^Tema/ }).click();
    await page.locator("#site-menu").getByRole("button", { name: "Bordo", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-look", "bordo");
    await page.keyboard.press("Escape");
    await open(page, "http://127.0.0.1:4179/tr/");
    await page
      .getByRole("button", { name: /^Dinle:/ })
      .first()
      .click();
    await expect(page.locator(".listen-bar")).toBeVisible();
    expect(errors).toEqual([]);
  });
}
