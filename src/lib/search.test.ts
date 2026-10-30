import assert from "node:assert/strict";
import test from "node:test";
import {
  fold, loadSearchBodies, readSearchBodies, searchAll, searchCards, searchCopy, searchIndexUrl, terms,
  videoKey,
} from "./search.ts";
import type { Lang, LocaleCard, StoryCard, VideoCard } from "./types.ts";

const LANGS: Lang[] = ["tr", "ar", "en", "fr", "es"];

function locale(fields: Partial<LocaleCard> = {}): LocaleCard {
  return { title: "", dek: "", region: "", lead: "", minutes: 1, written: true, ...fields };
}

/** A card written in one language only; the other languages are empty. */
function card(id: string, lang: Lang, fields: Partial<LocaleCard>, date = "2026-01-01"): StoryCard {
  const locales = Object.fromEntries(
    LANGS.map((l) => [l, l === lang ? locale(fields) : locale({ written: false })]),
  ) as Record<Lang, LocaleCard>;
  return { id, file: `${id}.json`, theme: "climate-environment", date, locales };
}

const ids = (cards: StoryCard[]) => cards.map((c) => c.id);

test("every language has its search words", () => {
  for (const lang of LANGS) {
    const copy = searchCopy(lang);
    assert.ok(copy.title && copy.placeholder && copy.empty, lang);
    assert.ok(copy.count(3).includes("3"), lang);
  }
});

test("Turkish: İ/I/ı and Turkish letters meet their plain forms", () => {
  assert.equal(fold("İKLİM"), "iklim");
  assert.equal(fold("IŞIK"), "isik");
  const cards = [
    card("a", "tr", { title: "Çocukların göç yolu" }),
    card("b", "tr", { title: "Kâğıt fiyatları", lead: "IŞIK hızı üzerine" }),
  ];
  assert.deepEqual(ids(searchCards(cards, "tr", "cocuk goc")), ["a"]);
  assert.deepEqual(ids(searchCards(cards, "tr", "ÇOCUK")), ["a"]);
  assert.deepEqual(ids(searchCards(cards, "tr", "kagit")), ["b"]);
  assert.deepEqual(ids(searchCards(cards, "tr", "ışık")), ["b"]);
});

test("Arabic ignores harakat and tatweel, and unifies alef, ة/ه and ى/ي", () => {
  const cards = [
    card("a", "ar", { title: "السَّلَامُ" }),
    card("b", "ar", { title: "إلى مدرسة" }),
    card("c", "ar", { title: "على الطريق" }),
    card("d", "ar", { title: "السـلام" }),
  ];
  assert.deepEqual(ids(searchCards(cards, "ar", "السلام")).sort(), ["a", "d"]);
  assert.deepEqual(ids(searchCards(cards, "ar", "الي")), ["b"]);
  assert.deepEqual(ids(searchCards(cards, "ar", "مدرسه")), ["b"]);
  assert.deepEqual(ids(searchCards(cards, "ar", "علي")), ["c"]);
});

test("Arabic keeps its digits and the percent sign", () => {
  assert.equal(fold("عام ٢٠٢٠"), "عام ٢٠٢٠");
  assert.ok(fold("نسبة ٥٪").includes("٥"));
  const cards = [card("a", "ar", { title: "تقرير", lead: "في عام ٢٠٢٠" })];
  assert.deepEqual(ids(searchCards(cards, "ar", "٢٠٢٠")), ["a"]);
});

test("Arabic finds a word with or without the article and its particles", () => {
  const cards = [
    card("a", "ar", { title: "الاقتصاد والهجرة" }),
    card("b", "ar", { title: "اقتصاد البلاد" }),
    card("c", "ar", { title: "تقرير", lead: "نص للاقتصاد" }),
  ];
  assert.deepEqual(terms("الاقتصاد"), ["اقتصاد"]);
  assert.deepEqual(ids(searchCards(cards, "ar", "اقتصاد")).sort(), ["a", "b", "c"]);
  assert.deepEqual(ids(searchCards(cards, "ar", "الاقتصاد")).sort(), ["a", "b", "c"]);
  assert.deepEqual(ids(searchCards(cards, "ar", "هجرة")), ["a"]);
});

test("French and Spanish ignore accents and ligatures", () => {
  const fr = [card("a", "fr", { title: "Les élèves", dek: "Une œuvre" })];
  assert.deepEqual(ids(searchCards(fr, "fr", "ELEVE")), ["a"]);
  assert.deepEqual(ids(searchCards(fr, "fr", "oeuvre")), ["a"]);
  const es = [card("b", "es", { title: "Informe", lead: "La acción climática" })];
  assert.deepEqual(ids(searchCards(es, "es", "accion")), ["b"]);
});

test("a query word must begin a word: 'war' does not find 'software'", () => {
  const cards = [
    card("war", "en", { title: "The cost of war" }),
    card("soft", "en", { title: "Software toward the future" }),
  ];
  assert.deepEqual(ids(searchCards(cards, "en", "war")), ["war"]);
  assert.deepEqual(ids(searchCards(cards, "en", "soft")), ["soft"]);
});

