import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readStoryIndex } from "./story-index-plugin.mjs";

test("drafts stay out of the public index while legacy published files survive", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "orbis-index-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const locale = { title: "Reading", body: "A sourced reading.", dek: "Summary" };
  const story = { id: "legacy", theme: "science-technology", date: "2026-01-01", locales: { en: locale } };
  writeFileSync(join(dir, "legacy.json"), JSON.stringify(story));
  writeFileSync(
    join(dir, "draft.json"),
    JSON.stringify({ ...story, id: "draft", status: "draft" }),
  );
  const cards = readStoryIndex(dir);
  assert.deepEqual(
    cards.map((card) => card.id),
    ["legacy"],
  );
  assert.equal(cards[0].locales.en.written, true);
  assert.equal(cards[0].locales.tr.written, false);
});

test("publishing a draft restores its card and preserves author, dates and localized captions", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "orbis-index-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const story = {
    id: "reading",
    status: "published",
    theme: "science-technology",
    date: "2026-01-01",
    updatedAt: "2026-01-02",
    author: "Author",
    image: { src: "images/reading.jpg", credit: "A view", captions: { tr: "Bir görünüm" } },
    locales: { en: { title: "Reading", body: "A sourced reading." } },
  };
  writeFileSync(join(dir, "reading.json"), JSON.stringify(story));
  const [card] = readStoryIndex(dir);
  assert.equal(card.author, story.author);
  assert.equal(card.updatedAt, story.updatedAt);
  assert.equal(card.image.captions.tr, "Bir görünüm");
  assert.equal(card.locales.en.minutes, 1);
  assert.equal("body" in card.locales.en, false);
});
