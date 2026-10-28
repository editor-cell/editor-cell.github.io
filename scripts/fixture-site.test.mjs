import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { normalizeFixtureThemes, placeFixtures } from "./browser/fixture-site.mjs";

test("frozen media replaces reading media while each code version keeps its own icons", (t) => {
  const root = mkdtempSync(join(tmpdir(), "orbis-fixture-icons-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, body) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  };
  const repo = join(root, "repo");
  const fixtures = join(repo, "tests/visual/fixtures");
  put(join(fixtures, "stories/reading.json"), "frozen reading");
  put(join(fixtures, "videos/video.json"), "frozen video");
  for (const kind of ["images", "audio", "videos"])
    put(join(fixtures, "media", kind, "reading"), `frozen ${kind}`);
  put(join(repo, "images/icons/ora.svg"), "working copy icon");
  put(join(fixtures, "media/images/icons/ora.svg"), "fixture icon must not replace site icons");

  for (const version of ["reference", "current"]) {
    const dir = join(root, version);
    const icon = `${version} icon`;
    put(join(dir, "images/icons/ora.svg"), icon);
    put(join(dir, "images/icons/180.png"), `${version} touch icon`);
    put(join(dir, "content/stories/obsolete.json"), "real reading");
    for (const kind of ["images", "audio", "videos"])
      put(join(dir, kind, "obsolete"), `real ${kind}`);
    placeFixtures(repo, dir);
    assert.equal(readFileSync(join(dir, "images/icons/ora.svg"), "utf8"), icon);
    assert.equal(readFileSync(join(dir, "images/icons/180.png"), "utf8"), `${version} touch icon`);
    assert.equal(readFileSync(join(dir, "content/stories/reading.json"), "utf8"), "frozen reading");
    assert.equal(readFileSync(join(dir, "content/videos/video.json"), "utf8"), "frozen video");
    assert.equal(existsSync(join(dir, "content/stories/obsolete.json")), false);
    for (const kind of ["images", "audio", "videos"]) {
      assert.equal(readFileSync(join(dir, kind, "reading"), "utf8"), `frozen ${kind}`);
      assert.equal(existsSync(join(dir, kind, "obsolete")), false);
    }
  }
});

test("frozen readings keep the reference taxonomy and adapt only inside the newer build", (t) => {
  const root = mkdtempSync(join(tmpdir(), "orbis-fixture-themes-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const frozen = '{"id":"old","theme":"climate","locales":{"en":{"body":"Frozen text."}}}\n';
  for (const version of ["reference", "current"]) {
    const dir = join(root, version);
    mkdirSync(join(dir, "src/lib"), { recursive: true });
    mkdirSync(join(dir, "content/stories"), { recursive: true });
    writeFileSync(join(dir, "src/lib/types.ts"), version === "reference"
      ? 'export const THEMES = ["climate", "health"] as const;\nconst LEGACY_THEMES = {};'
      : 'export const THEMES = ["climate-environment", "health"] as const;\nexport const LEGACY_THEMES = {\n  climate: "climate-environment",\n};');
    writeFileSync(join(dir, "content/stories/old.json"), frozen);
    const unchanged = '{"id":"health","theme":"health"}\n';
    const unknown = '{"id":"unknown","theme":"unknown"}\n';
    writeFileSync(join(dir, "content/stories/health.json"), unchanged);
    writeFileSync(join(dir, "content/stories/unknown.json"), unknown);
    normalizeFixtureThemes(dir);
    const actual = readFileSync(join(dir, "content/stories/old.json"), "utf8");
    if (version === "reference") assert.equal(actual, frozen);
    else assert.deepEqual(JSON.parse(actual), { ...JSON.parse(frozen), theme: "climate-environment" });
    assert.equal(readFileSync(join(dir, "content/stories/health.json"), "utf8"), unchanged);
    assert.equal(readFileSync(join(dir, "content/stories/unknown.json"), "utf8"), unknown);
  }
});
