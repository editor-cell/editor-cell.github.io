import { Link } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { Trail } from "@/components/trail";
import { EDITORIAL } from "@/lib/editorial";
import { legalLink } from "@/lib/lang-path";
import { LEGAL_PAGES, LEGAL_UPDATED, legalCopy, type LegalPage } from "@/lib/legal-copy";
import { pagesCopy } from "@/lib/members/pages-copy";
import { periodsFor, price } from "@/lib/members/plans";
import { formatDate } from "@/lib/text";
import type { Lang } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

/** Puts the publisher's name, the contact address and the prices into a paragraph. */
function fill(text: string, lang: Lang): string {
  const publisher = EDITORIAL.publisherName.trim() || "Orbis";
  const email = EDITORIAL.contactEmail.trim();
  const per = pagesCopy(lang).membership.per;
  const prices = periodsFor(lang)
    .map((period) => `${price(period, lang)} / ${per[period]}`)
    .join(", ");
  return text
    .replaceAll("{publisher}", publisher)
    .replaceAll("{email}", email)
    .replaceAll("{prices}", prices);
}

/** One legal page: title, date, numbered sections, and the other page at the foot. */
export function LegalPageView({ page }: { page: LegalPage }) {
  const lang = useLang();
  const all = legalCopy(lang);
  const doc = all[page];
  return (
    <Shell>
      <main className="px-5 py-10 md:px-12 md:py-14">
        <article className="mx-auto flex max-w-2xl flex-col gap-8">
          <Trail lang={lang} here={doc.title} className="-mb-3" />
          <header className="flex flex-col gap-4">
            <h1 className="text-4xl md:text-5xl">{doc.title}</h1>
            <p className="text-pretty text-lg text-muted">{fill(doc.lead, lang)}</p>
            <p className="text-sm text-muted">
              {all.updated}: {formatDate(LEGAL_UPDATED, lang)}
            </p>
          </header>
          <div className="flex flex-col border-t border-rule">
            {doc.sections.map((section, i) => (
              <section
                key={section.heading}
                className="flex flex-col gap-3 border-b border-line py-6"
              >
                <h2 className="flex items-baseline gap-3 text-xl md:text-2xl">
                  <span className="text-sm text-muted tabular-nums">{i + 1}.</span>
                  {section.heading}
                </h2>
                {section.paragraphs.map((para) => (
                  <p key={para} className="text-pretty">
                    {fill(para, lang)}
                  </p>
                ))}
              </section>
            ))}
          </div>
          <nav aria-label={all.related} className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {LEGAL_PAGES.filter((other) => other !== page).map((other) => (
              <Link
                key={other}
                {...legalLink(lang, other)}
                className="inline-flex min-h-11 items-center text-pine"
              >
                {all[other].title}
              </Link>
            ))}
          </nav>
        </article>
      </main>
    </Shell>
  );
}
