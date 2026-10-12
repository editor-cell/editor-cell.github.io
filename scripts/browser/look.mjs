#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fontRouter, launchBrowser } from "./browser.mjs";
import { buildFixtureSite, WORK } from "./fixture-site.mjs";
import { serveSite } from "./serve.mjs";
import { runVisual } from "./visual.mjs";

/**
 * The look check (part of `npm run test:browser`). Two copies of the site are built with
 * the frozen test readings in tests/visual/fixtures: the approved look (the commit in
 * tests/visual/reference.txt) and the code as it is now. The same 96 views are
 * photographed in both, side by side in the same run on the same machine, and compared;
 * nothing is stored, so no picture can be missing or come from another computer. A view
 * that differs stops the publish; the pictures are kept in .browser-check/out/visual/.
 */
const repo = resolve(process.cwd());
const reference = readFileSync(join(repo, "tests/visual/reference.txt"), "utf8").trim();
if (!/^[0-9a-f]{40}$/.test(reference))
  throw new Error("tests/visual/reference.txt must hold one full commit id");
const out = join(repo, WORK, "out");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const sites = {
  working: await serveSite(buildFixtureSite(repo, "working", null)),
  reference: await serveSite(buildFixtureSite(repo, "reference", reference)),
};
const browser = await launchBrowser();
let failed = [];
try {
  const fonts = await fontRouter(join(repo, WORK, "fonts"));
  const result = await runVisual(browser, sites, fonts, join(out, "visual"));
  failed = result.failed;
  console.log(`[look] ${result.total - failed.length} of ${result.total} views look as approved`);
} finally {
  await browser.close();
  await Promise.all(Object.values(sites).map((site) => site.close()));
}
if (failed.length) {
  console.error(`[look] ${failed.length} view(s) differ; pictures in ${WORK}/out/visual/.`);
  process.exit(1);
}
