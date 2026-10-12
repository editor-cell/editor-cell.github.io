import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { chromium } from "playwright";

/**
 * Starts Chromium. Playwright's own browser is used when it is installed (as in the
 * workflow, after `npx playwright install chromium`); ORBIS_CHROMIUM names another one.
 */
export async function launchBrowser() {
  const executablePath = process.env.ORBIS_CHROMIUM || undefined;
  try {
    return await chromium.launch({ executablePath });
  } catch (error) {
    // A machine with a Chromium of its own but not Playwright's build of it.
    for (const path of [
      "/opt/pw-browsers/chromium",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ]) {
      if (!executablePath && existsSync(path)) return chromium.launch({ executablePath: path });
    }
    throw error;
  }
}

const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

/**
 * The site's faces come from Google Fonts. Both copies of the site must be drawn with the
 * same faces, or every picture differs. Each font file is fetched once and served from a
 * local cache to every page after it; where Google Fonts cannot be reached at all, every
 * page uses the fallback faces instead.
 */
export async function fontRouter(cacheDir) {
  mkdirSync(cacheDir, { recursive: true });
  let online = false;
  try {
    const res = await fetch("https://fonts.googleapis.com/css2?family=Tinos&display=swap", {
      signal: AbortSignal.timeout(8000),
    });
    online = res.ok;
  } catch {
    online = false;
  }
  if (!online && process.env.ORBIS_OFFLINE_FONTS !== "1")
    throw new Error(
      "Google Fonts cannot be reached: the look check needs the site's real faces. " +
        "(ORBIS_OFFLINE_FONTS=1 draws both copies with fallback faces, on a closed test machine only.)",
    );
  if (!online) console.log("[browser] ORBIS_OFFLINE_FONTS=1: both copies use fallback faces");
  return async (route) => {
    if (!online) return route.abort();
    const url = route.request().url();
    const key = join(cacheDir, createHash("sha256").update(url).digest("hex"));
    if (existsSync(key) && existsSync(`${key}.type`)) {
      return route.fulfill({
        status: 200,
        body: readFileSync(key),
        headers: {
          "content-type": readFileSync(`${key}.type`, "utf8"),
          "access-control-allow-origin": "*",
        },
      });
    }
    try {
      const res = await route.fetch();
      const body = await res.body();
      if (res.ok()) {
        writeFileSync(key, body);
        writeFileSync(`${key}.type`, res.headers()["content-type"] ?? "application/octet-stream");
      }
      return route.fulfill({ response: res, body });
    } catch {
      return route.abort();
    }
  };
}

export { FONT_HOSTS };
