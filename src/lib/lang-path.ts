import { LANGS, type Lang, type Theme } from "@/lib/types";

/**
 * Every page exists once per language. English, the default, keeps the plain address
 * (/read/carbon-books); the others carry their code in front (/tr/read/carbon-books).
 * A shared link therefore opens in the language it was read in.
 */

export const LANG_KEY = "orbis-lang";
export const DEFAULT_LANG: Lang = "en";
/** Languages whose pages carry a prefix: all but the default. */
export const PREFIXED = LANGS.filter((code) => code !== DEFAULT_LANG);

export function isPrefixed(value: string): value is Lang {
  return (PREFIXED as readonly string[]).includes(value);
}

/** The language a reader page is in, read from its address. */
export function langFromPath(pathname: string): Lang {
  const first = pathname.split("/")[1] ?? "";
  return isPrefixed(first) ? first : DEFAULT_LANG;
}

/** The address without its language prefix: /tr/read/x → /read/x, /tr → /. */
export function stripLang(pathname: string): string {
  const first = pathname.split("/")[1] ?? "";
  if (!isPrefixed(first)) return pathname || "/";
  return pathname.slice(first.length + 1) || "/";
}

/** The same page in another language. */
export function withLang(lang: Lang, path: string): string {
  const bare = stripLang(path);
  if (lang === DEFAULT_LANG) return bare;
  return bare === "/" ? `/${lang}` : `/${lang}${bare}`;
}

/**
 * The address a crawler should use. A language's front page is a folder on the host
 * (tr/index.html), which answers at /tr/ without a redirect.
 */
export function publicPath(lang: Lang, path: string): string {
  const full = withLang(lang, path);
  return lang !== DEFAULT_LANG && stripLang(path) === "/" ? `${full}/` : full;
}

/** Keeps the reader's choice: the panel opens in it, and plain addresses lead to it. */
export function rememberLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* the address still carries the language */
  }
}

// Link targets for <Link {...}>, one per page kind.
export function homeLink(lang: Lang) {
  return lang === DEFAULT_LANG
    ? ({ to: "/" } as const)
    : ({ to: "/$section", params: { section: lang } } as const);
}

export function sectionLink(lang: Lang, theme: Theme) {
  return lang === DEFAULT_LANG
    ? ({ to: "/$section", params: { section: theme } } as const)
    : ({ to: "/$lang/$section", params: { lang, section: theme } } as const);
}

export function readLink(lang: Lang, storyId: string) {
  return lang === DEFAULT_LANG
    ? ({ to: "/read/$storyId", params: { storyId } } as const)
    : ({ to: "/$lang/read/$storyId", params: { lang, storyId } } as const);
}

/** The list of every video. */
export function mediaLink(lang: Lang) {
  return lang === DEFAULT_LANG
    ? ({ to: "/media" } as const)
    : ({ to: "/$lang/media", params: { lang } } as const);
}

/** One video's page, with its transcript. */
export function videoLink(lang: Lang, videoId: string) {
  return lang === DEFAULT_LANG
    ? ({ to: "/media/$videoId", params: { videoId } } as const)
    : ({ to: "/$lang/media/$videoId", params: { lang, videoId } } as const);
}

export function searchLink(lang: Lang) {
  return lang === DEFAULT_LANG
    ? ({ to: "/search" } as const)
    : ({ to: "/$lang/search", params: { lang } } as const);
}

export function aboutLink(lang: Lang) {
  return lang === DEFAULT_LANG
    ? ({ to: "/about" } as const)
    : ({ to: "/$lang/about", params: { lang } } as const);
}

/**
 * The member's account page; `back` is the page to return to after signing in, and
 * `join` opens the form on "Join Free" instead of "Sign in".
 */
export function accountLink(lang: Lang, back?: string, join?: boolean) {
  const search: { back?: string; join?: true } = {};
  if (back) search.back = back;
  if (join) search.join = true;
  return lang === DEFAULT_LANG
    ? ({ to: "/account", search } as const)
    : ({ to: "/$lang/account", params: { lang }, search } as const);
}

/**
 * Runs in <head> before the page paints.
 * The site always opens in English. Language is never inferred from the browser
 * language or from location. A choice is stored only when the reader picks a
 * language in the menu (see rememberLang), and the next visit to a plain address
 * opens in that language.
 * 1. An old section link (/?s=climate) goes to the section's current address (/climate-environment).
 * 2. A stored manual choice other than English sends a plain front page or section
 *    page to that language. A reading's address is never changed, so a shared link
 *    opens in the language it was shared in. An address that already names a
 *    language is never changed, and the panel is left alone.
 */
const PLAIN_PAGE = `/^\\/(${[...PREFIXED, "panel", "editor"].join("|")})(\\/|$)/`;
const FRONT_OR_SECTION = `/^\\/([a-z-]+(\\.html)?)?$/`;
export const LANG_BOOT = [
  "try{",
  'var p=location.pathname,s=new URLSearchParams(location.search).get("s");',
  'if(p==="/"&&s&&/^[a-z-]+$/.test(s)){location.replace("/"+s)}else{',
  `var l=localStorage.getItem("${LANG_KEY}");`,
  `if(l&&${JSON.stringify(PREFIXED)}.indexOf(l)>-1&&${FRONT_OR_SECTION}.test(p)&&!${PLAIN_PAGE}.test(p)){`,
  'location.replace("/"+l+(p==="/"?"":p)+location.search+location.hash)}}',
  "}catch(e){}",
].join("");

/** The membership, payment and newsletter pages, one address per language. */
export type MemberPage = "membership" | "payment" | "newsletter";

export function memberPageLink(lang: Lang, page: MemberPage) {
  if (lang === DEFAULT_LANG) {
    return page === "membership"
      ? ({ to: "/membership" } as const)
      : page === "payment"
        ? ({ to: "/payment" } as const)
        : ({ to: "/newsletter" } as const);
  }
  return page === "membership"
    ? ({ to: "/$lang/membership", params: { lang } } as const)
    : page === "payment"
      ? ({ to: "/$lang/payment", params: { lang } } as const)
      : ({ to: "/$lang/newsletter", params: { lang } } as const);
}

/** Terms of use and privacy policy, one address per language. */
export function legalLink(lang: Lang, page: "terms" | "privacy") {
  if (lang === DEFAULT_LANG) {
    return page === "terms" ? ({ to: "/terms" } as const) : ({ to: "/privacy" } as const);
  }
  return page === "terms"
    ? ({ to: "/$lang/terms", params: { lang } } as const)
    : ({ to: "/$lang/privacy", params: { lang } } as const);
}
