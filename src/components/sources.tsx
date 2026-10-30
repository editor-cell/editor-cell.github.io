import { safeHttpUrl } from "@/lib/text";
import type { Lang, Source } from "@/lib/types";

/**
 * The documents a reading rests on, at its foot, numbered as in the text: who issued each,
 * what it is called, and where it lives. Always open: the list is short, and a number in
 * the text (prose.tsx) scrolls to its document and lights it for a moment.
 */

const WORDS: Record<Lang, { title: string; note: string; opens: string }> = {
  en: {
    title: "Documents",
    note: "The public documents this reading rests on.",
    opens: "opens in a new tab",
  },
  tr: {
    title: "Belgeler",
    note: "Bu yazının dayandığı kamusal belgeler.",
    opens: "yeni sekmede açılır",
  },
  ar: {
    title: "الوثائق",
    note: "الوثائق العامة التي تستند إليها هذه القراءة.",
    opens: "يُفتح في علامة تبويب جديدة",
  },
  fr: {
    title: "Documents",
    note: "Les documents publics sur lesquels repose cette lecture.",
    opens: "s’ouvre dans un nouvel onglet",
  },
  es: {
    title: "Documentos",
    note: "Los documentos públicos en los que se apoya esta lectura.",
    opens: "se abre en una pestaña nueva",
  },
};

/** "IPCC – Sixth Assessment Report" becomes the issuer and the document's name. */
export function splitSource(label: string): { issuer: string; title: string } {
  const at = label.search(/\s[–—-]\s/);
  if (at < 0) return { issuer: "", title: label };
  return { issuer: label.slice(0, at).trim(), title: label.slice(at + 3).trim() };
}

export function Sources({
  sources,
  lang,
  endRef,
}: {
  sources: Source[];
  lang: Lang;
  /** The end of the reading, for the progress line on a phone. */
  endRef?: (node: HTMLElement | null) => void;
}) {
  const list = [...sources].sort((a, b) => a.n - b.n);
  if (list.length === 0) return null;
  const words = WORDS[lang];
  return (
    <section ref={endRef} className="sources" aria-labelledby="sources-title">
      <h2 id="sources-title" className="sources-title">
        {words.title}
      </h2>
      <p className="sources-note">{words.note}</p>
      <ol className="sources-list">
        {list.map((source) => {
          const { issuer, title } = splitSource(source.label);
          const href = safeHttpUrl(source.url);
          const host = href ? new URL(href).hostname.replace(/^www\./, "") : "";
          const body = (
            <>
              {issuer ? <span className="source-issuer">{issuer}</span> : null}
              <span className="source-doc">{title}</span>
              {host ? (
                <span className="source-host" dir="ltr">
                  {host}
                </span>
              ) : null}
            </>
          );
          return (
            <li key={source.n} id={`source-${source.n}`} className="source-row">
              <span className="source-n figures">{source.n}</span>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="source-link">
                  {body}
                  <span className="sr-only"> ({words.opens})</span>
                </a>
              ) : (
                <span className="source-link">{body}</span>
              )}
              {href ? (
                <span className="source-url print-only" dir="ltr">
                  {href}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
