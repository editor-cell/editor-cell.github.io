import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeFixtureThemes } from "./browser/fixture-site.mjs";

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