test("every query word must match; an empty query finds nothing", () => {
  const cards = [card("a", "en", { title: "Climate report", lead: "The rivers rise." })];
  assert.deepEqual(ids(searchCards(cards, "en", "clim rep")), ["a"]);
  assert.deepEqual(ids(searchCards(cards, "en", "climate missing")), []);
  assert.deepEqual(ids(searchCards(cards, "en", "   ")), []);
});

test("region and section name are searched", () => {
  const cards = [
    card("a", "en", { title: "Rivers", region: "Africa" }),
    card("b", "en", { title: "Rivers", region: "Asia" }),
  ];
  assert.deepEqual(ids(searchCards(cards, "en", "africa")), ["a"]);
  // Both cards are in the Earth section, which covers the climate.
  assert.deepEqual(ids(searchCards(cards, "en", "earth")).sort(), ["a", "b"]);
  assert.deepEqual(ids(searchCards(cards, "en", "climate")).sort(), ["a", "b"]);
});

test("both halves of every merged section name find its readings in English and Turkish", () => {
  const queries = [
    ["climate-environment", ["climate", "environment"], ["iklim", "cevre"]],
    ["economy-politics", ["economy", "politics"], ["ekonomi", "politika"]],
    ["science-technology", ["science", "technology"], ["bilim", "teknoloji"]],
  ] as const;
  for (const [theme, en, tr] of queries) {
    for (const [lang, words] of [["en", en], ["tr", tr]] as const) {
      const reading = { ...card("reading", lang, { title: "Report" }), theme };
      for (const word of words)
        assert.deepEqual(ids(searchCards([reading], lang, word)), ["reading"], `${lang}: ${word}`);
    }
  }
});

test("only readings written in the page's language are searched", () => {
  const cards = [card("a", "en", { title: "Rivers" })];
  assert.deepEqual(ids(searchCards(cards, "fr", "rivers")), []);
});

test("title beats summary, summary beats first paragraph; ties keep the newest first", () => {
  const cards = [
    card("lead", "en", { lead: "The rivers rise." }, "2026-01-03"),
    card("dek", "en", { dek: "The rivers rise." }, "2026-01-02"),
    card("old-title", "en", { title: "Rivers" }, "2026-01-01"),
    card("new-title", "en", { title: "Rivers" }, "2026-02-01"),
  ];
  assert.deepEqual(ids(searchCards(cards, "en", "rivers")), [
    "new-title",
    "old-title",
    "dek",
    "lead",
  ]);
});

test("the same cards answer repeated queries in more than one language", () => {
  const c = card("a", "tr", { title: "Çocuk" });
  c.locales.en = locale({ title: "Child" });
  assert.deepEqual(ids(searchCards([c], "tr", "cocuk")), ["a"]);
  assert.deepEqual(ids(searchCards([c], "en", "child")), ["a"]);
  assert.deepEqual(ids(searchCards([c], "tr", "çocuk")), ["a"]);
});

test("full text finds a word beyond the first paragraph in every language", () => {
  const endings: Record<Lang, [string, string]> = {
    en: ["The final paragraph discusses wetlands.", "wetland"],
    tr: ["Son paragraf çocukların göçünü anlatıyor.", "cocuk goc"],
    ar: ["تتناول الفقرة الأخيرة الاقتصاد والهجرة.", "اقتصاد هجره"],
    fr: ["Le dernier paragraphe décrit une œuvre.", "oeuvre"],
    es: ["El último párrafo explica la acción.", "accion"],
  };
  for (const lang of LANGS) {
    const cards = [card("a", lang, { title: "Report", lead: "Introduction." })];
    const [ending, query] = endings[lang];
    assert.deepEqual(searchCards(cards, lang, query), []);
    const bodies = readSearchBodies([{ id: "a", body: `Introduction. ${ending}` }]);
    assert.deepEqual(ids(searchCards(cards, lang, query, bodies)), ["a"], lang);
  }
});

test("full text retains ranking and requires every query term to match", () => {
  const cards = [
    card("body", "en", { title: "Report" }),
    card("title", "en", { title: "Wetlands report" }),
  ];
  const bodies = new Map([
    ["body", "Introduction. Wetlands in the final paragraph."],
    ["title", "Introduction. A final paragraph."],
  ]);
  assert.deepEqual(ids(searchCards(cards, "en", "wetland", bodies)), ["title", "body"]);
  assert.deepEqual(ids(searchCards(cards, "en", "report wetland", bodies)), ["title", "body"]);
  assert.deepEqual(searchCards(cards, "en", "wetland missing", bodies), []);
});

