import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCopy } from "@/lib/i18n";
import { publicPath, readLink } from "@/lib/lang-path";
import { placeLine } from "@/lib/places";
import { CARDS } from "@/lib/seed";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { storyTitle } from "@/lib/text";
import type { Lang, Story, StoryCard } from "@/lib/types";

/**
 * What sits at the end of a reading and around it, open to every reader:
 * - a passage copied from the reading carries its source with it;
 * - a downloadable PDF containing the reading and its sources;
 * - a few related readings, same section first.
 */

const WORDS: Record<
  Lang,
  {
    source: string;
    pdf: string;
    pdfLong: string;
    related: string;
  }
> = {
  tr: {
    source: "Kaynak",
    pdf: "PDF",
    pdfLong: "PDF indir",
    related: "İlgili okumalar",
  },
  en: {
    source: "Source",
    pdf: "PDF",
    pdfLong: "Download PDF",
    related: "Related readings",
  },
  ar: {
    source: "المصدر",
    pdf: "PDF",
    pdfLong: "تنزيل PDF",
    related: "قراءات ذات صلة",
  },
  fr: {
    source: "Source",
    pdf: "PDF",
    pdfLong: "Télécharger le PDF",
    related: "Lectures liées",
  },
  es: {
    source: "Fuente",
    pdf: "PDF",
    pdfLong: "Descargar PDF",
    related: "Lecturas relacionadas",
  },
};

/** The public address of a reading in a language. */
export function readingUrl(lang: Lang, storyId: string): string {
  return absoluteUrl(publicPath(lang, `/read/${storyId}`));
}

/**
 * The selected text without the source numbers (and their hidden "source" word), with its
 * paragraph breaks. The copy is laid out off screen for a moment so the browser can say
 * where its lines break.
 */
function cleanSelection(selection: Selection): string {
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-99999px;top:0;width:40rem;white-space:normal";
  for (let i = 0; i < selection.rangeCount; i++) {
    holder.appendChild(selection.getRangeAt(i).cloneContents());
  }
  holder.querySelectorAll("a.cite, .sr-only, button").forEach((node) => node.remove());
  document.body.appendChild(holder);
  const text = holder.innerText;
  holder.remove();
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ +([.,;:!?])/g, "$1");
}

/**
 * A passage of eight words or more copied from inside `area` gets the reading's title and
 * address under it. A word or two copied to look up stays as it is.
 */
export function useSignedCopy(
  area: React.RefObject<HTMLElement | null>,
  story: Story | null,
  lang: Lang,
) {
  useEffect(() => {
    const el = area.current;
    if (!el || !story) return;
    const onCopy = (event: ClipboardEvent) => {
      const selection = window.getSelection();
      if (!event.clipboardData || !selection || selection.rangeCount === 0) return;
      const text = cleanSelection(selection);
      if (text.trim().split(/\s+/).length < 8) return;
      const title = storyTitle(story, lang);
      const url = readingUrl(lang, story.id);
      const line = `${WORDS[lang].source}: ${title}, ${SITE_NAME}. ${url}`;
      const escape = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      event.clipboardData.setData("text/plain", `${text.trim()}\n\n${line}`);
      event.clipboardData.setData(
        "text/html",
        `<p>${escape(text.trim()).replace(/\n+/g, "</p><p>")}</p><p>${escape(
          `${WORDS[lang].source}: ${title}, ${SITE_NAME}.`,
        )} <a href="${url}">${url}</a></p>`,
      );
      event.preventDefault();
    };
    el.addEventListener("copy", onCopy);
    return () => el.removeEventListener("copy", onCopy);
  }, [area, story, lang]);
}

/** PDFs are produced from public readings with every site build. */
export function PdfButton({ story, lang }: { story: Story; lang: Lang }) {
  const words = WORDS[lang];
  const published = CARDS.find((card) => card.id === story.id);
  if (story.status === "draft" || story.membersOnly || !published?.locales[lang].written) return null;
  return (
    <a
      href={`/assets/pdf/${lang}/${encodeURIComponent(story.id)}.pdf`}
      download={`orbis-${story.id}-${lang}.pdf`}
      title={words.pdfLong}
      className="reading-tool"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true" className="reading-tool-mark">
        <path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M4 16.5h12" />
      </svg>
      <span dir="ltr">{words.pdf}</span>
      <span className="sr-only">{words.pdfLong}</span>
    </a>
  );
}

/** Up to three other readings in this language: same section first, then the newest. */
function relatedCards(story: Story, lang: Lang): StoryCard[] {
  const pool = CARDS.filter((card) => card.id !== story.id && card.locales[lang].written);
  const newest = (a: StoryCard, b: StoryCard) => b.date.localeCompare(a.date);
  const same = pool.filter((card) => card.theme === story.theme).sort(newest);
  const rest = pool.filter((card) => card.theme !== story.theme).sort(newest);
  return [...same, ...rest].slice(0, 3);
}

export function RelatedReadings({ story, lang }: { story: Story; lang: Lang }) {
  const copy = useCopy(lang);
  const cards = relatedCards(story, lang);
  if (!cards.length) return null;
  return (
    <section className="related" aria-labelledby="related-heading">
      <h2 id="related-heading" className="related-title">
        {WORDS[lang].related}
      </h2>
      <ol className="related-list">
        {cards.map((card) => {
          const locale = card.locales[lang];
          const places = placeLine(locale.region, lang);
          return (
            <li key={card.id} className="related-item">
              <h3 className="related-item-title">
                <Link {...readLink(lang, card.id)}>{storyTitle(card, lang)}</Link>
              </h3>
              {locale.dek ? <p className="related-dek">{locale.dek.match(/^.*?[.!?؟۔](?=\s|$)/)?.[0] || locale.dek}</p> : null}
              <p className="meta">
                {places ? <span className="meta-places">{places}</span> : null}
                <span className="meta-section">{copy.themes[card.theme]}</span>
                {locale.minutes ? (
                  <span className="meta-time">
                    {locale.minutes} {copy.min}
                  </span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
