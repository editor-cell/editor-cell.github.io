import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Skip obsolete builds; Git's fast-forward check also covers the final fetch/push race. */
export function finishPublish(root = process.cwd(), run) {
  const git =
    run ?? ((...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim());
  const base = git("rev-parse", "HEAD");
  git("fetch", "origin", "main");
  if (git("rev-parse", "origin/main") !== base) {
    console.log("[publish] main advanced; leave this build to the next queued run");
    return "superseded";
  }
  if (!git("diff", "--staged", "--name-only")) {
    console.log("[publish] site already current");
    return "current";
  }
  git("commit", "-m", "[site] publish");
  try {
    git("push", "origin", "HEAD:main");
  } catch (error) {
    git("fetch", "origin", "main");
    if (git("rev-parse", "origin/main") !== base) {
      console.log("[publish] main advanced during push; leave this build to the next queued run");
      return "superseded";
    }
    throw error;
  }
  return "published";
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  finishPublish();
