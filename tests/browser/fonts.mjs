import { request } from "playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
export const CACHE = "artifacts/font-cache.json";
const FONT_URL = /const FONTS =\s*"([^"]+)"/.exec(readFileSync("src/routes/__root.tsx", "utf8"))[1];
const fingerprint = createHash("sha256").update(FONT_URL).digest("hex");
export default async function prepareFonts(config) {
  if (existsSync(CACHE) && JSON.parse(readFileSync(CACHE)).fingerprint === fingerprint) return;
  const use = config.projects[0].use;
  const client = await request.newContext({
    proxy: use.proxy,
    ignoreHTTPSErrors: use.ignoreHTTPSErrors,
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    timeout: 30000,
  });
  const resources = {};
  try {
    const css = await client.get(FONT_URL);
    if (!css.ok()) throw new Error(`Font stylesheet: HTTP ${css.status()}`);
    const body = await css.text();
    resources[FONT_URL] = { contentType: "text/css", body: Buffer.from(body).toString("base64") };
    const urls = [
      ...new Set(
        [...body.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(
          (match) => match[1],
        ),
      ),
    ];
    let index = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (index < urls.length) {
          const url = urls[index++];
          const response = await client.get(url);
          if (!response.ok()) throw new Error(`Font file: HTTP ${response.status()}`);
          resources[url] = {
            contentType: response.headers()["content-type"],
            body: (await response.body()).toString("base64"),
          };
        }
      }),
    );
    mkdirSync("artifacts", { recursive: true });
    writeFileSync(CACHE, JSON.stringify({ fingerprint, resources }));
  } finally {
    await client.dispose();
  }
}
export async function serveFonts(page) {
  const { resources } = JSON.parse(readFileSync(CACHE));
  await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, async (route) => {
    const resource = resources[route.request().url()];
    if (!resource) throw new Error("Uncached font request: " + route.request().url());
    await route.fulfill({
      contentType: resource.contentType,
      body: Buffer.from(resource.body, "base64"),
    });
  });
}
