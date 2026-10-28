import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readSearchIndex, writeSearchIndex } from "./search-index.mjs";
import { storyIndexPlugin } from "./story-index-plugin.mjs";

function fixture(t) {
  const stories = mkdtempSync(join(tmpdir(), "orbis-stories-"));
  const out = mkdtempSync(join(tmpdir(), "orbis-out-"));
  t.after(() => {
    rmSync(stories, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });
  return { stories, out };
}

const copy = (title, dek, body, region = "Global") => ({ title, dek, region, body });

function fullStory(id, date) {
  return {
    id,
    theme: "climate-environment",
    date,
    locales: {
      tr: copy("Başlık", "Özet", "Gövde metni. [1]", "Küresel"),
      ar: copy("العنوان", "الموجز", "نص المقال. [1]", "عالمي"),
      en: copy("Title", "Summary", "Body text. [1]"),
      fr: copy("Titre", "Résumé", "Corps du texte. [1]", "Monde"),
      es: copy("Título", "Resumen", "Cuerpo del texto. [1]", "Global"),
    },
  };
}

const read = (out, lang) =>
  JSON.parse(readFileSync(join(out, "assets", "search", `${lang}.json`), "utf8"));

test("writes the English and Turkish indexes under assets/search, without root or language-folder indexes", (t) => {
  const { stories, out } = fixture(t);
  writeFileSync(join(stories, "a.json"), JSON.stringify(fullStory("a", "2026-01-01")));
  writeSearchIndex(out, stories);
  for (const lang of ["en", "tr"]) {
    const file = join(out, "assets", "search", `${lang}.json`);
    assert.ok(existsSync(file), `${lang} index missing`);
    assert.equal(read(out, lang).length, 1);
    assert.ok(!existsSync(join(out, lang, "search.json")));
  }
  assert.ok(!existsSync(join(out, "search.json")));
  // Languages no longer on the site get no index.
  for (const lang of ["ar", "fr", "es"]) {
    assert.ok(!existsSync(join(out, "assets", "search", `${lang}.json`)));
  }
});

test("records carry id, theme, date, title, dek, region and a cleaned body", (t) => {
  const { stories, out } = fixture(t);
  const story = fullStory("reading", "2026-02-01");
  story.locales.en.body = "First line. [1]\n\n**Second** line, quoted. [12]\n> aside";
  writeFileSync(join(stories, "reading.json"), JSON.stringify(story));
  writeSearchIndex(out, stories);
  const [record] = read(out, "en");
  assert.deepEqual(Object.keys(record), ["id", "theme", "date", "title", "dek", "region", "body"]);
  assert.equal(record.id, "reading");
  assert.equal(record.theme, "climate-environment");
  assert.equal(record.date, "2026-02-01");
  assert.equal(record.title, "Title");
  assert.equal(record.dek, "Summary");
  assert.equal(record.region, "Global");
  assert.equal(record.body, "First line. Second line, quoted. aside");
});

test("links and images keep their words and lose their addresses", (t) => {
  const { stories, out } = fixture(t);
  const story = fullStory("links", "2026-02-01");
  story.locales.en.body =
    "See the [World Bank report](https://www.worldbank.org/en/report) here. [1]\n" +
    "![Flooded river](images/flood.jpg)";
  writeFileSync(join(stories, "links.json"), JSON.stringify(story));
  writeSearchIndex(out, stories);
  const [record] = read(out, "en");
  assert.equal(record.body, "See the World Bank report here. Flooded river");
});

test("drafts stay out; a reading without text in a language is absent there only", (t) => {
  const { stories, out } = fixture(t);
  writeFileSync(
    join(stories, "draft.json"),
    JSON.stringify({ ...fullStory("draft", "2026-03-01"), status: "draft" }),
  );
  const partial = fullStory("partial", "2026-03-02");
  partial.locales.tr = copy("", "", "", "");
  writeFileSync(join(stories, "partial.json"), JSON.stringify(partial));
  writeSearchIndex(out, stories);
  assert.deepEqual(read(out, "en").map((r) => r.id), ["partial"]);
  assert.deepEqual(read(out, "tr").map((r) => r.id), []);
});

test("the id falls back to the file name and records come newest first", (t) => {
  const { stories, out } = fixture(t);
  const unnamed = fullStory("", "2026-01-01");
  delete unnamed.id;
  writeFileSync(join(stories, "from-file.json"), JSON.stringify(unnamed));
  writeFileSync(join(stories, "newer.json"), JSON.stringify(fullStory("newer", "2026-05-01")));
  writeSearchIndex(out, stories);
  assert.deepEqual(
    read(out, "en").map((r) => r.id),
    ["newer", "from-file"],
  );
});

test("the index includes the final paragraph, with no drafts or media payloads", (t) => {
  const { stories, out } = fixture(t);
  const story = fullStory("deep", "2026-01-01");
  story.locales.en.body = "Introduction.\n\nMiddle paragraph.\n\nWetlands in the final paragraph. [2]";
  story.locales.en.audio = { dataUrl: "data:audio/mp3;base64,secret" };
  writeFileSync(join(stories, "deep.json"), JSON.stringify(story));
  writeFileSync(join(stories, "draft.json"), JSON.stringify({
    ...fullStory("draft", "2026-02-01"), status: "draft",
  }));
  writeSearchIndex(out, stories);
  const records = read(out, "en");
  assert.deepEqual(records, readSearchIndex(stories, "en"));
  assert.equal(records.length, 1);
  assert.match(records[0].body, /Wetlands in the final paragraph/);
  assert.ok(!JSON.stringify(records).includes("secret"));
});

test("local preview serves the same per-language JSON before the HTML fallback", (t) => {
  const { stories } = fixture(t);
  const story = fullStory("a", "2026-01-01");
  writeFileSync(join(stories, "a.json"), JSON.stringify(story));
  const plugin = storyIndexPlugin();
  // configResolved expects <root>/content/stories; direct an isolated root there.
  const root = mkdtempSync(join(tmpdir(), "orbis-preview-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "content", "stories"), { recursive: true });
  writeFileSync(join(root, "content", "stories", "a.json"), JSON.stringify(story));
  plugin.configResolved({ root });
  let middleware;
  plugin.configureServer({
    middlewares: { use: (handler) => { middleware = handler; } },
    watcher: { on() {} },
  });
  for (const lang of ["en", "tr", "ar", "fr", "es"]) {
    const headers = {};
    let body;
    const response = {
      setHeader: (name, value) => { headers[name] = value; },
      end: (value) => { body = value; },
    };
    middleware({ url: `/assets/search/${lang}.json`, method: "GET" }, response,
      () => assert.fail("Search fell through to the HTML fallback"));
    assert.match(headers["Content-Type"], /application\/json/);
    assert.equal(JSON.parse(body)[0].title, story.locales[lang].title);
  }
  for (const url of ["/assets/search/de.json", "/search.json", "/tr/search.json"]) {
    let passed = false;
    middleware({ url, method: "GET" }, {}, () => { passed = true; });
    assert.ok(passed, url);
  }
});

test("videos beside content/stories enter the index with their transcript, drafts and untitled languages left out", (t) => {
  const root = mkdtempSync(join(tmpdir(), "orbis-videos-"));
  const out = mkdtempSync(join(tmpdir(), "orbis-out-"));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });
  mkdirSync(join(root, "stories"));
  mkdirSync(join(root, "videos"));
  writeFileSync(join(root, "stories", "a.json"), JSON.stringify(fullStory("a", "2026-01-01")));
  const video = (id, status) => ({
    id,
    ...(status ? { status } : {}),
    date: "2026-02-01",
    src: `videos/${id}.mp4`,
    locales: { en: { title: "Sea", dek: "One line", transcript: "Tide **gauges** [1]\n\nand satellites." } },
  });
  writeFileSync(join(root, "videos", "sea.json"), JSON.stringify(video("sea")));
  writeFileSync(join(root, "videos", "draft.json"), JSON.stringify(video("draft", "draft")));
  writeSearchIndex(out, join(root, "stories"));
  const en = read(out, "en");
  const record = en.find((r) => r.kind === "video");
  assert.deepEqual(record, {
    id: "video:sea",
    kind: "video",
    date: "2026-02-01",
    title: "Sea",
    dek: "One line",
    body: "Tide gauges and satellites.",
  });
  assert.equal(en.filter((r) => r.kind === "video").length, 1);
  assert.equal(read(out, "tr").filter((r) => r.kind === "video").length, 0);
});