test("a stale index cannot resurrect a removed reading or search another language", () => {
  const cards = [card("a", "en", { title: "Current" }), card("b", "en", { title: "Old" })];
  const bodies = new Map([["a", "Wetlands"], ["removed", "Wetlands"]]);
  assert.deepEqual(ids(searchCards(cards, "en", "wetland", bodies)), ["a"]);
  assert.deepEqual(searchCards(cards, "en", "old", bodies), []);
  assert.deepEqual(searchCards(cards, "fr", "wetland", bodies), []);
});

test("full-text caches stay separate for each downloaded language and version", () => {
  const c = card("a", "en", { title: "Report" });
  c.locales.tr = locale({ title: "Rapor" });
  const en = new Map([["a", "Wetlands"]]);
  const tr = new Map([["a", "Çocukların göçü"]]);
  assert.deepEqual(ids(searchCards([c], "en", "wetland", en)), ["a"]);
  assert.deepEqual(searchCards([c], "tr", "wetland", tr), []);
  assert.deepEqual(ids(searchCards([c], "tr", "cocuk", tr)), ["a"]);
  assert.deepEqual(searchCards([c], "en", "wetland", new Map([["a", "Updated text"]])), []);
});

test("only the selected language index is requested, respecting the site's base path", async () => {
  for (const lang of LANGS) {
    const expected = `/orbis/assets/search/${lang}.json`;
    assert.equal(searchIndexUrl(lang, "/orbis"), expected);
    assert.equal(searchIndexUrl(lang, "/"), `/assets/search/${lang}.json`);
    const controller = new AbortController();
    const request: typeof fetch = async (url, options) => {
      assert.equal(url, expected);
      assert.equal(options?.signal, controller.signal);
      return Response.json([{ id: "a", body: "A final paragraph." }]);
    };
    const bodies = await loadSearchBodies(lang, "/orbis/", controller.signal, request);
    assert.equal(bodies.get("a"), "A final paragraph.");
  }
});

test("HTTP errors, HTML fallbacks and malformed records are not empty results", async () => {
  await assert.rejects(
    loadSearchBodies("en", "/", undefined, async () => new Response("Missing", { status: 404 })),
    /HTTP 404/,
  );
  await assert.rejects(
    loadSearchBodies("tr", "/", undefined, async () => new Response("<!doctype html>")),
  );
  assert.throws(() => readSearchBodies({}), /Invalid search index/);
  assert.throws(() => readSearchBodies([{ id: "a" }]), /Invalid search record/);
  assert.equal(readSearchBodies([]).size, 0);
});

test("videos are found by their title and their transcript, beside the readings", () => {
  const cards = [card("tide", "tr", { title: "Deniz seviyesi" }, "2026-01-02")];
  const video: VideoCard = {
    id: "sea",
    file: "sea.json",
    date: "2026-01-03",
    src: "videos/sea.mp4",
    locales: { tr: { title: "Hareket eden deniz", dek: "Uydular ve kara" } },
  };
  const bodies = new Map([
    ["tide", "Gelgit ölçerler kıyıda durur."],
    [videoKey("sea"), "Bu videoda gelgit ölçer ile uydu karşılaştırılıyor."],
  ]);
  const found = (q: string) =>
    searchAll(cards, [video], "tr", q, { tr: bodies }).map((f) => (f.kind === "video" ? `video:${f.video.id}` : f.card.id));
  // A word only in the transcript finds the video.
  assert.deepEqual(found("uydu karsilastir"), ["video:sea"]);
  // A word in both: both come back, the title hit first.
  assert.deepEqual(found("deniz"), ["video:sea", "tide"]);
  assert.deepEqual(found("gelgit").sort(), ["tide", "video:sea"]);
  // A video without an index entry, or without this language, is not found.
  assert.deepEqual(searchAll(cards, [video], "tr", "uydu", { tr: new Map() }), []);
  assert.deepEqual(searchAll(cards, [video], "en", "uydu", { tr: bodies }), []);
});

test("a word typed in the other language still finds the reading, shown in the page's language", () => {
  const rice = card("rice", "en", { title: "Who feeds Asia's rice bowl" });
  rice.locales.tr = locale({ title: "Asya'nın pirinç kâsesini kim dolduruyor" });
  const other = card("other", "en", { title: "Sea levels" });
  const indexes = {
    en: new Map([
      ["rice", "Rice prices rose across the region."],
      ["other", "Tide gauges stand on the coast."],
    ]),
    tr: new Map([["rice", "Pirinç fiyatları bölgede yükseldi."]]),
  };
  const found = (lang: Lang, q: string) =>
    searchAll([rice, other], [], lang, q, indexes).map((f) => (f.kind === "story" ? f.card.id : ""));
  // A Turkish word on the English page, and an English word on the Turkish page.
  assert.deepEqual(found("en", "pirinç"), ["rice"]);
  assert.deepEqual(found("en", "pirinc"), ["rice"]);
  assert.deepEqual(found("tr", "rice"), ["rice"]);
  // A reading not written in the page's language is not listed there.
  assert.deepEqual(found("tr", "tide"), []);
});
