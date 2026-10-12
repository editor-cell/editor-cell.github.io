import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { resolveAddress, serveSite } from "./serve.mjs";
import { comparePictures } from "./visual.mjs";

const root = mkdtempSync(join(tmpdir(), "orbis-serve-"));
mkdirSync(join(root, "read"));
mkdirSync(join(root, "tr"));
writeFileSync(join(root, "index.html"), "home");
writeFileSync(join(root, "about.html"), "about");
writeFileSync(join(root, "read", "a.html"), "a");
writeFileSync(join(root, "tr", "index.html"), "tr");
writeFileSync(join(root, "404.html"), "missing");

test("addresses resolve as on Cloudflare", () => {
  assert.equal(resolveAddress(root, "/"), join(root, "index.html"));
  assert.equal(resolveAddress(root, "/about"), join(root, "about.html"));
  assert.equal(resolveAddress(root, "/read/a?x=1"), join(root, "read", "a.html"));
  assert.equal(resolveAddress(root, "/tr/"), join(root, "tr", "index.html"));
  assert.equal(resolveAddress(root, "/assets/gone.js"), null);
  assert.equal(resolveAddress(root, "/../etc/passwd"), null);
});

test("a missing file is answered with the 404 page and status 404", async () => {
  const site = await serveSite(root);
  try {
    const res = await fetch(`${site.url}/assets/gone.js`);
    assert.equal(res.status, 404);
    assert.equal(await res.text(), "missing");
    assert.equal((await fetch(`${site.url}/about`)).status, 200);
  } finally {
    await site.close();
  }
});

const picture = (width, height, colour) =>
  sharp({ create: { width, height, channels: 3, background: colour } })
    .png()
    .toBuffer();

test("equal pictures are the same; a moved block or a longer page differs", async () => {
  const white = await picture(40, 40, "#ffffff");
  assert.equal((await comparePictures(white, white)).differs, false);
  const black = await picture(40, 40, "#000000");
  const result = await comparePictures(white, black);
  assert.equal(result.differs, true);
  assert.equal(result.count, 1600);
  const paleGrey = await picture(40, 40, "#f4f4f4");
  assert.equal(
    (await comparePictures(white, paleGrey)).differs,
    true,
    "a pale tint is a difference",
  );
  assert.equal((await comparePictures(white, await picture(40, 40, "#fefefe"))).count, 1600);
  const longer = await picture(40, 41, "#ffffff");
  assert.equal((await comparePictures(white, longer)).differs, true);
});
