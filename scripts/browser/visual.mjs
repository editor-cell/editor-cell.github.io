import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { FONT_HOSTS } from "./browser.mjs";

/**
 * Pictures of the same pages from the reference copy and the working copy, compared pixel
 * by pixel. Any page that looks different stops the publish; the two pictures and a
 * picture of the difference are kept for a person to look at.
 */

export const WIDTHS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
];
const LOOKS = ["classic", "bordo", "kahve", "night"];

/** Every page and setting that is photographed, at both widths. */
export function visualCases() {
  const cases = [];
  const add = (name, path, looks, depths = [null]) => {
    for (const size of WIDTHS)
      for (const look of looks)
        for (const depth of depths)
          cases.push({
            id: [name, size.name, look, depth && `depth${depth}`].filter(Boolean).join("-"),
            path,
            size,
            look,
            depth,
          });
  };
  // The 80 views: both languages, both widths, the four schemes, the front page at its
  // three depths, a section page and a reading page.
  for (const lang of ["en", "tr"]) {
    const prefix = lang === "tr" ? "/tr" : "";
    add(`home-${lang}`, `${prefix}/`, LOOKS, [1, 2, 3]);
    add(`section-${lang}`, `${prefix}/health`, LOOKS);
    add(`reading-${lang}`, `${prefix}/read/carbon-books`, LOOKS);
  }
  // Pages outside those 80, in the classic and dark schemes.
  add("media", "/media", ["classic", "night"]);
  add("video", "/media/fixture-film", ["classic", "night"]);
  add("about", "/about", ["classic", "night"]);
  add("membership", "/membership", ["classic"]);
  add("not-found", "/no-such-page", ["classic"]);
  return cases;
}

/** Faces every page uses: the text (Tinos). Since 15 Oct 2026 the name in the band is the
 * owner's drawn logo, not lettering, so Playfair Display is required only where a page asks
 * for it (a failed download still stops the check below). */
export const REQUIRED_FACES = ["Tinos"];

/**
 * Stops the check unless the site's real faces are on the page: every face the page asked
 * for has arrived (none failed) and the faces used on every page are among them. Without
 * this, a font file that fails to download would quietly be drawn in a fallback face.
 * Skipped only with ORBIS_OFFLINE_FONTS=1 (a closed test machine).
 */
export async function requireFaces(page) {
  if (process.env.ORBIS_OFFLINE_FONTS === "1") return;
  const faces = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].map((face) => ({
      family: face.family.replace(/["']/g, ""),
      status: face.status,
    }));
  });
  const failed = faces.filter((face) => face.status === "error").map((face) => face.family);
  if (failed.length)
    throw new Error(`Font files did not arrive: ${[...new Set(failed)].join(", ")}`);
  const loaded = new Set(
    faces.filter((face) => face.status === "loaded").map((face) => face.family),
  );
  const missing = REQUIRED_FACES.filter((family) => !loaded.has(family));
  if (missing.length)
    throw new Error(`The site's faces are not on the page: ${missing.join(", ")}`);
}

/** Waits until every running transition on the page (the depth folds, say) has ended. */
async function finishMotion(page) {
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document.getAnimations().map((animation) => animation.finished.catch(() => null)),
      ),
      new Promise((done) => setTimeout(done, 3000)),
    ]),
  );
}

/**
 * Opens a page in a settled state: settings applied, every picture loaded, motion stopped.
 * `watch`, when given, receives the page before it starts loading (to collect its errors).
 */
