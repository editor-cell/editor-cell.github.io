import type { Lang, Story } from "@/lib/types";

const INTL: Record<Lang, string> = {
  tr: "tr-TR",
  ar: "ar",
  en: "en-GB",
  fr: "fr-FR",
  es: "es-ES",
};

export function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 0;
  return Math.max(1, Math.ceil(words / 160));
}

export function formatDate(iso: string, lang: Lang): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(INTL[lang], {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** The dates covered by a selection, rather than an invented issue publication date. */
export function formatDateRange(start: string, end: string, lang: Lang): string {
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return start;
  // Intl.formatRange uses different abbreviations and spaces across Node/Chromium ICU
  // versions. Fixed month labels keep the pre-rendered text identical during hydration.
  const months: Record<Lang, string[]> = {
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
    ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
    fr: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
    es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  };
  const dayMonth = (date: Date) => `${date.getUTCDate()} ${months[lang][date.getUTCMonth()]}`;
  const finish = `${dayMonth(to)} ${to.getUTCFullYear()}`;
  if (start === end) return finish;
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  const begin = sameYear
    ? (from.getUTCMonth() === to.getUTCMonth() ? String(from.getUTCDate()) : dayMonth(from))
    : `${dayMonth(from)} ${from.getUTCFullYear()}`;
  return `${begin} – ${finish}`;
}

export function safeHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The title in this language, or else in the first language that has one. Works for cards too. */
export function storyTitle(
  story: { locales: Record<Lang, { title: string }> },
  lang: Lang,
): string {
  const direct = story.locales[lang].title.trim();
  if (direct) return direct;
  for (const code of ["en", "tr", "fr", "es", "ar"] as const) {
    const title = story.locales[code].title.trim();
    if (title) return title;
  }
  return "";
}

export function hasCopy(story: Story, lang: Lang): boolean {
  return story.locales[lang].body.trim().length > 0;
}
