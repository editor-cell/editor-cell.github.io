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

export const BASELINE_COMMIT = "5a29fbe50ed946f46f99beb8aecf1223716e9b74";
const root = process.cwd();
const update = process.argv.includes("--update");
const dir = resolve(root, "artifacts/visual", update ? "reference-source" : "current-source");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
if (update) {
  // Always use the specified starting commit, never quietly bless current changes.
  const archive = execFileSync("git", ["archive", BASELINE_COMMIT], {
    maxBuffer: 100 * 1024 * 1024,
  });
  const unpack = spawnSync("tar", ["-x", "-C", dir], { input: archive });
  if (unpack.status !== 0) throw new Error("Cannot unpack the starting commit");
} else {
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
if (update) execFileSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd: dir, stdio: "inherit" });
else symlinkSync(resolve(root, "node_modules"), resolve(dir, "node_modules"), "dir");
execFileSync("npm", ["run", "build:pages"], { cwd: dir, stdio: "inherit" });
let visualRoot = resolve(dir, "dist/client");
if (!update) {
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
if (!update && !existsSync(resolve(root, "tests/visual-reference"))) {
  throw new Error(
    "Missing approved visual references. Run npm run visual:update once before evaluation; never run it automatically in publishing.",
  );
}
const result = spawnSync(
  process.execPath,
  [
    "node_modules/playwright/cli.js",
    "test",
    ...(update ? ["tests/browser/visual.spec.mjs", "--update-snapshots"] : process.argv.slice(2)),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ORBIS_VISUAL_ROOT: visualRoot,
      ORBIS_READER_ROOT: update ? resolve(dir, "dist/client") : resolve(root, "dist/client"),
    },
  },
);
process.exitCode = result.status ?? 1;
if (result.status === 0)
  console.log(
    update
      ? `[visual] approved-reference build ${BASELINE_COMMIT}: passed`
      : "[browser] all checks passed",
  );
