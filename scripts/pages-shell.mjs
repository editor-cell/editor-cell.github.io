import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readStoryIndex } from "./story-index-plugin.mjs";
import { readVideoIndex } from "./video-index.mjs";
import { writeFeeds } from "./feed.mjs";
import { writeSearchIndex } from "./search-index.mjs";
import { writeImageSizes } from "./image-sizes.mjs";
import { writeSectionRedirects } from "./section-redirects.mjs";

/**
 * After `vite build` (see vite.config.ts): checks that every page was written out, makes
 * the shell the host's 404 page, and writes the sitemap, RSS feeds and robots.txt.
 */

const root = join(process.cwd(), "dist", "client");
const assets = readdirSync(join(root, "assets"));
const css = assets.find((name) => name.endsWith(".css"));
if (!css) throw new Error("No CSS asset in dist/client/assets");
const fixCss = (html) => html.replace(/\/assets\/styles-[^"]+\.css/g, `/assets/${css}`);

// The shell answers every address without its own file, the panel included.
writeFileSync(join(root, "404.html"), fixCss(readFileSync(join(root, "_shell.html"), "utf8")));
writeFileSync(join(root, ".nojekyll"), "");

const listOf = (file, name) =>
  [
    ...readFileSync(file, "utf8")
      .match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\]`))[1]
      .matchAll(/"([^"]+)"/g),
  ].map((m) => m[1]);
const LANGS = listOf("src/lib/types.ts", "LANGS");
const THEMES = listOf("src/lib/types.ts", "THEMES");
const stories = readStoryIndex("content/stories");
const videos = readVideoIndex();
const siteSource = readFileSync("src/lib/site.ts", "utf8");
const site = siteSource.match(/SITE_URL = "([^"]+)"/)[1];
const name = siteSource.match(/SITE_NAME = "([^"]+)"/)[1];

const urls = [];
for (const lang of LANGS) {
  const prefix = lang === "en" ? "" : `/${lang}`;
  const pages = [
    { file: lang === "en" ? "index.html" : `${lang}/index.html`, loc: `${prefix}/` },
    ...THEMES.map((theme) => ({
      file: `${prefix.slice(1)}${prefix ? "/" : ""}${theme}.html`,
      loc: `${prefix}/${theme}`,
    })),
    {
      file: `${prefix.slice(1)}${prefix ? "/" : ""}about.html`,
      loc: `${prefix}/about`,
    },
    // Membership and newsletter are listed; the payment and account pages are written out but not listed.
    ...["membership", "payment", "newsletter", "terms", "privacy", "account"].map((page) => ({
      file: `${prefix.slice(1)}${prefix ? "/" : ""}${page}.html`,
      loc: `${prefix}/${page}`,
      listed: page !== "payment" && page !== "account",
    })),
    // The search page is written out but stays out of the sitemap: nothing to index.
    {
      file: `${prefix.slice(1)}${prefix ? "/" : ""}search.html`,
      loc: `${prefix}/search`,
      listed: false,
    },
    ...stories.map((story) => ({
      file: `${prefix.slice(1)}${prefix ? "/" : ""}read/${story.id}.html`,
      loc: `${prefix}/read/${story.id}`,
      lastmod: story.date,
      // A language without this text shows only a notice: no sitemap entry.
      listed: story.locales[lang].written,
    })),
    // The list of videos is listed once there is a video; each video where it has a title.
    {
      file: `${prefix.slice(1)}${prefix ? "/" : ""}media.html`,
      loc: `${prefix}/media`,
      listed: videos.some((video) => video.locales[lang]),
    },
    ...videos.map((video) => ({
      file: `${prefix.slice(1)}${prefix ? "/" : ""}media/${video.id}.html`,
      loc: `${prefix}/media/${video.id}`,
      lastmod: video.date,
      listed: Boolean(video.locales[lang]),
    })),
  ];
  for (const page of pages) {
    const path = join(root, page.file);
    if (!existsSync(path)) throw new Error(`Page missing from the build: ${page.file}`);
    writeFileSync(path, fixCss(readFileSync(path, "utf8")));
    if (page.listed !== false) urls.push({ loc: `${site}${page.loc}`, lastmod: page.lastmod });
  }
}

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map(
    ({ loc, lastmod }) =>
      `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`,
  ),
  "</urlset>",
  "",
].join("\n");
writeFileSync(join(root, "sitemap.xml"), sitemap);
writeSectionRedirects(root);
writeFeeds({ root, langs: LANGS, site, name });
writeSearchIndex(root);
writeFileSync(
  join(root, "robots.txt"),
  `User-agent: *\nDisallow: /panel\n\nSitemap: ${site}/sitemap.xml\n`,
);
const sized = await writeImageSizes(root);
console.log(`[pages] ${urls.length} addresses in sitemap.xml, ${sized} picture copies in assets/img/`);
