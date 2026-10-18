import type { Lang, StoryCard, VideoCard } from "@/lib/types";
// Relative import with the extension, so the tests can load this file directly with node.
import { copyFor } from "./i18n.ts";

/**
 * Search over the reading cards already on the page (virtual:orbis-index): title,
 * summary, region and section name, plus the full text in the language of the page.
 * Full texts come from assets/search/<lang>.json only when the reader searches.
 * Nothing is sent anywhere; the site stays a set of static files.
 *
 * Every query word must begin a word somewhere in the reading ("clim" finds "climate",
 * "war" does not find "software"). In Arabic a word also counts without the article
 * and the particles joined to it, so "اقتصاد" finds "الاقتصاد" and "للاقتصاد".
 */

export type SearchCopy = {
  title: string;
  label: string;
  placeholder: string;
  submit: string;
  /** Number of results; {n} is replaced. */
  count: (n: number) => string;
  empty: string;
  loading: string;
  failed: string;
  description: string;
};

const COPY: Record<Lang, SearchCopy> = {
  tr: {
    title: "Arama",
    label: "Okumalarda ve videolarda ara",
    placeholder: "Okumalarda ve videolarda ara",
    submit: "Ara",
    count: (n) => `${n} sonuç`,
    empty: "Aramanızla eşleşen okuma ya da video bulunamadı.",
    loading: "Arama hazırlanıyor…",
    failed: "Arama verileri yüklenemedi. Lütfen tekrar deneyin.",
    description: "Orbis okumalarında ve videolarında arama.",
  },
  ar: {
    title: "البحث",
    label: "ابحث في القراءات",
    placeholder: "ابحث في القراءات",
    submit: "بحث",
    count: (n) =>
      n === 1 ? "نتيجة واحدة" : n === 2 ? "نتيجتان" : n <= 10 ? `${n} نتائج` : `${n} نتيجة`,
    empty: "لا توجد قراءات مطابقة لبحثك.",
    loading: "جارٍ تجهيز البحث…",
    failed: "تعذّر تحميل بيانات البحث. يُرجى المحاولة مرة أخرى.",
    description: "البحث في قراءات أوربيس.",
  },
  en: {
    title: "Search",
    label: "Search readings and videos",
    placeholder: "Search readings and videos",
    submit: "Search",
    count: (n) => (n === 1 ? "1 result" : `${n} results`),
    empty: "No readings or videos match your search.",
    loading: "Preparing search…",
    failed: "Search data could not be loaded. Please try again.",
    description: "Search the readings and videos on Orbis.",
  },
  fr: {
    title: "Recherche",
    label: "Chercher dans les lectures",
    placeholder: "Chercher dans les lectures",
    submit: "Chercher",
    count: (n) => (n <= 1 ? `${n} résultat` : `${n} résultats`),
    empty: "Aucune lecture ne correspond à votre recherche.",
    loading: "Préparation de la recherche…",
    failed: "Impossible de charger les données de recherche. Veuillez réessayer.",
    description: "Rechercher dans les lectures d’Orbis.",
  },
  es: {
    title: "Búsqueda",
    label: "Buscar en las lecturas",
    placeholder: "Buscar en las lecturas",
    submit: "Buscar",
    count: (n) => (n === 1 ? "1 resultado" : `${n} resultados`),
    empty: "Ninguna lectura coincide con su búsqueda.",
    loading: "Preparando la búsqueda…",
    failed: "No se pudieron cargar los datos de búsqueda. Inténtelo de nuevo.",
    description: "Buscar en las lecturas de Orbis.",
  },
};

export function searchCopy(lang: Lang): SearchCopy {
  return COPY[lang];
}

