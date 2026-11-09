// Cloudflare's deploy command for this site (Workers Builds, owner, 9 Nov 2026):
//   node scripts/deploy-newest.mjs
// Cloudflare builds every commit pushed to main, and a build can run late. On 9 Nov 2026
// two builds ran about two hours late and put a morning copy of the site back over the
// newest one. So a build deploys only while its commit is still the newest on main;
// otherwise it stops, and the newer commit's own build puts the site up.
// If main cannot be read, it deploys as before rather than leaving the site unpublished.
import { execFileSync, spawnSync } from "node:child_process";

const REPO = "https://github.com/editor-cell/editor-cell.github.io.git";

function thisCommit() {
  const fromCloudflare = (process.env.WORKERS_CI_COMMIT_SHA ?? "").trim();
  if (fromCloudflare) return fromCloudflare;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function newestOnMain() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const out = execFileSync("git", ["ls-remote", REPO, "refs/heads/main"], {
        encoding: "utf8",
        timeout: 30_000,
      });
      const sha = out.trim().split(/\s+/)[0] ?? "";
      if (/^[0-9a-f]{40}$/.test(sha)) return sha;
    } catch (error) {
      console.log(`[deploy] reading main failed (attempt ${attempt}): ${error.message}`);
    }
  }
  return "";
}

const commit = thisCommit();
const newest = newestOnMain();
const same = (a, b) => a.length >= 7 && b.length >= 7 && (a.startsWith(b) || b.startsWith(a));

if (commit && newest && !same(commit, newest)) {
  console.log(
    `[deploy] skipped: this build is for ${commit.slice(0, 7)}, but main is already at ` +
      `${newest.slice(0, 7)}. That newer commit's build puts the site up.`,
  );
  process.exit(0);
}

console.log(
  commit && newest
    ? `[deploy] ${commit.slice(0, 7)} is the newest commit on main; deploying.`
    : "[deploy] could not compare with main; deploying as before.",
);
const run = spawnSync("npx", ["wrangler", "deploy"], { stdio: "inherit" });
process.exit(run.status ?? 1);
