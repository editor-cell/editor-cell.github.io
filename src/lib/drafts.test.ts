import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { clearDraft, loadDraft, saveDraft } from "./drafts.ts";

/** A browser store that refuses anything above `limit` characters, like a full quota. */
function fakeStorage(limit = Infinity) {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (value.length > limit) throw new Error("QuotaExceededError");
      items.set(key, value);
    },
    removeItem: (key: string) => void items.delete(key),
  };
}

function story(extra: { audio?: string; image?: string } = {}) {
  const locale = (title: string) => ({
    title,
    dek: "",
    region: "",
    body: "Metin",
    audio: extra.audio ? { name: "a.mp3", mime: "audio/mpeg", dataUrl: extra.audio } : null,
  });
  return {
    id: "carbon-books",
    theme: "climate-environment",
    date: "2026-09-30",
    sources: [],
    ...(extra.image ? { image: { src: extra.image, credit: "" } } : {}),
    locales: {
      tr: locale("Başlık"),
      ar: locale(""),
      en: locale(""),
      fr: locale(""),
      es: locale(""),
    },
  } as never;
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = fakeStorage();
});

test("a saved draft comes back with the version it started from", () => {
  assert.equal(saveDraft("carbon-books", story(), '{"id":1}'), true);
  const saved = loadDraft("carbon-books");
  assert.ok(saved);
  assert.equal(saved.story.locales.tr.title, "Başlık");
  assert.equal(saved.hasBase, true);
  assert.equal(saved.base, '{"id":1}');
  assert.equal(saved.mediaDropped, false);
});

test("an unknown start is recorded as unknown, not as a missing file", () => {
  saveDraft("new", story(), undefined);
  assert.equal(loadDraft("new")?.hasBase, false);
  saveDraft("new", story(), null);
  assert.equal(loadDraft("new")?.hasBase, true);
  assert.equal(loadDraft("new")?.base, null);
});

test("when new media does not fit, the text is still kept and the loss is flagged", () => {
  (globalThis as { localStorage?: unknown }).localStorage = fakeStorage(5_000);
  const big = `data:audio/mpeg;base64,${"A".repeat(20_000)}`;
  assert.equal(saveDraft("carbon-books", story({ audio: big, image: big }), null), true);
  const saved = loadDraft("carbon-books");
  assert.ok(saved);
  assert.equal(saved.mediaDropped, true);
  assert.equal(saved.story.locales.tr.title, "Başlık");
  assert.equal(saved.story.locales.tr.audio, null);
  assert.equal(saved.story.image, undefined);
});

test("published media is not dropped, only media chosen since", () => {
  (globalThis as { localStorage?: unknown }).localStorage = fakeStorage(5_000);
  const big = `data:image/jpeg;base64,${"A".repeat(20_000)}`;
  saveDraft("carbon-books", story({ audio: "audio/carbon-books-tr.mp3", image: big }), null);
  const saved = loadDraft("carbon-books");
  assert.equal(saved?.story.locales.tr.audio?.dataUrl, "audio/carbon-books-tr.mp3");
  assert.equal(saved?.story.image, undefined);
});

test("clearing removes the draft; a broken entry reads as no draft", () => {
  saveDraft("carbon-books", story(), null);
  clearDraft("carbon-books");
  assert.equal(loadDraft("carbon-books"), null);
  (
    globalThis as { localStorage: { setItem: (k: string, v: string) => void } }
  ).localStorage.setItem("orbis-draft:carbon-books", "{not json");
  assert.equal(loadDraft("carbon-books"), null);
});


test("old saved draft sections move to their merged home without changing the publish base", () => {
  const draft = { ...JSON.parse(JSON.stringify(story())), theme: "politics" };
  const base = JSON.stringify(draft);
  localStorage.setItem("orbis-draft:old", JSON.stringify({
    story: draft, hasBase: true, base, mediaDropped: false, savedAt: 1,
  }));
  const saved = loadDraft("old");
  assert.equal(saved?.story.theme, "economy-politics");
  assert.equal(saved?.base, base);
  assert.equal(saved?.story.locales.tr.title, "Başlık");
});