/** Language indexes are published with the site's other static assets. */
export function searchIndexUrl(lang: Lang, baseUrl: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}assets/search/${lang}.json`;
}

/** Do not mistake an HTML fallback or malformed data for an empty search index. */
export function readSearchBodies(value: unknown): ReadonlyMap<string, string> {
  if (!Array.isArray(value)) throw new Error("Invalid search index");
  const bodies = new Map<string, string>();
  for (const record of value) {
    if (!record || typeof record.id !== "string" || typeof record.body !== "string") {
      throw new Error("Invalid search record");
    }
    bodies.set(record.id, record.body);
  }
  return bodies;
}

export async function loadSearchBodies(
  lang: Lang,
  baseUrl: string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<ReadonlyMap<string, string>> {
  const response = await request(searchIndexUrl(lang, baseUrl), { signal });
  if (!response.ok) throw new Error(`Search index: HTTP ${response.status}`);
  return readSearchBodies(await response.json());
}

/**
 * Arabic marks that carry no letter: harakat, superscript alef, tatweel and Quranic
 * annotation signs. Arabic-Indic digits and ٪ (U+0660–U+066D) sit between the harakat
 * and the superscript alef and must stay, so the range is split around them.
 */
// eslint-disable-next-line no-misleading-character-class -- a range of separate marks, nothing is combined
const ARABIC_MARKS = /[\u064B-\u065F\u0670\u0640\u0610-\u061A\u06D6-\u06ED]/g;

/** The Arabic article with the particles joined before it, longest first. */
const ARABIC_ARTICLE = /^(?:وال|فال|بال|كال|لل|ال)(?=..)/;

/**
 * Text folded for matching: case, accents and Arabic vowel marks do not count, and the
 * Turkish dotless and dotted i match each other. "istanbul" finds "İstanbul", "isik"
 * finds "ışık", "cocuk" finds "çocuk", "ecole" finds "école", "oeuvre" finds "œuvre",
 * "كتاب" finds "كِتَاب"; digits, Arabic ones included, stay as they are.
 */
export function fold(text: string): string {
  return text
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** An Arabic word without its article: الاقتصاد → اقتصاد. Other words pass through. */
function bare(word: string): string {
  return word.replace(ARABIC_ARTICLE, "");
}

/** The words of a query, folded; an Arabic word with the article searches its bare form. */
export function terms(query: string): string[] {
  return fold(query).split(" ").filter(Boolean).map(bare);
}

/** The words of a field, folded; an Arabic word with the article is kept both ways. */
function fieldWords(text: string): string[] {
  return fold(text)
    .split(" ")
    .filter(Boolean)
    .flatMap((word) => {
      const stripped = bare(word);
      return stripped === word ? [word] : [word, stripped];
    });
}

type Fields = [string[], number][];

/**
 * Each card is split into words once per language and kept, so a search on every
 * keystroke does not fold every reading again.
 */
const prepared = new WeakMap<StoryCard, Partial<Record<Lang, Fields>>>();
const preparedBodies = new WeakMap<ReadonlyMap<string, string>, Map<string, string[]>>();

function bodyWords(bodies: ReadonlyMap<string, string>, id: string): string[] {
  let cache = preparedBodies.get(bodies);
  if (!cache) {
    cache = new Map();
    preparedBodies.set(bodies, cache);
  }
  let words = cache.get(id);
  if (!words) {
    words = fieldWords(bodies.get(id) ?? "");
    cache.set(id, words);
  }
  return words;
}

function fieldsOf(card: StoryCard, lang: Lang): Fields {
  let byLang = prepared.get(card);
  if (!byLang) {
    byLang = {};
    prepared.set(card, byLang);
  }
  let fields = byLang[lang];
  if (!fields) {
    const copy = card.locales[lang];
    const themes = copyFor(lang).themes;
    fields = [
      [fieldWords(copy.title), 5],
      [fieldWords(copy.dek), 3],
      [fieldWords(`${copy.region} ${themes[card.theme]}`), 2],
      [fieldWords(copy.lead), 1],
    ];
    byLang[lang] = fields;
  }
  return fields;
}

/**
 * Readings in this language whose text holds every word of the query. A hit in the title
 * counts most, then the summary, region and section, then the full text; equal
 * scores keep the newest first.
 */
export function searchCards(
  cards: StoryCard[],
  lang: Lang,
  query: string,
  bodies?: ReadonlyMap<string, string>,
): StoryCard[] {
  const words = terms(query);
  if (words.length === 0) return [];
  const scored: { card: StoryCard; score: number }[] = [];
  for (const card of cards) {
    if (!card.locales[lang].written) continue;
    // An index entry must still have a current published card, and vice versa.
    if (bodies && !bodies.has(card.id)) continue;
    const cardFields = fieldsOf(card, lang);
    const fields: Fields = bodies
      ? [...cardFields.slice(0, 3), [bodyWords(bodies, card.id), 1]]
      : cardFields;
    const score = scoreOf(fields, words);
    if (score) scored.push({ card, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.card.date.localeCompare(a.card.date))
    .map((entry) => entry.card);
}

/** Every query word must hit some field; the score adds the weights of the fields hit. */
function scoreOf(fields: Fields, words: string[]): number {
  let score = 0;
  for (const word of words) {
    let hit = 0;
    for (const [list, weight] of fields) {
      if (list.some((w) => w.startsWith(word))) hit += weight;
    }
    if (!hit) return 0;
    score += hit;
  }
  return score;
}

/** A video's key in the search index: videos and readings never share an id. */
export function videoKey(id: string): string {
  return `video:${id}`;
}

export type Found =
  | { kind: "story"; card: StoryCard; date: string; score: number }
  | { kind: "video"; video: VideoCard; date: string; score: number };

/** The full texts of every site language, as loaded for one search. */
export type SearchIndexes = Partial<Record<Lang, ReadonlyMap<string, string>>>;

/**
 * Readings and videos together, found the same way: a video's title counts as a reading's
 * title, its sentence as a summary, its transcript as the full text. A video is found
 * only through the index, which holds its transcript.
 *
 * A query is matched in every language the index holds, not only the page's: a Turkish
 * reader on the English page who types "pirinç" still finds the reading about rice. The
 * best language's score counts; the result is shown in the page's language.
 */
export function searchAll(
  cards: StoryCard[],
  videos: VideoCard[],
  lang: Lang,
  query: string,
  indexes: SearchIndexes,
): Found[] {
  const words = terms(query);
  if (words.length === 0) return [];
  const langs = Object.keys(indexes) as Lang[];
  const found: Found[] = [];
  for (const card of cards) {
    if (!card.locales[lang].written || !indexes[lang]?.has(card.id)) continue;
    let score = 0;
    for (const each of langs) {
      const bodies = indexes[each];
      if (!bodies?.has(card.id) || !card.locales[each]?.written) continue;
      const fields: Fields = [...fieldsOf(card, each).slice(0, 3), [bodyWords(bodies, card.id), 1]];
      score = Math.max(score, scoreOf(fields, words));
    }
    if (score) found.push({ kind: "story", card, date: card.date, score });
  }
  for (const video of videos) {
    const key = videoKey(video.id);
    if (!video.locales[lang] || !indexes[lang]?.has(key)) continue;
    let score = 0;
    for (const each of langs) {
      const copy = video.locales[each];
      const bodies = indexes[each];
      if (!copy || !bodies?.has(key)) continue;
      const fields: Fields = [
        [fieldWords(copy.title), 5],
        [fieldWords(copy.dek), 3],
        [bodyWords(bodies, key), 1],
      ];
      score = Math.max(score, scoreOf(fields, words));
    }
    if (score) found.push({ kind: "video", video, date: video.date, score });
  }
  return found.sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
}

/** The full texts of every site language at once, for a search across languages. */
export async function loadSearchIndexes(
  langs: readonly Lang[],
  baseUrl: string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<SearchIndexes> {
  const loaded = await Promise.all(
    langs.map(
      async (each) => [each, await loadSearchBodies(each, baseUrl, signal, request)] as const,
    ),
  );
  return Object.fromEntries(loaded) as SearchIndexes;
}
