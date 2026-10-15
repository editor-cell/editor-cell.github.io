import { paymentOn } from "@/lib/members/plans";
import { aboutCopy } from "@/lib/about-copy";
import { copyFor, langMeta } from "@/lib/i18n";
import { DEFAULT_LANG, publicPath, type MemberPage } from "@/lib/lang-path";
import { pagesCopy } from "@/lib/members/pages-copy";
import { legalCopy, type LegalPage } from "@/lib/legal-copy";
import { searchCopy } from "@/lib/search";
import { LANGS, type Lang, type StoryCard, type Theme, type VideoCard } from "@/lib/types";
import { videoWords } from "@/lib/videos";

/**
 * The public address of the site. Link previews (WhatsApp, X, Telegram), the canonical
 * address, the language alternates and the sitemap are built from it. Change it here if
 * the site moves to its own domain (scripts/pages-shell.mjs reads the same value).
 */
export const SITE_URL = "https://orbisreadingatlas.com";
export const SITE_NAME = "Orbis";

/**
 * The test period before the launch: every page carries a thin "in test" strip under the
 * header and asks search engines not to list it. On launch day set this to false.
 */
export const TRIAL = true;

const TRIAL_NOTE: Record<Lang, string> = {
  tr: "Orbis deneme yayınında. Buradaki yazılar geçicidir.",
  ar: "أوربيس في مرحلة تجريبية. القراءات هنا مؤقتة.",
  en: "Orbis is in test. The readings here are provisional.",
  fr: "Orbis est en test. Les lectures publiées ici sont provisoires.",
  es: "Orbis está en pruebas. Las lecturas de aquí son provisionales.",
};
export function trialNote(lang: Lang): string {
  return TRIAL_NOTE[lang];
}
/** The 1200×630 card shown when a page without its own picture is shared. */
export const SITE_CARD = `${SITE_URL}/og.jpg?v=20261015-3`;

const DESCRIPTION: Record<Lang, string> = {
  tr: "Orbis: İngilizce ve Türkçe kaynaklı okumalar.",
  ar: "أوربيس: قراءات موثّقة بمصادرها بالإنجليزية والتركية.",
  en: "Orbis: sourced readings in English and Turkish.",
  fr: "Orbis : des lectures sourcées en anglais et en turc.",
  es: "Orbis: lecturas con fuentes en inglés y turco.",
};
export const SITE_DESCRIPTION = DESCRIPTION.en;

const SECTION_DESCRIPTION: Record<Lang, (name: string) => string> = {
  tr: (name) => `Orbis'in ${name} bölümündeki okumalar.`,
  ar: (name) => `قراءات قسم ${name} في أوربيس.`,
  en: (name) => `${name} readings on Orbis.`,
  fr: (name) => `Les lectures de la rubrique ${name} sur Orbis.`,
  es: (name) => `Las lecturas de la sección ${name} en Orbis.`,
};

const OG_LOCALE: Record<Lang, string> = {
  tr: "tr_TR",
  ar: "ar_AR",
  en: "en_GB",
  fr: "fr_FR",
  es: "es_ES",
};

type Meta = Record<string, unknown>;
type Link = Record<string, string>;

export function feedLink(lang: Lang): Link {
  return {
    rel: "alternate",
    type: "application/rss+xml",
    title: lang === DEFAULT_LANG ? SITE_NAME : `${SITE_NAME} (${langMeta[lang].name})`,
    href: absoluteUrl(publicPath(lang, "/feed.xml")),
  };
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Plain text, source markers like [1] removed, cut at a word near `max` characters. */
export function clip(text: string, max = 160): string {
  const plain = text
    .replace(/\s*\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/** Title, description and the link-preview tags for one page. */
export function pageMeta({
  title,
  description,
  url,
  lang = DEFAULT_LANG,
  image = SITE_CARD,
  type = "website",
}: {
  title: string;
  description: string;
  url: string;
  lang?: Lang;
  image?: string;
  type?: "website" | "article";
}): Meta[] {
  const picture = absoluteUrl(image);
  return [
    { title },
    { name: "description", content: description },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: type },
    { property: "og:locale", content: OG_LOCALE[lang] },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: absoluteUrl(url) },
    { property: "og:image", content: picture },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: picture },
  ];
}

/**
 * The canonical address of this page, and the same page in each language it exists in,
 * so a search engine shows the Turkish page to a Turkish reader.
 */
function addressLinks(lang: Lang, path: string, langs: readonly Lang[]): Link[] {
  const links: Link[] = [{ rel: "canonical", href: absoluteUrl(publicPath(lang, path)) }];
  for (const code of langs) {
    links.push({ rel: "alternate", hrefLang: code, href: absoluteUrl(publicPath(code, path)) });
  }
  if (langs.includes(DEFAULT_LANG)) {
    links.push({
      rel: "alternate",
      hrefLang: "x-default",
      href: absoluteUrl(publicPath(DEFAULT_LANG, path)),
    });
  }
  return links;
}

export function homeHead(lang: Lang) {
  return {
    meta: pageMeta({
      title: SITE_NAME,
      description: DESCRIPTION[lang],
      url: publicPath(lang, "/"),
      lang,
    }),
    links: addressLinks(lang, "/", LANGS),
  };
}

