import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALL_LANGS, THEMES, LEGACY_THEMES, isTheme, toTheme, blankStory } from "../src/lib/types.ts";
import { copyFor } from "../src/lib/i18n.ts";
import { sectionCopy } from "../src/lib/section-copy.js";
import { writeFeeds } from "./feed.mjs";

const canonical = ["climate-environment", "economy-politics", "science-technology", "health", "culture"];

test("the five sections have the requested order and names in all five languages", () => {
  assert.deepEqual(THEMES, canonical);
  assert.deepEqual(Object.values(copyFor("en").themes), [
    "Climate & Environment", "Economy & Politics", "Science & Technology", "Health", "Culture",
  ]);
  assert.deepEqual(Object.values(copyFor("tr").themes), [
    "İklim ve Çevre", "Ekonomi ve Politika", "Bilim ve Teknoloji", "Sağlık", "Kültür",
  ]);
  for (const lang of ALL_LANGS) {
    assert.deepEqual(Object.keys(copyFor(lang).themes), canonical, lang);
    assert.deepEqual(copyFor(lang).themes, sectionCopy[lang]);
    assert.ok(Object.values(copyFor(lang).themes).every((label) => label.trim()));
  }
  assert.equal(blankStory().theme, "climate-environment");
});

test("old links and restored drafts resolve directly to a current section", () => {
  const expected = {
    climate: "climate-environment", environment: "climate-environment",
    economy: "economy-politics", politics: "economy-politics",
    science: "science-technology", technology: "science-technology",
    research: "science-technology", cities: "economy-politics", trade: "science-technology", knowledge: "culture",
  };
  assert.deepEqual(LEGACY_THEMES, expected);
  for (const [old, theme] of Object.entries(expected)) {
    assert.equal(isTheme(old), false);
    assert.equal(toTheme(old), theme);
    assert.equal(toTheme(theme), theme);
  }
  assert.equal(toTheme("missing"), undefined);
});

test("RSS uses the same localized section names and escapes their ampersands", (t) => {
  const storiesDir = mkdtempSync(join(tmpdir(), "orbis-sections-"));
  const root = mkdtempSync(join(tmpdir(), "orbis-feed-"));
  t.after(() => {
    rmSync(storiesDir, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  });
  for (const theme of THEMES) {
    writeFileSync(join(storiesDir, `${theme}.json`), JSON.stringify({
      id: theme, theme, date: "2026-10-28",
      locales: Object.fromEntries(ALL_LANGS.map((lang) => [lang, { title: "Reading", dek: "Summary", body: "Text." }])),
    }));
  }
  writeFeeds({ root, langs: ALL_LANGS, site: "https://example.org", name: "Orbis", storiesDir });
  for (const lang of ALL_LANGS) {
    const xml = readFileSync(join(root, lang === "en" ? "" : lang, "feed.xml"), "utf8");
    for (const label of Object.values(sectionCopy[lang]))
      assert.ok(xml.includes(`<category>${label.replaceAll("&", "&amp;")}</category>`), `${lang}: ${label}`);
    assert.ok(!xml.includes("undefined"));
  }
});
