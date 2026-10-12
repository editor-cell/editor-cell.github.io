#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

/**
 * `npm run visual:update` — makes the current commit the look every later publish is
 * compared with. Run it only after the owner has looked at a deliberate design change and
 * approved it; then commit tests/visual/reference.txt on its own. The workflow never runs
 * this.
 */

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
if (git("status", "--porcelain")) {
  console.error(
    "Commit or put aside the open changes first: the reference must be a commit as it is.",
  );
  process.exit(1);
}
const head = git("rev-parse", "HEAD");
writeFileSync("tests/visual/reference.txt", `${head}\n`);
console.log(`The approved look is now commit ${head.slice(0, 7)}.`);
console.log(
  "Commit tests/visual/reference.txt and push both commits; the workflow fetches the reference commit by its id.",
);
