import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { LANGS, THEMES } from "./src/lib/types.ts";
// @ts-expect-error JS plugin alongside the TS vite config
import { mediaPlugin } from "./scripts/media-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { readStoryIndex, storyIndexPlugin } from "./scripts/story-index-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { readVideoIndex, videoIndexPlugin } from "./scripts/video-index.mjs";

// @ts-expect-error JS build plugins alongside the TS vite config
import { breakpointsPlugin } from "./scripts/breakpoints-plugin.mjs";

const pages = process.env.ORBIS_PAGES === "1";

function staticPages() {
  const ids = readStoryIndex("content/stories").map((story) => story.id);
  const videoIds = readVideoIndex().map((video: { id: string }) => video.id);
  const paths: string[] = [];
  for (const lang of LANGS) {
    const prefix = lang === "en" ? "" : `/${lang}`;
    // A language's front page is a folder (tr/index.html), so /tr/ opens without a redirect.
    paths.push(lang === "en" ? "/" : `${prefix}/`);
    for (const theme of THEMES) paths.push(`${prefix}/${theme}`);
    paths.push(`${prefix}/about`);
    paths.push(`${prefix}/search`);
    for (const page of ["membership", "payment", "newsletter", "terms", "privacy", "account"])
      paths.push(`${prefix}/${page}`);
    for (const id of ids) paths.push(`${prefix}/read/${id}`);
    paths.push(`${prefix}/media`);
    for (const id of videoIds) paths.push(`${prefix}/media/${id}`);
  }
  return paths.map((path) => ({ path }));
}

const startOptions = pages
  ? {
      spa: { enabled: true, maskPath: "/panel" },
      pages: staticPages(),
      prerender: {
        enabled: true,
        crawlLinks: false,
        autoStaticPathsDiscovery: false,
        autoSubfolderIndex: false,
      },
    }
  : undefined;

export default defineConfig({
  server: { host: "0.0.0.0", port: 8080, strictPort: true },
  preview: { host: "127.0.0.1", port: 8081, strictPort: true },
  resolve: { tsconfigPaths: true },
  build: { emptyOutDir: true },
  plugins: [
    breakpointsPlugin(),
    mediaPlugin(),
    storyIndexPlugin(),
    videoIndexPlugin(),
    tailwindcss(),
    tanstackStart(startOptions),
    viteReact(),
  ],
});
