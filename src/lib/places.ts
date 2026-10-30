import type { Lang } from "@/lib/types";

/**
 * The places a reading compares. A reading's `region` names them, one after another, as
 * "Denmark · Austria · Greece"; a reading that looks at the whole world says so with one
 * word ("Global", "Dünya", "Küresel"). The front page and the readings set these names the
 * way an atlas sets place names, and the index of places is built from them.
 */

/** The words a reading uses for "the whole world", in every language a file can hold. */
const WORLD = new Set(
  [
    "global",
    "worldwide",
    "world",
    "the world",
    "dünya",
    "küresel",
    "dünya geneli",
    "tüm dünya",
    "عالمي",
    "العالم",
    "حول العالم",
    "monde",
    "mondial",
    "le monde",
    "monde entier",
    "mundo",
    "mundial",
    "todo el mundo",
  ].map((word) => word.toLocaleLowerCase("tr")),
);

const WORLD_LABEL: Record<Lang, string> = {
  en: "Worldwide",
  tr: "Dünya geneli",
  ar: "حول العالم",
  fr: "Monde entier",
  es: "Todo el mundo",
};

const LOCALE: Record<Lang, string> = {
  en: "en-GB",
  tr: "tr-TR",
  ar: "ar",
  fr: "fr-FR",
  es: "es-ES",
};

/** "Denmark · Austria · Greece" → ["Denmark", "Austria", "Greece"]. */
export function splitPlaces(region: string | undefined): string[] {
  return (region ?? "")
    .split(/\s*[·•;|]\s*/)
    .map((place) => place.trim())
    .filter(Boolean);
}

export function isWorld(place: string): boolean {
  return WORLD.has(place.trim().toLocaleLowerCase("tr"));
}

function joinPlaces(places: string[], lang: Lang): string {
  try {
    return new Intl.ListFormat(LOCALE[lang], { style: "long", type: "conjunction" }).format(places);
  } catch {
    return places.join(", ");
  }
}

/**
 * The places as a reader reads them: "Denmark, Austria and Greece", "Kobe and
 * Port-au-Prince", "Worldwide". Empty when the reading names no place.
 */
export function placeLine(region: string | undefined, lang: Lang): string {
  const places = splitPlaces(region);
  if (places.length === 0) return "";
  const world = places.some(isWorld);
  const named = places.filter((place) => !isWorld(place));
  if (named.length === 0) return WORLD_LABEL[lang];
  if (!world) return joinPlaces(named, lang);
  return [WORLD_LABEL[lang], ...named].join(lang === "ar" ? "، " : ", ");
}

/** The named places of a reading, without the word for the whole world. */
export function namedPlaces(region: string | undefined): string[] {
  return splitPlaces(region).filter((place) => !isWorld(place));
}

export type IndexEntry<T> = { place: string; items: T[] };

/**
 * An index of places, as at the back of an atlas: every named place once, in the
 * alphabetical order of the language, with the readings that compare it.
 */
export function placeIndex<T>(
  items: readonly T[],
  regionOf: (item: T) => string | undefined,
  lang: Lang,
): IndexEntry<T>[] {
  const byKey = new Map<string, IndexEntry<T>>();
  for (const item of items) {
    for (const place of namedPlaces(regionOf(item))) {
      const key = place.toLocaleLowerCase(LOCALE[lang]);
      const entry = byKey.get(key) ?? { place, items: [] };
      if (!entry.items.includes(item)) entry.items.push(item);
      byKey.set(key, entry);
    }
  }
  const collator = new Intl.Collator(LOCALE[lang], { sensitivity: "base" });
  return [...byKey.values()].sort((a, b) => collator.compare(a.place, b.place));
}
