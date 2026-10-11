import { test, expect } from "playwright/test";
import { serveFonts } from "./fonts.mjs";
test.beforeEach(async ({ page }) => serveFonts(page));

for (const width of [390, 1280]) {
  test(`reader controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto("http://127.0.0.1:4179/");
    expect(response.status()).toBe(200);
    for (const depth of [1, 2, 3]) {
      await page.locator(`[data-depth-step="${depth}"]`).click();
      await expect(page.locator(".atlas-top")).toHaveAttribute("data-depth", String(depth));
    }
    await page.locator('button[aria-controls="site-menu"]').click();
    await expect(page.locator("#site-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#site-menu")).toHaveCount(0);
    await page.goto("http://127.0.0.1:4179/search");
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
    await page.goto("http://127.0.0.1:4179/tr/read/carbon-books");
    const chain = page.locator(".doc-chain-toggle");
    await chain.click();
    await expect(chain).toHaveAttribute("aria-expanded", "true");
    await chain.click();
    await expect(chain).toHaveAttribute("aria-expanded", "false");
    await page.goto("http://127.0.0.1:4179/tr/");
    await page.locator('button[aria-controls="site-menu"]').click();
    await page.locator("#site-menu").getByRole("button", { name: /^Tema/ }).click();
    await page.locator("#site-menu").getByRole("button", { name: "Bordo", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-look", "bordo");
    await page.keyboard.press("Escape");
    await page.goto("http://127.0.0.1:4179/tr/");
    await page
      .getByRole("button", { name: /^Dinle:/ })
      .first()
      .click();
    await expect(page.locator(".listen-bar")).toBeVisible();
    expect(errors).toEqual([]);
  });
}