export function sectionHead(lang: Lang, theme: Theme) {
  const name = copyFor(lang).themes[theme];
  const path = `/${theme}`;
  return {
    meta: pageMeta({
      title: `${name} — ${SITE_NAME}`,
      description: SECTION_DESCRIPTION[lang](name),
      url: publicPath(lang, path),
      lang,
    }),
    links: addressLinks(lang, path, LANGS),
  };
}

/** Head of the About page in one language. */
export function aboutHead(lang: Lang) {
  const about = aboutCopy(lang);
  const path = "/about";
  return {
    meta: pageMeta({
      title: `${about.title} — ${SITE_NAME}`,
      description: clip(about.body),
      url: publicPath(lang, path),
      lang,
    }),
    links: addressLinks(lang, path, LANGS),
  };
}

/**
 * Head of the membership, payment or newsletter page in one language. The payment page
 * stays out of search engines; the other two are indexed.
 */
export function memberPageHead(lang: Lang, page: MemberPage) {
  const words = pagesCopy(lang)[page];
  const path = `/${page}`;
  const meta = pageMeta({
    title: `${words.title} — ${SITE_NAME}`,
    // While membership is free only, the membership page is described as it now reads.
    description: clip(
      page === "membership" && !paymentOn ? pagesCopy(lang).membership.freeLead : words.lead,
    ),
    url: publicPath(lang, path),
    lang,
  });
  return {
    meta: page === "payment" ? [...meta, { name: "robots", content: "noindex, follow" }] : meta,
    links: addressLinks(lang, path, LANGS),
  };
}

/** Head of the terms or privacy page in one language. */
export function legalHead(lang: Lang, page: LegalPage) {
  const doc = legalCopy(lang)[page];
  const path = `/${page}`;
  return {
    meta: pageMeta({
      title: `${doc.title} — ${SITE_NAME}`,
      description: clip(doc.lead),
      url: publicPath(lang, path),
      lang,
    }),
    links: addressLinks(lang, path, LANGS),
  };
}

/**
 * Head of the search page in one language. A results page is not a page to index, but
 * its links are followed.
 */
export function searchHead(lang: Lang) {
  const words = searchCopy(lang);
  const path = "/search";
  return {
    meta: [
      ...pageMeta({
        title: `${words.title} — ${SITE_NAME}`,
        description: words.description,
        url: publicPath(lang, path),
        lang,
      }),
      { name: "robots", content: "noindex, follow" },
    ],
    links: addressLinks(lang, path, LANGS),
  };
}

/** Head of a reading page in one language. */
export function storyHead(card: StoryCard | undefined, lang: Lang) {
  if (!card) {
    return {
      meta: [{ title: SITE_NAME }, { name: "robots", content: "noindex" }],
    };
  }
  const path = `/read/${card.id}`;
  const written = LANGS.filter((code) => card.locales[code].written);
  // A language without this text shows a notice pointing to the others: not a page to index.
  const own = card.locales[lang].written ? lang : (written[0] ?? DEFAULT_LANG);
  const copy = card.locales[own];
  const title = copy.title.trim() || card.locales.en.title.trim() || SITE_NAME;
  const description = clip(copy.dek || copy.lead) || DESCRIPTION[lang];
  const image = card.image?.src || SITE_CARD;
  const url = publicPath(lang, path);
  return {
    meta: [
      ...pageMeta({
        title: `${title} — ${SITE_NAME}`,
        description,
        url,
        lang,
        image,
        type: "article",
      }),
      { property: "article:published_time", content: card.date },
      ...(own === lang
        ? [
            {
              "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "Article",
                headline: title,
                description,
                datePublished: card.date,
                ...(card.updatedAt ? { dateModified: card.updatedAt } : {}),
                ...(card.author?.trim()
                  ? {
                      author: {
                        "@type": "Person",
                        name: card.author.trim(),
                      },
                    }
                  : {}),
                inLanguage: lang,
                image: [absoluteUrl(image)],
                mainEntityOfPage: absoluteUrl(url),
                publisher: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
              },
            },
          ]
        : [{ name: "robots", content: "noindex" }]),
    ],
    links: own === lang ? addressLinks(lang, path, written) : [],
  };
}

/** The list of every video: /media, /tr/media. */
export function mediaHead(lang: Lang) {
  const words = videoWords(lang);
  const path = "/media";
  return {
    meta: pageMeta({
      title: `${words.videos} — ${SITE_NAME}`,
      description: words.listNote,
      url: publicPath(lang, path),
      lang,
    }),
    links: addressLinks(lang, path, LANGS),
  };
}

/** One video's page. A language without its title points to the others and is not indexed. */
export function videoHead(card: VideoCard | undefined, lang: Lang) {
  if (!card) {
    return { meta: [{ title: SITE_NAME }, { name: "robots", content: "noindex" }] };
  }
  const path = `/media/${card.id}`;
  const written = LANGS.filter((code) => Boolean(card.locales[code]?.title));
  const own = card.locales[lang] ? lang : (written[0] ?? DEFAULT_LANG);
  const copy = card.locales[own];
  const title = copy?.title || SITE_NAME;
  const description = clip(copy?.dek ?? "") || DESCRIPTION[lang];
  const image = card.poster || SITE_CARD;
  const url = publicPath(lang, path);
  return {
    meta: [
      ...pageMeta({ title: `${title} — ${SITE_NAME}`, description, url, lang, image }),
      ...(own === lang ? [] : [{ name: "robots", content: "noindex" }]),
    ],
    links: own === lang ? addressLinks(lang, path, written) : [],
  };
}