export async function openSettled(browser, url, { size, look, depth }, fonts, watch) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "en-GB",
    timezoneId: "Europe/Istanbul",
  });
  await context.addInitScript(
    ({ look, depth }) => {
      try {
        localStorage.setItem("orbis-look", look);
        if (depth) localStorage.setItem("orbis-depth", String(depth));
      } catch {
        /* storage blocked: defaults apply */
      }
    },
    { look, depth },
  );
  // Folds and fades end at once: the page is photographed in its final state, and code that
  // measures the page (the front page's text columns) never measures it halfway through a
  // fold. The site does not wait for the end of any transition, so nothing else changes.
  await context.addInitScript(() => {
    const still = () => {
      const style = document.createElement("style");
      style.textContent =
        "*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:0s!important;animation-delay:0s!important}";
      document.documentElement.append(style);
    };
    if (document.documentElement) still();
    else document.addEventListener("readystatechange", still, { once: true });
  });
  await context.route(FONT_HOSTS, fonts);
  // The membership database answers every check with nothing (no comments, no counts), so
  // a comment written on the live site never changes a picture and no check writes to it.
  await context.route(/^https:\/\/[a-z0-9]+\.supabase\.co\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  const page = await context.newPage();
  watch?.(page);
  await page.goto(url, { waitUntil: "networkidle" });
  // Pictures further down load only when scrolled to; load them all now.
  await page.evaluate(async () => {
    for (const img of document.querySelectorAll("img[loading=lazy]")) img.loading = "eager";
    await document.fonts.ready;
    const loaded = (img) =>
      img.complete
        ? null
        : new Promise((done) => {
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 5000);
          });
    await Promise.all([...document.images].map(loaded));
    // A picture can be loaded but not yet drawn ("decoding=async").
    await Promise.all([...document.images].map((img) => img.decode().catch(() => null)));
    // A film shows a turning wheel until it knows its length.
    await Promise.all(
      [...document.querySelectorAll("video")].map((video) =>
        video.readyState >= 1
          ? null
          : new Promise((done) => {
              video.addEventListener("loadedmetadata", done, { once: true });
              video.addEventListener("error", done, { once: true });
              setTimeout(done, 5000);
            }),
      ),
    );
  });
  await page.waitForLoadState("networkidle");
  await requireFaces(page);
  // The page has taken over from the written-out HTML (TanStack removes $_TSR then); the
  // settings it reads on start (depth, scheme) start their folds now, and their late refits
  // follow within a quarter of a second.
  await page.waitForFunction(() => !("$_TSR" in self), null, { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(400);
  await finishMotion(page);
  // The front page fits its text columns to the room left once everything has loaded; it
  // refits when the width changes. Under load that first fit can run before the room is
  // final, so every page is given the same last fit: one pixel wider and back.
  await page.setViewportSize({ width: size.width + 1, height: size.height });
  await page.waitForTimeout(150);
  await page.setViewportSize({ width: size.width, height: size.height });
  await finishMotion(page);
  await page.waitForTimeout(300);
  return { context, page };
}

/** Raw pixels, padded with magenta to the given size so pages of unequal length compare. */
async function raw(png, width, height) {
  const meta = await sharp(png).metadata();
  const { data } = await sharp(png)
    .ensureAlpha()
    .extend({
      right: width - meta.width,
      bottom: height - meta.height,
      background: { r: 255, g: 0, b: 255, alpha: 1 },
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width, height };
}

/** Number of pixels that differ visibly, and a picture of them (red on a faded copy). */
export async function comparePictures(a, b) {
  const [ma, mb] = await Promise.all([sharp(a).metadata(), sharp(b).metadata()]);
  const width = Math.max(ma.width, mb.width);
  const height = Math.max(ma.height, mb.height);
  const A = await raw(a, width, height);
  const B = await raw(b, width, height);
  const resized = ma.width !== mb.width || ma.height !== mb.height;
  const out = Buffer.alloc(A.data.length);
  let count = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.max(
      Math.abs(A.data[i] - B.data[i]),
      Math.abs(A.data[i + 1] - B.data[i + 1]),
      Math.abs(A.data[i + 2] - B.data[i + 2]),
    );
    // Any change of colour counts, however slight (a scheme's paper turning from white to
    // a pale beige is a difference of a few units).
    if (d > 0) {
      count++;
      out[i] = 230;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 255;
    } else {
      const grey = 200 + Math.round((A.data[i] + A.data[i + 1] + A.data[i + 2]) / 3 / 5);
      out[i] = out[i + 1] = out[i + 2] = grey;
      out[i + 3] = 255;
    }
  }
  const diff = count
    ? await sharp(out, { raw: { width, height, channels: 4 } })
        .png()
        .toBuffer()
    : null;
  const size = resized ? `page size ${ma.width}×${ma.height} → ${mb.width}×${mb.height}, ` : "";
  return { differs: resized || count > 0, reason: `${size}${count} pixels differ`, count, diff };
}

/** Photographs every case in both copies; returns the cases that differ. */
export async function runVisual(browser, sites, fonts, outDir, { parallel = 4 } = {}) {
  const cases = visualCases();
  const failed = [];
  /**
   * The filler words are covered in the picture (their line count varies from load to load
   * with the same code), so they are compared here instead: the same text in the same face,
   * size, colour, line height and visibility, cut to the same number of lines give or take
   * one.
   */
  const fillerOf = (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll(".atlas-fill > p:first-child")].map((p) => {
        const style = getComputedStyle(p);
        return {
          text: p.textContent.trim(),
          face: `${style.fontFamily} ${style.fontSize} ${style.fontWeight} ${style.lineHeight}`,
          colour: style.color,
          shown: style.visibility,
          lines: Number(style.webkitLineClamp) || 0,
        };
      }),
    );
  const sameFiller = (a, b) =>
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i];
      // At a cut of one line or none the words are hidden either way.
      const visible = x.lines >= 2 || y.lines >= 2;
      return (
        x.text === y.text &&
        x.face === y.face &&
        x.colour === y.colour &&
        Math.abs(x.lines - y.lines) <= 1 &&
        (!visible || x.shown === y.shown || Math.abs(x.lines - y.lines) === 1)
      );
    });
  const shoot = async (site, item) => {
    const { context, page } = await openSettled(browser, site.url + item.path, item, fonts);
    try {
      const filler = await fillerOf(page);
      const picture = await page.screenshot({
        fullPage: true,
        animations: "disabled",
        caret: "hide",
        // The front page's filler text (the faint continuation under a card) is cut to the
        // room left in its column, and that cut can land one line apart from one load to
        // the next. Its box is compared; the words inside it are covered.
        mask: [page.locator(".atlas-fill")],
        maskColor: "#ff00ff",
      });
      return { picture, filler };
    } finally {
      await context.close();
    }
  };
  const check = async (item) => {
    const shots = await Promise.all([shoot(sites.reference, item), shoot(sites.working, item)]);
    const pictures = shots.map((shot) => shot.picture);
    const result = await comparePictures(pictures[0], pictures[1]);
    if (!sameFiller(shots[0].filler, shots[1].filler)) {
      result.differs = true;
      result.reason =
        `the filler text differs: ${JSON.stringify(shots[0].filler)} → ${JSON.stringify(shots[1].filler)}`.slice(
          0,
          600,
        );
    }
    if (!result.differs) {
      console.log(`[visual] same     ${item.id}`);
      return;
    }
    const dir = join(outDir, item.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "1-reference.png"), pictures[0]);
    writeFileSync(join(dir, "2-working.png"), pictures[1]);
    if (result.diff) writeFileSync(join(dir, "3-difference.png"), result.diff);
    failed.push({ id: item.id, reason: result.reason });
    console.log(`[visual] DIFFERS  ${item.id}: ${result.reason}`);
  };
  // A few pages at a time: the check stays within a few minutes.
  const queue = [...cases];
  await Promise.all(
    Array.from({ length: parallel }, async () => {
      while (queue.length) await check(queue.shift());
    }),
  );
  return { total: cases.length, failed };
}
