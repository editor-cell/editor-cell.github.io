import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { annotate } from "./browser/browser.mjs";

// Whatever stops the check is also left as a note on the GitHub run.
for (const event of ["uncaughtException", "unhandledRejection"])
  process.on(event, (error) => {
    annotate("Browser check", error?.stack ?? String(error));
    console.error(error);
    process.exit(1);
  });

export const BASELINE_COMMIT = "5a29fbe50ed946f46f99beb8aecf1223716e9b74";
const root = process.cwd();
/**
 * `npm run test:browser`, before every publish:
 * 1. the look check (scripts/browser/look.mjs): the approved commit and the current code,
 *    built with frozen readings and compared view by view in the same run;
 * 2. the reader checks (tests/browser): menu, search, language, depth, chain, listening,
 *    schemes, the boundary between the layouts, and a tab left open across a publish,
 *    on a copy of the current code with frozen readings and a second release of it.
 */
const lookStatus = spawnSync(process.execPath, ["scripts/browser/look.mjs"], {
  stdio: "inherit",
}).status;
const dir = resolve(root, "artifacts/visual", "current-source");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
{
  for (const name of [
    "src",
    "scripts",
    "server",
    "migrations",
    "public",
    "images",
    "audio",
    "videos",
    "content",
    "vite.config.ts",
    "tsconfig.json",
    "package.json",
    "package-lock.json",
  ]) {
    if (existsSync(resolve(root, name)))
      cpSync(resolve(root, name), resolve(dir, name), { recursive: true });
  }
}
// Visual input does not follow weekly editorial changes.
rmSync(resolve(dir, "content/stories"), { recursive: true, force: true });
rmSync(resolve(dir, "content/videos"), { recursive: true, force: true });
cpSync(resolve(root, "tests/fixtures/stories"), resolve(dir, "content/stories"), {
  recursive: true,
});
// Keep frozen media available even if an editor replaces a picture later.
const media = execFileSync("git", ["archive", BASELINE_COMMIT, "images", "audio"], {
  maxBuffer: 30 * 1024 * 1024,
});
if (spawnSync("tar", ["-x", "-C", dir], { input: media }).status !== 0)
  throw new Error("Cannot unpack frozen media");
symlinkSync(resolve(root, "node_modules"), resolve(dir, "node_modules"), "dir");
execFileSync("npm", ["run", "build:pages"], { cwd: dir, stdio: "inherit" });
let visualRoot = resolve(dir, "dist/client");
{
  const releaseA = resolve(root, "artifacts/visual/release-a");
  rmSync(releaseA, { recursive: true, force: true });
  cpSync(visualRoot, releaseA, { recursive: true });
  const storyPath = resolve(dir, "content/stories/carbon-books.json");
  const story = JSON.parse(readFileSync(storyPath, "utf8"));
  story.locales.en.title += " — release B";
  writeFileSync(storyPath, JSON.stringify(story, null, 2));
  rmSync(resolve(dir, "dist"), { recursive: true, force: true });
  execFileSync("npm", ["run", "build:pages"], { cwd: dir, stdio: "inherit" });
  process.env.ORBIS_RELEASE_A = releaseA;
  process.env.ORBIS_RELEASE_B = visualRoot;
  visualRoot = releaseA;
}
const result = spawnSync(
  process.execPath,
  ["node_modules/playwright/cli.js", "test", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ORBIS_VISUAL_ROOT: visualRoot,
      ORBIS_READER_ROOT: resolve(root, "dist/client"),
    },
  },
);
process.exitCode = lookStatus === 0 && result.status === 0 ? 0 : 1;
if (lookStatus !== 0) annotate("Browser check", "the look check stopped (see its notes)");
if (result.status !== 0)
  annotate("Browser check", `the reader checks stopped (exit ${result.status})`);
if (process.exitCode === 0) console.log("[browser] all checks passed");
