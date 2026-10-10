/**
 * Every language a reading file can hold. The files keep all five, so texts written
 * earlier stay intact; only the languages in LANGS appear on the site.
 */
export const ALL_LANGS = ["tr", "ar", "en", "fr", "es"] as const;
export type Lang = (typeof ALL_LANGS)[number];

/** The languages on the site, in menu order: English first, Turkish second. */
export const LANGS = ["en", "tr"] as const satisfies readonly Lang[];

export const THEMES = [
  "climate",
  "environment",
  "politics",
  "economy",
  "science",
  "technology",
  "culture",
  "health",
  "research",
] as const;
export type Theme = (typeof THEMES)[number];

export type AudioClip = {
  name: string;
  mime: string;
  dataUrl: string;
};

export type LocaleCopy = {
  title: string;
  dek: string;
  region: string;
  body: string;
  audio: AudioClip | null;
};

export type Source = {
  n: number;
  label: string;
  url: string;
};

/** The picture shown with a reading. `src` is images/<file> in the repository. */
export type StoryImage = {
  src: string;
  /** Short description. Gray caption under the picture, and the image alt text. */
  credit: string;
  /** Localized description for both the caption and alternative text. */
  captions?: Partial<Record<Lang, string>>;
};

/**
 * A video shown with a reading, open to every reader. `src` is videos/<file> in the
 * repository; `poster` is the still shown before it plays (usually the reading's picture).
 */
export type StoryVideo = {
  src: string;
  poster?: string;
  /** Short description. Gray caption under the video. */
  credit?: string;
  captions?: Partial<Record<Lang, string>>;
};

export type Story = {
  id: string;
  /** Missing status preserves publication of existing files. */
  status?: "draft" | "published";
  author?: string;
  updatedAt?: string;
  theme: Theme;
  date: string;
  sources: Source[];
  image?: StoryImage;
  video?: StoryVideo;
  /**
   * Members-only reading: the bodies in this file are only the opening, readable by all;
   * the full text of each language is written in the editor panel and kept in Supabase.
   */
  membersOnly?: boolean;
  /**
   * The weekly issue the reading belongs to (1, 2, 3, …). The newest issue fills the top of
   * the front page; older issues move down. Readings without one follow by date.
   */
  issue?: number;
  /** Its place in the issue: 1 is the most important and gets the largest box, then 2, 3, … */
  rank?: number;
  /** Chosen by the editor for "Editor's picks" on the front page: 1 shows first, then 2. */
  pick?: number;
  locales: Record<Lang, LocaleCopy>;
};

export function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value);
}

export function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value);
}

/** Older two-part sections, mapped to the first half of their old label. */
const LEGACY_THEMES: Record<string, Theme> = {
  cities: "politics",
  trade: "science",
  knowledge: "culture",
};

/** A current section, or the new home of an old two-part one; otherwise undefined. */
export function toTheme(value: string): Theme | undefined {
  return isTheme(value) ? value : LEGACY_THEMES[value];
}

export function normalizeTheme(value: string): Theme {
  return toTheme(value) ?? "research";
}

export function emptyLocale(): LocaleCopy {
  return { title: "", dek: "", region: "", body: "", audio: null };
}

export function blankStory(): Story {
  return {
    id: crypto.randomUUID(),
    theme: "climate",
    date: new Date().toISOString().slice(0, 10),
    sources: [],
    locales: {
      tr: emptyLocale(),
      ar: emptyLocale(),
      en: emptyLocale(),
      fr: emptyLocale(),
      es: emptyLocale(),
    },
  };
}

/** What the front page and section pages know about a reading in one language. */
export type LocaleCard = {
  title: string;
  dek: string;
  region: string;
  /** First paragraph as plain text, for a card without a summary. */
  lead: string;
  /** The opening paragraphs, about 3,000 characters, to fill a desktop column. */
  opening?: string;
  minutes: number;
  /** Whether the reading has a text in this language. */
  written: boolean;
  /** The spoken reading in this language (audio/…), when one has been filed. */
  audio?: string;
};

/** A reading as listed on the front page; the full text is loaded when it is opened. */
export type StoryCard = {
  id: string;
  author?: string;
  updatedAt?: string;
  /** File name in content/stories. */
  file: string;
  theme: Theme;
  date: string;
  image?: StoryImage;
  /** The documents the reading rests on, for the chain of documents on the front page. */
  sources?: Source[];
  /** The story file holds only the opening; see Story.membersOnly. */
  membersOnly?: boolean;
  /** See Story.issue and Story.rank. */
  issue?: number;
  rank?: number;
  pick?: number;
  locales: Record<Lang, LocaleCard>;
};

/**
 * A video of its own, not tied to any reading or issue: content/videos/<id>.json.
 * It has its own page with the transcript under it, appears in the media strip on the
 * front page (newest first) and is found by the search through its title and transcript.
 * `src` and `poster` are paths in the repository (videos/…, images/…) or full addresses.
 */
export type VideoCopy = {
  title: string;
  /** One sentence under the title. */
  dek: string;
  /** Everything said in the video, paragraphs separated by a blank line. */
  transcript: string;
};

export type Video = {
  id: string;
  status?: "draft" | "published";
  date: string;
  src: string;
  poster?: string;
  /** Length in seconds. */
  duration?: number;
  locales: Partial<Record<Lang, VideoCopy>>;
};

/** What the front page and the list of videos know about a video; no transcript. */
export type VideoCard = {
  id: string;
  file: string;
  date: string;
  src: string;
  poster?: string;
  duration?: number;
  locales: Partial<Record<Lang, { title: string; dek: string }>>;
};
