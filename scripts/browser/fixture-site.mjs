import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

/**
 * Builds a copy of the site with the frozen test readings in tests/visual/fixtures instead
 * of the real ones, so that a new reading never changes what the browser check sees, while a
 * change to the site's code or styles does.
 *
 * Two copies are built: the reference (a commit named in tests/visual/reference.txt, whose
 * look the owner approved) and the working copy. Both get the same fixtures, so the only
 * difference between their pages is the code.
 */

export const WORK = ".browser-check";
const FIXTURES = "tests/visual/fixtures";
/** Media kinds and the folders a commit may keep them in (older commits used public/ too). */
const MEDIA = ["images", "audio", "videos"];

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(" ")} failed (exit ${result.status}) in ${options.cwd ?? "."}`,
    );
  }
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name));
}

/** Changes whenever a fixture file changes, so a cached reference build is not reused. */
export function fixturesHash(repo) {
  const hash = createHash("sha256");
  for (const path of listFiles(join(repo, FIXTURES)).sort()) {
    hash.update(relative(repo, path));
    hash.update(readFileSync(path));
  }
  return hash.digest("hex").slice(0, 16);
}

/** Copies the files of a commit into `dir` (no checkout, no worktree to clean up). */
function exportCommit(repo, sha, dir) {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: repo, stdio: "ignore" });
  } catch {
    // A shallow clone (as in the workflow) fetches the one commit it needs.
    run("git", ["fetch", "--no-tags", "--depth=1", "origin", sha], { cwd: repo });
  }
  mkdirSync(dir, { recursive: true });
  const archive = execFileSync("git", ["archive", "--format=tar", sha], {
    cwd: repo,
    maxBuffer: 1024 * 1024 * 1024,
  });
  execFileSync("tar", ["-x", "-C", dir], { input: archive, maxBuffer: 1024 * 1024 * 1024 });
}

/** Copies the working copy (tracked and new files, not ignored ones) into `dir`. */
function exportWorkingCopy(repo, dir) {
  const files = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    {
      cwd: repo,
      maxBuffer: 64 * 1024 * 1024,
    },
  )
    .toString()
    .split("\0")
    .filter(Boolean);
  for (const file of files) {
    const from = join(repo, file);
    if (!existsSync(from) || lstatSync(from).isDirectory()) continue;
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    cpSync(from, join(dir, file));
  }
}

/** Adapt only the copied readings to the taxonomy supported by this code version. */
export function normalizeFixtureThemes(dir) {
  const types = readFileSync(join(dir, "src/lib/types.ts"), "utf8");
  const current = new Set([...types.match(/export const THEMES = \[([\s\S]*?)\]/)[1]
    .matchAll(/"([^"]+)"/g)].map((match) => match[1]));
  const legacy = types.match(/(?:export )?const LEGACY_THEMES[^=]*=\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const aliases = Object.fromEntries([...legacy.matchAll(/^\s*(?:"([a-z-]+)"|([a-z-]+)):\s*"([a-z-]+)"/gm)]
    .map((match) => [match[1] || match[2], match[3]]));
  const stories = join(dir, "content/stories");
  for (const name of readdirSync(stories).filter((file) => file.endsWith(".json"))) {
    const file = join(stories, name);
    const story = JSON.parse(readFileSync(file, "utf8"));
    if (current.has(story.theme) || !current.has(aliases[story.theme])) continue;
    story.theme = aliases[story.theme];
    writeFileSync(file, JSON.stringify(story, null, 2) + "\n");
  }
}

/** Replaces reading/video content and media, keeping this code version's site icons. */
export function placeFixtures(repo, dir) {
  const source = join(repo, FIXTURES);
  for (const kind of ["stories", "videos"]) {
    const target = join(dir, "content", kind);
    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    cpSync(join(source, kind), target, { recursive: true });
  }
  for (const kind of MEDIA) {
    const folders = [kind, join("public", kind)].filter((folder) => existsSync(join(dir, folder)));
    if (!folders.length) folders.push(kind);
    for (const folder of folders) {
      const target = join(dir, folder);
      const media = join(source, "media", kind);
      mkdirSync(target, { recursive: true });
      // Icons belong to the exported code, not the frozen readings. In particular,
      // never replace the reference commit's icons with the working copy's icons.
      const isSiteIcon = (name) => kind === "images" && name === "icons";
      for (const name of readdirSync(target))
        if (!isSiteIcon(name)) rmSync(join(target, name), { recursive: true, force: true });
      for (const name of readdirSync(media))
        if (!isSiteIcon(name)) cpSync(join(media, name), join(target, name), { recursive: true });
    }
  }
}

/**
 * The packages for a copy: the repository's own node_modules when the lock file is the
 * same, otherwise a cached `npm ci` for that lock file.
 */
function linkPackages(repo, dir) {
  const lock = readFileSync(join(dir, "package-lock.json"));
  const own = readFileSync(join(repo, "package-lock.json"));
  let modules = join(repo, "node_modules");
  if (!lock.equals(own)) {
    const key = createHash("sha256").update(lock).digest("hex").slice(0, 16);
    const deps = join(repo, WORK, "deps", key);
    if (!existsSync(join(deps, "node_modules", ".package-lock.json"))) {
      rmSync(deps, { recursive: true, force: true });
      mkdirSync(deps, { recursive: true });
      cpSync(join(dir, "package.json"), join(deps, "package.json"));
      cpSync(join(dir, "package-lock.json"), join(deps, "package-lock.json"));
      run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: deps });
    }
    modules = join(deps, "node_modules");
  }
  symlinkSync(modules, join(dir, "node_modules"), "dir");
}

/**
 * Builds one copy and returns the folder of its finished pages.
 * `sha` null means the working copy; `tweak(dir)` changes that copy before it is built.
 */
export function buildFixtureSite(repo, name, sha, { tweak } = {}) {
  const dir = join(repo, WORK, name);
  const stamp = join(dir, ".fixture-build");
  const key = sha ? `${sha} ${fixturesHash(repo)}` : null;
  if (key && existsSync(stamp) && readFileSync(stamp, "utf8") === key) {
    console.log(`[browser] ${name}: reusing the build of ${sha.slice(0, 7)}`);
    return join(dir, "dist", "client");
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  if (sha) exportCommit(repo, sha, dir);
  else exportWorkingCopy(repo, dir);
  placeFixtures(repo, dir);
  normalizeFixtureThemes(dir);
  // A change made to this copy only (the open-tab check builds a "next publish" this way).
  tweak?.(dir);
  linkPackages(repo, dir);
  console.log(
    `[browser] ${name}: building ${sha ? sha.slice(0, 7) : "the working copy"} with the test readings`,
  );
  run("npm", ["run", "build:pages"], { cwd: dir });
  if (key) writeFileSync(stamp, key);
  return join(dir, "dist", "client");
}
