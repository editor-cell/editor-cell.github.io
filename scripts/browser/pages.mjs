#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { annotate, fontRouter, launchBrowser } from "./browser.mjs";
import { serveSite } from "./serve.mjs";
import { openSettled, WIDTHS } from "./visual.mjs";

/**
 * The page check (`npm run test:pages`, before every publish, after the look check).
 * The look check compares the code against frozen test readings; this one opens the real
 * built site, with this week's readings, the way a reader does: every page in every open
 * language, at phone and desktop width, the front page at its three depths. A page stops
 * the publish when anything sticks out past the edge of the screen, when text runs out of
 * its own box (a long word in a title, say), when a picture does not load, when a file the
 * page asks for is missing, when the page reports an error, or when it is left empty.
 * Pictures of failing pages are kept in .browser-check/out/pages/.
 */

// Whatever stops the check is also left as a note on the GitHub run.
for (const event of ["uncaughtException", "unhandledRejection"])
  process.on(event, (error) => {
    annotate("Page check", error?.stack ?? String(error));
    console.error(error);
    process.exit(1);
  });

const repo = resolve(process.cwd());
const root = resolve(repo, process.argv[2] ?? "dist/client");
const out = join(repo, ".browser-check", "out", "pages");
if (!existsSync(join(root, "index.html"))) throw new Error(`No built site in ${root}`);
rmSync(out, { recursive: true, force: true });

/** Every page of the built site, as the address a reader opens. */
function addresses(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "assets" || name.startsWith("__")) continue;
      found.push(...addresses(path));
    } else if (name.endsWith(".html") && name !== "_shell.html" && name !== "404.html") {
      const rel = relative(root, path).split(sep).join("/");
      found.push("/" + rel.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, ""));
    }
  }
  return found;
}

const cases = [];
for (const path of addresses(root).sort()) {
  const home = path === "/" || /^\/[a-z]{2}\/$/.test(path);
  for (const size of WIDTHS)
    for (const depth of home ? [1, 2, 3] : [null])
      cases.push({ path, size, look: "classic", depth });
}

/** Runs in the page: what a reader would see as broken. */
function problemsOnPage() {
  const width = window.innerWidth;
  const html = document.documentElement;
  const problems = [];
  const name = (el) => {
    const text = (el.textContent || el.getAttribute("alt") || "").trim().replace(/\s+/g, " ");
    return `<${el.tagName.toLowerCase()}> "${text.slice(0, 70)}${text.length > 70 ? "…" : ""}"`;
  };
  // Inside a box that cuts off or scrolls its contents on purpose (a sideways strip).
  const held = (el) => {
    for (
      let up = el.parentElement;
      up && up !== document.body && up !== html;
      up = up.parentElement
    )
      if (getComputedStyle(up).overflowX !== "visible") return true;
    return false;
  };
  if (html.scrollWidth > width + 1)
    problems.push(`the page is ${html.scrollWidth} wide on a ${width} screen`);
  const flagged = new Set();
  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
    if (el.closest('[aria-hidden="true"], [inert], [hidden]')) continue;
    const box = el.getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.opacity === "0") continue;
    let parent = el.parentElement;
    while (parent && !flagged.has(parent)) parent = parent.parentElement;
    if (parent) continue;
    if ((box.right > width + 1 || box.left < -1) && !held(el)) {
      problems.push(`sticks out past the edge of the screen: ${name(el)}`);
      flagged.add(el);
      continue;
    }
  }
  // Text drawn past its own box: a word too long for its column or its button. Only the
  // letters on the screen count; a hidden label for screen readers or an invisible tap
  // area around a source number does not.
  const shown = (el) => {
    for (let up = el; up && up !== document.body; up = up.parentElement) {
      const style = getComputedStyle(up);
      if (style.visibility === "hidden" || style.opacity === "0") return false;
      if (style.display === "contents") continue;
      const box = up.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) return false;
    }
    return !el.closest('[aria-hidden="true"], [inert], [hidden]');
  };
  // The box a run of text is laid out in: the nearest parent that is not plain inline.
  const blockOf = (el) => {
    let up = el;
    while (up && ["inline", "contents"].includes(getComputedStyle(up).display))
      up = up.parentElement;
    return up;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    const text = walker.currentNode;
    const holder = text.parentElement;
    if (!text.textContent.trim() || !holder || holder.closest("svg, script, style, noscript"))
      continue;
    const block = blockOf(holder);
    if (!block || flagged.has(block) || !shown(holder)) continue;
    const style = getComputedStyle(block);
    if (style.overflowX !== "visible" || style.textOverflow === "ellipsis") continue;
    const box = block.getBoundingClientRect();
    const left = box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft) - 1;
    const right =
      box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight) + 1;
    range.selectNodeContents(text);
    const out = [...range.getClientRects()].some(
      (line) => line.width > 0 && (line.right > right || line.left < left),
    );
    if (out) {
      problems.push(`text runs out of its box: ${name(block)}`);
      flagged.add(block);
    }
  }
  for (const img of document.images)
    if (!img.complete || img.naturalWidth === 0)
      problems.push(`picture did not load: ${img.currentSrc || img.getAttribute("src")}`);
  const main = document.querySelector("main");
  if (!main || !main.textContent.trim()) problems.push("the page is empty");
  return problems;
}

const site = await serveSite(root);
const browser = await launchBrowser();
const failures = [];
try {
  const fonts = await fontRouter(join(repo, ".browser-check", "fonts"));
  let next = 0;
  const worker = async () => {
    while (next < cases.length) {
      const item = cases[next++];
      const label = `${item.path} ${item.size.name}${item.depth ? ` depth ${item.depth}` : ""}`;
      const errors = [];
      const watch = (page) => {
        page.on("pageerror", (error) =>
          errors.push(`the page reported an error: ${error.message}`),
        );
        page.on("console", (message) => {
          // A file that fails to arrive is reported below (own files) or by the font check.
          if (message.type() === "error" && !message.text().startsWith("Failed to load resource"))
            errors.push(`the page reported an error: ${message.text()}`);
        });
        page.on("response", (response) => {
          if (response.url().startsWith(site.url) && response.status() >= 400)
            errors.push(`missing file: ${response.url().slice(site.url.length)}`);
        });
      };
      let opened;
      try {
        opened = await openSettled(browser, site.url + item.path, item, fonts, watch);
        const problems = [...new Set([...errors, ...(await opened.page.evaluate(problemsOnPage))])];
        if (problems.length) {
          failures.push({ label, problems });
          mkdirSync(out, { recursive: true });
          const file = label.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
          await opened.page.screenshot({ path: join(out, `${file}.png`), fullPage: true });
        }
      } catch (error) {
        failures.push({ label, problems: [`could not be opened: ${error.message}`] });
      } finally {
        await opened?.context.close();
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
} finally {
  await browser.close();
  await site.close();
}

for (const { label, problems } of failures.sort((a, b) => a.label.localeCompare(b.label))) {
  annotate("Page check", `${label}: ${problems.join("; ")}`);
  console.error(`[pages] ${label}`);
  for (const problem of problems) console.error(`  - ${problem}`);
}
console.log(`[pages] ${cases.length - failures.length} of ${cases.length} page views are whole`);
if (failures.length) {
  console.error(`[pages] pictures of the failing pages: .browser-check/out/pages/`);
  process.exit(1);
}
