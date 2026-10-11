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
