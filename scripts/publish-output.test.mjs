import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { placeSite, verifySite } from "./publish-output.mjs";
test("publishes every output folder, deletes old pages, and detects an omitted folder", () => {
  const dir = mkdtempSync(join(tmpdir(), "orbis-output-"));
  const out = join(dir, "out"),
    root = join(dir, "site");
  mkdirSync(root);
  for (const file of [
    "media/new.html",
    "tr/media/new.html",
    "future/new.html",
    "read/old.html",
    "_shell.html",
  ]) {
    mkdirSync(join(out, file, ".."), { recursive: true });
    writeFileSync(join(out, file), file);
  }
  try {
    placeSite(out, root);
    for (const file of ["media/new.html", "tr/media/new.html", "future/new.html"])
      assert.ok(existsSync(join(root, file)));
    assert.equal(existsSync(join(root, "_shell.html")), false);
    rmSync(join(out, "read/old.html"));
    placeSite(out, root);
    assert.equal(existsSync(join(root, "read/old.html")), false);
    rmSync(join(root, "media"), { recursive: true });
    assert.throws(() => verifySite(out, root), /missing: media\/new.html/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("retains only two older asset generations and expires them after seven days", () => {
  const dir = mkdtempSync(join(tmpdir(), "orbis-retention-"));
  const out = join(dir, "out"),
    root = join(dir, "site");
  mkdirSync(root);
  mkdirSync(join(out, "assets"), { recursive: true });
  try {
    for (const generation of [1, 2, 3, 4]) {
      for (const path of [
        "assets/code-1.js",
        "assets/code-2.js",
        "assets/code-3.js",
        "assets/code-4.js",
      ])
        rmSync(join(out, path), { force: true });
      writeFileSync(join(out, `assets/code-${generation}.js`), String(generation));
      placeSite(out, root, generation * 1000);
    }
    assert.equal(existsSync(join(root, "assets/code-1.js")), false);
    for (const generation of [2, 3, 4])
      assert.ok(existsSync(join(root, `assets/code-${generation}.js`)));
    placeSite(out, root, 8 * 24 * 60 * 60 * 1000);
    assert.equal(existsSync(join(root, "assets/code-2.js")), false);
    assert.equal(existsSync(join(root, "assets/code-3.js")), false);
    assert.ok(existsSync(join(root, "assets/code-4.js")));
  } finally {
    rmSync(dir, { recursive: true });
  }
});
