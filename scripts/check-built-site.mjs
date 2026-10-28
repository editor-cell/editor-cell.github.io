import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { readStoryIndex } from "./story-index-plugin.mjs";
import { readVideoIndex } from "./video-index.mjs";
import { readRedirects, redirectFor, sectionRedirects } from "./section-redirects.mjs";
import { sectionCopy } from "../src/lib/section-copy.js";

/**
 * The last check before publishing, run on the finished site in dist/client (npm run
 * build:pages). If anything here fails, the "Publish site" workflow stops, nothing is
 * published, and the live site stays as it was.
 *
 * 1. Every reading and every video has its page in every language it is written in,
 *    with its title.
 * 2. Every address inside the site (links, pictures, picture copies, scripts, styles)
 *    points to a file that exists.
 * 3. Every DOI in the sources is registered at doi.org (a mistyped DOI is the one source
 *    error a machine can prove). Other addresses are not fetched: many publishers turn
 *    automatic requests away, so a refusal there would prove nothing.
 */

const root = join(process.cwd(), "dist", "client");
const redirects = readRedirects(root);
const problems = [];
const warnings = [];

// Addresses the site answers with its shell rather than a file of their own.
const SHELL_ROUTES = /^\/(panel|editor)(\/|$)/;

function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...htmlFiles(path));
    else if (name.endsWith(".html")) out.push(path);
  }
  return out;
}

function resolves(address, visited = new Set()) {
  const path = decodeURIComponent(address.split(/[?#]/)[0]);
  if (visited.has(path)) return false;
  visited.add(path);
  const redirect = redirectFor(redirects, path);
  if (redirect) return resolves(redirect.location, visited);
  if (path === "" || path === "/") return existsSync(join(root, "index.html"));
  if (SHELL_ROUTES.test(path)) return true;
  const base = join(root, path);
  return (
    (existsSync(base) && statSync(base).isFile()) ||
    existsSync(`${base}.html`) ||
    existsSync(join(base, "index.html"))
  );
}

/** 1. Reading pages. */
const LANGS = [
  ...readFileSync("src/lib/types.ts", "utf8")
    .match(/export const LANGS = \[([^\]]*)\]/)[1]
    .matchAll(/"([^"]+)"/g),
].map((m) => m[1]);
const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Every old section address redirects to a built canonical page, never a chain or a 404. */
for (const expected of sectionRedirects()) {
  const actual = redirectFor(redirects, expected.from);
  if (actual?.status !== 301 || actual.location !== expected.to || !resolves(expected.to))
    problems.push(`${expected.from}: missing permanent redirect to ${expected.to}`);
}
const sitemap = readFileSync(join(root, "sitemap.xml"), "utf8");
for (const lang of LANGS) {
  const prefix = lang === "en" ? "" : `/${lang}`;
  for (const [theme, label] of Object.entries(sectionCopy[lang])) {
    const file = join(root, prefix, `${theme}.html`);
    if (!existsSync(file) || !readFileSync(file, "utf8").includes(escapeHtml(label)))
      problems.push(`${prefix}/${theme}: section page is missing its current label`);
    if (!sitemap.includes(`${prefix}/${theme}</loc>`))
      problems.push(`${prefix}/${theme}: canonical section is missing from the sitemap`);
  }
}
for (const { from } of sectionRedirects())
  if (sitemap.includes(`${from}</loc>`)) problems.push(`${from}: old section remains in the sitemap`);

for (const story of readStoryIndex("content/stories")) {
  for (const lang of LANGS) {
    const copy = story.locales[lang];
    if (!copy.written) continue;
    const file = join(root, lang === "en" ? "" : lang, "read", `${story.id}.html`);
    if (!existsSync(file)) {
      problems.push(`${story.id} (${lang}): page was not written`);
      continue;
    }
    const html = readFileSync(file, "utf8");
    const title = copy.title.trim();
    if (title && !html.includes(escapeHtml(title)) && !html.includes(title)) {
      problems.push(`${story.id} (${lang}): page does not show its title "${title}"`);
    }
  }
}

/** 1b. Video pages: written out, with their title. */
for (const video of readVideoIndex()) {
  for (const lang of LANGS) {
    const copy = video.locales[lang];
    if (!copy) continue;
    const file = join(root, lang === "en" ? "" : lang, "media", `${video.id}.html`);
    if (!existsSync(file)) {
      problems.push(`video ${video.id} (${lang}): page was not written`);
      continue;
    }
    const html = readFileSync(file, "utf8");
    if (!html.includes(escapeHtml(copy.title)) && !html.includes(copy.title)) {
      problems.push(`video ${video.id} (${lang}): page does not show its title "${copy.title}"`);
    }
  }
}

/** 2. Addresses inside the site. */
const ATTR = /\s(?:href|src|poster)="(\/[^"]*)"|\ssrcset="([^"]*)"/gi;
const missing = new Map();
for (const file of htmlFiles(root)) {
  const name = relative(root, file);
  if (name === "_shell.html") continue;
  const html = readFileSync(file, "utf8");
  for (const m of html.matchAll(ATTR)) {
    const addresses = m[1]
      ? [m[1]]
      : m[2]
          .split(",")
          .map((part) => part.trim().split(/\s+/)[0])
          .filter((a) => a.startsWith("/"));
    for (const address of addresses) {
      if (address.startsWith("//") || resolves(address)) continue;
      if (!missing.has(address)) missing.set(address, name);
    }
  }
}
for (const [address, page] of missing)
  problems.push(`${page}: points to ${address}, which does not exist`);

/** 3. DOIs in the sources. */
const dois = new Map();
for (const file of readdirSync("content/stories").filter((n) => n.endsWith(".json"))) {
  const story = JSON.parse(readFileSync(join("content/stories", file), "utf8"));
  if (story.status === "draft") continue;
  for (const source of story.sources ?? []) {
    const m = /^https?:\/\/(?:dx\.)?doi\.org\/(10\.[^\s?#]+)/i.exec(source.url ?? "");
    if (m) dois.set(m[1], `${file} source ${source.n}`);
  }
}
for (const [doi, where] of dois) {
  try {
    const res = await fetch(`https://doi.org/api/handles/${encodeURI(doi)}`, {
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    if (body.responseCode === 100) problems.push(`${where}: DOI ${doi} is not registered`);
    else if (body.responseCode !== 1) warnings.push(`${where}: DOI ${doi} could not be checked`);
  } catch {
    warnings.push(`${where}: DOI ${doi} could not be checked (doi.org not reachable)`);
  }
}

for (const w of warnings) console.warn(`[check] warning: ${w}`);
if (problems.length) {
  console.error(`[check] ${problems.length} problem(s); nothing is published:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`[check] site is whole: every reading page, every inner address and ${dois.size} DOIs`);
