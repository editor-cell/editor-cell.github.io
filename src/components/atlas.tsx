import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CardListen, ReadTime } from "@/components/read-time";
import { Shell } from "@/components/shell";
import { useFrameCopy } from "@/lib/frame-copy";
import { imageSet } from "@/lib/image-set";
import { frontOrder } from "@/lib/front-order";
import { imageCaption } from "@/lib/editorial";
import { langMeta, useCopy } from "@/lib/i18n";
import { readLink } from "@/lib/lang-path";
import { CARDS } from "@/lib/seed";
import { formatDate, safeHttpUrl, storyTitle } from "@/lib/text";
import type { Lang, Source, StoryCard as Story, Theme } from "@/lib/types";
import { useMostRead } from "@/lib/reads";
import { DEPTH_KEY } from "@/lib/depth-boot";
import { MediaStrip } from "@/components/videos";
import { useLang } from "@/lib/use-lang";

/**
 * Section pages keep the lead reading and ruled columns. The front page alone
 * is a newspaper page: a large pictured lead, a narrow column beside it, then the rest.
 */

function Meta({ story, lang, section }: { story: Story; lang: Lang; section: Theme | "all" }) {
  const copy = useCopy(lang);
  const minutes = story.locales[lang].minutes;
  return (
    <div className="mt-1 flex flex-col items-start gap-1 text-xs text-muted">
      <p>
        {section === "all" ? (
          <>
            <span className="uppercase tracking-widest text-pine">{copy.themes[story.theme]}</span>
            {" · "}
          </>
        ) : null}
        <span className="whitespace-nowrap">{formatDate(story.date, lang)}</span>
      </p>
      {minutes ? <ReadTime minutes={minutes} lang={lang} pattern={copy.minRead} story={story} /> : null}
    </div>
  );
}

export function Atlas({ section }: { section: Theme | "all" }) {
  const lang = useLang();
  const stories = CARDS.filter((story) => story.locales[lang].written);
  const copy = useCopy(lang);
  const frame = useFrameCopy(lang);

  // The front page follows the issue and its ranks; a section page is newest first.
  const all =
    section === "all"
      ? frontOrder(stories)
      : [...stories].sort((a, b) => b.date.localeCompare(a.date));
  const sorted = all.filter((story) => section === "all" || story.theme === section);
  const latest = sorted[0];
  const home = section === "all";
  const cards = sorted.slice(1);

  if (stories.length === 0) {
    return (
      <main className="flex flex-col items-start gap-4 px-5 py-10 md:px-8">
        <p>{copy.emptyAtlas}</p>
      </main>
    );
  }

  const leadDek = latest?.locales[lang].dek?.trim() ?? "";

  return (
    <main>
      {/* The motto now sits under the name in the header; the front page names itself
          for screen readers only. A section page opens with its name, large. */}
      {home ? (
        <h1 className="sr-only">
          ORBIS — {copy.heroLead} {copy.hero}
        </h1>
      ) : (
        <div className="px-5 pt-6 pb-4 md:px-8 md:pt-8 md:pb-6">
          <h1 className="paper-title font-bold text-[2.4rem] leading-[1.05] md:text-[3rem]">
            {copy.themes[section]}
          </h1>
        </div>
      )}

      <div className={home ? "" : "md:border-t md:border-rule"}>
        {latest ? (
          home ? (
            <HomeGrid stories={sorted} lang={lang} />
          ) : (
            <>
            <SectionList stories={sorted} lang={lang} />
            <div className="hidden self-start md:block">
              <Link
                {...readLink(lang, latest.id)}
                className={`section-lead grid grid-cols-1 gap-6 border-b border-line px-5 py-7 md:px-8 md:py-10 ${
                  latest.image ? "md:grid-cols-2 md:gap-10" : ""
                }`}
              >
                {latest.image ? (
                  <Picture story={latest} eager fill className="section-lead-picture md:order-2" />
                ) : null}
                <div className="section-lead-text flex flex-col gap-3 md:order-1">
                  <h2 className="text-3xl leading-[1.1] md:text-5xl">{storyTitle(latest, lang)}</h2>
                  {leadDek ? (
                    <p className="max-w-2xl text-pretty text-lg leading-snug text-muted lg:text-xl">
                      {leadDek}
                    </p>
                  ) : (
                    <p className="font-body line-clamp-4 max-w-2xl text-pretty text-base leading-snug text-muted">
                      {latest.locales[lang].lead}
                    </p>
                  )}
                  <Meta story={latest} lang={lang} section={section} />
                </div>
              </Link>
              {chunk(cards, 4).map((row) => (
                <div
                  key={row[0].id}
                  className={`grid grid-cols-1 divide-y divide-line border-b border-line md:divide-x md:divide-y-0 ${COLS[row.length]}`}
                >
                  {row.map((story) => (
                    <Column key={story.id} story={story} lang={lang} section={section} />
                  ))}
                </div>
              ))}
            </div>
            </>
          )
        ) : (
          <p className="px-5 py-10 text-muted md:px-8">{frame.emptySection}</p>
        )}
      </div>
    </main>
  );
}

type SectionTab = "latest" | "deep" | "read";

/**
 * A section on a phone: three tabs over one list. "Latest" is newest first, "In depth" the
 * longest readings first, "Most read" the count kept since membership was switched on (the
 * tab appears only once there is a count). Each row: a small picture on the start side,
 * the title, its one-sentence summary and the date.
 */
function SectionList({ stories, lang }: { stories: Story[]; lang: Lang }) {
  const words = HOME_WORDS[lang];
  const [tab, setTab] = useState<SectionTab>("latest");
  const ranked = useMostRead(50);
  const ids = new Set(stories.map((story) => story.id));
  const byId = new Map(stories.map((story) => [story.id, story]));
  const mostRead = (ranked ?? [])
    .filter((id) => ids.has(id))
    .map((id) => byId.get(id))
    .filter((story): story is Story => Boolean(story));
  const deep = [...stories].sort(
    (a, b) => (b.locales[lang].minutes ?? 0) - (a.locales[lang].minutes ?? 0),
  );
  const tabs: { id: SectionTab; label: string; list: Story[] }[] = [
    { id: "latest", label: words.latest, list: stories },
    { id: "deep", label: words.inDepth, list: deep },
    ...(mostRead.length ? [{ id: "read" as const, label: words.mostRead, list: mostRead }] : []),
  ];
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  const caps = lang === "ar" ? "text-[13px]" : "text-[11px] uppercase tracking-[0.1em]";
  return (
    <div className="px-5 md:hidden">
      <div role="tablist" className="flex gap-6 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === current.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px inline-flex min-h-10 items-center border-b-2 ${caps} ${
              t.id === current.id ? "border-pine text-ink" : "border-transparent text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ol role="tabpanel">
        {current.list.map((story) => (
          <li key={story.id}>
            <Link
              {...readLink(lang, story.id)}
              className="section-list-row atlas-own group flex items-start gap-4 border-b border-line py-4"
            >
              {story.image ? (
                <div className="section-list-pic w-[7.25rem] shrink-0">
                  <img
                    src={story.image.src}
                    {...imageSet(story.image.src, "116px")}
                    alt={imageCaption(story.image, lang)}
                    width={240}
                    height={180}
                    loading="lazy"
                    decoding="async"
                    className="block h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <div className="section-list-text min-w-0 flex-1">
                <h2 className="paper-title font-bold text-[1.08rem] leading-[1.18] text-ink decoration-1 underline-offset-[0.14em] group-hover:underline">
                  {storyTitle(story, lang)}
                </h2>
                {cellSummary(story, lang) ? (
                  <p className="font-body line-clamp-3 pt-1 text-pretty text-[0.9rem] leading-[1.32] text-ink/85">
                    {cellSummary(story, lang)}
                  </p>
                ) : null}
                <p className="pt-1.5 text-xs text-muted">{formatDate(story.date, lang)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

const COLS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function oneSentence(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^.*?[.!?؟۔](?=\s|$)/);
  return match ? match[0] : trimmed;
}

function cellSummary(story: Story, lang: Lang): string {
  const dek = story.locales[lang].dek?.trim();
  return oneSentence(dek || story.locales[lang].lead);
}

/**
 * The front page, as an atlas page. The lead: its words on the left, its picture on the
 * right (the picture first on a phone). Under it two cards and a column of three short
 * items; on a phone each of them is a row with a small picture. Then the chain of documents
 * the lead rests on, and every other reading as records whose depth the reader sets.
 */
function HomeGrid({ stories, lang }: { stories: Story[]; lang: Lang }) {
  const dir = langMeta[lang].dir;
  const [depth, choose] = useDepth();
  const topRef = useTopFill(depth);
  // One box per rank of the issue: 1 the lead, 2 the large middle card, 3 the card at the
  // left, 4–8 the short readings (4 and 7 at the left, 5, 6 and 8 at the right). Rank 3 is
  // first in the page so the grid keeps its columns; on a phone rank 2 is moved up again.
  const [lead, ...rest] = stories;
  if (!lead) return null;
  const cards = rest.length > 1 ? [rest[1], rest[0]] : rest.slice(0, 1);
  const briefs = rest.slice(2, 7);
  // Desktop only: the next reading stands in a box under the large middle card, so the
  // middle column ends with the two beside it. On a phone it stays in the list below.
  const under = briefs.length === 5 ? rest[7] : undefined;
  const records = rest.slice(7);
  const words = HOME_WORDS[lang];
  const leadSummary = cellSummary(lead, lang);
  const arrow = dir === "rtl" ? "←" : "→";
  return (
    <div dir={dir}>
      <div className="px-5 md:px-8">
        <Link
          {...readLink(lang, lead.id)}
          className={`atlas-own group grid grid-cols-1 pt-4 pb-5 md:gap-[clamp(1.5rem,2.6vw,2.4rem)] md:py-6 ${
            lead.image ? "md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.65fr)]" : ""
          }`}
        >
          {lead.image ? (
            <div className="md:order-2" data-lead-picture>
              <CardPicture
                story={lead}
                lang={lang}
                ratio="aspect-[4/3] md:aspect-[3/2] md:h-full md:min-h-[22rem]"
                sizes="(min-width: 768px) 64vw, 100vw"
                eager
              />
            </div>
          ) : null}
          <div className="lead-text flex min-w-0 flex-col justify-center pt-4 md:order-1 md:py-6">
            <Kicker story={lead} lang={lang} />
            <h2 className="paper-title atlas-lead-title font-extrabold mt-2.5 text-ink decoration-2 underline-offset-[0.12em] group-hover:underline md:mt-4">
              {storyTitle(lead, lang)}
            </h2>
            {leadSummary ? (
              <p className="font-body mt-3 max-w-[36rem] text-pretty text-[1.075rem] leading-[1.35] text-ink md:mt-5 md:text-[1.2rem] md:leading-[1.3]">
                {leadSummary}
              </p>
            ) : null}
            <span className="atlas-more atlas-more-rule mt-3 md:mt-6">
              {words.readFull} <span aria-hidden="true">{arrow}</span>
            </span>
          </div>
        </Link>
      </div>

      {/* The chain sits right under the reading it belongs to, before any other card. */}
      <DocumentChain story={lead} lang={lang} />

      {/* From here down every reading follows the depth control, the top cards included. */}
      {rest.length ? <DepthBar lang={lang} depth={depth} choose={choose} /> : null}

      {cards.length ? (
        <div ref={topRef} className="records atlas-top px-5 md:px-8" data-depth={depth} suppressHydrationWarning>
          {cards.map((story) => (
            <Link
              key={story.id}
              {...readLink(lang, story.id)}
              className="atlas-own atlas-card group"
            >
              <FoldPicture story={story} lang={lang} />
              <div className="flex min-w-0 flex-col">
                <Kicker story={story} lang={lang} />
                <h3 className="paper-title font-bold mt-1.5 text-[1.2rem] leading-[1.12] text-ink decoration-1 underline-offset-[0.14em] group-hover:underline md:mt-2 md:text-[1.6rem] md:leading-[1.08] lg:text-[1.75rem]">
                  {storyTitle(story, lang)}
                </h3>
                <Fold layer={2}>
                  <p className="atlas-dek font-body mt-2 text-pretty text-base leading-[1.32] text-ink">
                    {cellSummary(story, lang)}
                  </p>
                </Fold>
                <DeepLines story={story} lang={lang} clamp="line-clamp-5" />
                <span className="atlas-more mt-2 text-[0.8rem] md:mt-3">
                  {words.readMore} <span aria-hidden="true">{arrow}</span>
                </span>
                <TopFill story={story} lang={lang} />
              </div>
            </Link>
          ))}
          {briefs.length ? (
            <div className="atlas-briefs">
              {briefs.map((story) => (
                <Brief key={story.id} story={story} lang={lang} />
              ))}
              {under ? <Brief story={under} lang={lang} className="atlas-brief-under" /> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Videos: one row between the newest issue and the archive. It stands apart from the
          readings, so the depth buttons above leave it as it is. */}
      <MediaStrip lang={lang} />

      <Records stories={records} lang={lang} depth={depth} deskSkip={under?.id} />
    </div>
  );
}

/** A short reading in the top boxes: picture, section, title, summary at depth 2, date at 3. */
function Brief({ story, lang, className = "" }: { story: Story; lang: Lang; className?: string }) {
  const words = HOME_WORDS[lang];
  const arrow = langMeta[lang].dir === "rtl" ? "←" : "→";
  return (
    <Link {...readLink(lang, story.id)} className={`atlas-own atlas-brief group ${className}`.trim()}>
      <FoldPicture story={story} lang={lang} />
      <div className="flex min-w-0 flex-col">
        <Kicker story={story} lang={lang} />
        <h3 className="paper-title font-bold mt-1.5 text-[1.2rem] leading-[1.12] text-ink decoration-1 underline-offset-[0.14em] group-hover:underline md:text-[1.1rem] md:leading-[1.15]">
          {storyTitle(story, lang)}
        </h3>
        {/* These follow the depth control like every other reading. On a wide screen
            the summary shows only where the column is wide enough (see .atlas-brief-dek
            in styles.css), held to three lines, and the opening lines stay out, so the
            column does not outgrow the two cards beside it and leave a gap under them. */}
        <Fold layer={2} className="atlas-brief-dek">
          <p className="atlas-dek font-body mt-2 text-pretty text-base leading-[1.32] text-ink md:line-clamp-3 md:text-[0.92rem]">
            {cellSummary(story, lang)}
          </p>
        </Fold>
        <Fold layer={3}>
          {openingLines(story, lang, cellSummary(story, lang)) ? (
            <p className="font-body line-clamp-5 pt-1.5 text-pretty text-[0.92rem] leading-[1.4] text-muted md:hidden">
              {openingLines(story, lang, cellSummary(story, lang))}
            </p>
          ) : null}
          <p className="pt-1 text-xs text-muted">{formatDate(story.date, lang)}</p>
        </Fold>
        <span className="atlas-more mt-2 text-[0.75rem]">
          {words.readMore} <span aria-hidden="true">{arrow}</span>
        </span>
      </div>
      <TopFill story={story} lang={lang} />
    </Link>
  );
}

/** A part of a card that opens from the given depth on. */
function Fold({
  layer,
  className = "",
  children,
}: {
  layer: 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`record-layer ${className}`.trim()} data-layer={layer}>
      <div>{children}</div>
    </div>
  );
}

/** A top card's picture: shown from depth 2, folded away at depth 1. */
function FoldPicture({ story, lang }: { story: Story; lang: Lang }) {
  if (!story.image) return <div className="atlas-pic-slot" />;
  return (
    <div className="record-layer atlas-pic-slot" data-layer="2">
      <div>
        <CardPicture story={story} lang={lang} ratio="atlas-card-pic" />
      </div>
    </div>
  );
}

/** At depth 3 a top card adds its opening lines and its date, as the records do. */
function DeepLines({ story, lang, clamp }: { story: Story; lang: Lang; clamp: string }) {
  const opening = openingLines(story, lang, cellSummary(story, lang));
  return (
    <Fold layer={3}>
      {opening ? (
        <p
          className={`deep-lines font-body ${clamp} pt-1.5 text-pretty text-[0.92rem] leading-[1.4] text-muted`}
        >
          {opening}
        </p>
      ) : null}
      <p className="pt-1 text-xs text-muted">{formatDate(story.date, lang)}</p>
    </Fold>
  );
}

/** The section in small capitals, with the reading time beside it in a quieter tone. */
function Kicker({ story, lang }: { story: Story; lang: Lang }) {
  const copy = useCopy(lang);
  const minutes = story.locales[lang].minutes;
  return (
    <p
      className={
        lang === "ar"
          ? "card-kicker text-sm leading-snug text-pine"
          : "card-kicker text-xs leading-snug uppercase tracking-[0.14em] text-pine"
      }
    >
      {copy.themes[story.theme]}
      {minutes ? (
        <span className="text-muted">
          {" · "}
          {/* "1 min read" stays on one line: in a narrow card it moves down whole. */}
          <span className="whitespace-nowrap">{copy.minRead.replace("{n}", String(minutes))}</span>
        </span>
      ) : null}
      <span className="whitespace-nowrap">
        <CardListen story={story} lang={lang} />
      </span>
    </p>
  );
}

/** Words for the two front-page parts below the lead, in the five languages. */
const HOME_WORDS: Record<
  Lang,
  {
    chain: string;
    chainNote: string;
    records: string;
    depth: [string, string, string];
    sources: { one: string; many: string };
    open: string;
    close: string;
    readFull: string;
    readMore: string;
    latest: string;
    inDepth: string;
    mostRead: string;
    more: string;
    /** Screen-reader name of the eight boxes of the newest issue (no visible heading). */
    thisIssue: string;
    /** Name of the depth buttons, for screen readers. */
    view: string;
    /** The visible heading over everything below the newest issue. */
    archive: string;
    /** The first column under it: the issue before the newest. */
    lastIssue: string;
    /** The middle column: readings the editor marked as picks. */
    picks: string;
  }
> = {
  tr: {
    chain: "Belge zinciri",
    chainNote: "Her belge kendi sayfasında açılır",
    records: "Kayıtlar",
    depth: ["Başlık", "Özet", "Derin"],
    sources: { one: "{n} kaynak", many: "{n} kaynak" },
    open: "Aç",
    close: "Kapat",
    readFull: "Yazının tamamı",
    readMore: "Devamı",
    latest: "Son yazılar",
    inDepth: "Uzun okuma",
    mostRead: "En çok okunanlar",
    more: "Diğer yazılar",
    thisIssue: "Bu sayı",
    view: "Görünüm",
    archive: "Arşivden",
    lastIssue: "Önceki sayı",
    picks: "Editörün seçtikleri",
  },
  en: {
    chain: "Document chain",
    chainNote: "Opens each document on its own page",
    records: "Records",
    depth: ["Headline", "Summary", "Deep"],
    sources: { one: "{n} source", many: "{n} sources" },
    open: "Open",
    close: "Close",
    readFull: "Read the full story",
    readMore: "Read more",
    latest: "Latest",
    inDepth: "Long read",
    mostRead: "Most read",
    more: "More readings",
    thisIssue: "This issue",
    view: "View",
    archive: "From the archive",
    lastIssue: "Last issue",
    picks: "Editor’s picks",
  },
  ar: {
    chain: "سلسلة الوثائق",
    chainNote: "تُفتح كل وثيقة في صفحتها",
    records: "السجلات",
    depth: ["العنوان", "الملخص", "معمّق"],
    sources: { one: "مصدر واحد", many: "{n} مصادر" },
    open: "فتح",
    close: "إغلاق",
    readFull: "اقرأ النص كاملًا",
    readMore: "المزيد",
    latest: "الأحدث",
    inDepth: "قراءة مطوّلة",
    mostRead: "الأكثر قراءة",
    more: "قراءات أخرى",
    thisIssue: "هذا العدد",
    view: "طريقة العرض",
    archive: "من الأرشيف",
    lastIssue: "العدد السابق",
    picks: "اختيارات المحرر",
  },
  fr: {
    chain: "Chaîne de documents",
    chainNote: "Chaque document s’ouvre sur sa propre page",
    records: "Registres",
    depth: ["Titre", "Résumé", "Approfondi"],
    sources: { one: "{n} source", many: "{n} sources" },
    open: "Ouvrir",
    close: "Fermer",
    readFull: "Lire en entier",
    readMore: "Lire la suite",
    latest: "Derniers",
    inDepth: "Lecture longue",
    mostRead: "Les plus lus",
    more: "Autres lectures",
    thisIssue: "Ce numéro",
    view: "Affichage",
    archive: "Dans les archives",
    lastIssue: "Numéro précédent",
    picks: "Le choix de la rédaction",
  },
  es: {
    chain: "Cadena de documentos",
    chainNote: "Cada documento se abre en su propia página",
    records: "Registros",
    depth: ["Titular", "Resumen", "A fondo"],
    sources: { one: "{n} fuente", many: "{n} fuentes" },
    open: "Abrir",
    close: "Cerrar",
    readFull: "Leer completo",
    readMore: "Leer más",
    latest: "Lo último",
    inDepth: "Lectura larga",
    mostRead: "Lo más leído",
    more: "Más lecturas",
    thisIssue: "Este número",
    view: "Vista",
    archive: "Del archivo",
    lastIssue: "Número anterior",
    picks: "Selección del editor",
  },
};

/** "4 sources": the count beside the chain label, singular where the language has one. */
function sourceCount(n: number, lang: Lang): string {
  const words = HOME_WORDS[lang].sources;
  return (n === 1 ? words.one : words.many).replace("{n}", String(n));
}

/** "IPCC – Sixth Assessment Report" becomes the issuer and the document name. */
function splitSource(label: string): { issuer: string; title: string } {
  const at = label.search(/\s[–—-]\s/);
  if (at < 0) return { issuer: "", title: label };
  return { issuer: label.slice(0, at).trim(), title: label.slice(at + 3).trim() };
}

/** The short name beside a link's dot: the issuer, or the document's first words. */
function shortName(label: string): string {
  const { issuer, title } = splitSource(label);
  return issuer || title.split(/\s+/).slice(0, 3).join(" ");
}

/**
 * A ruled strip under the lead, closed at first: the chain label, the source count, and a
 * preview of one dot per document joined by a hairline. On a phone only the first few
 * links show, with a "+2" continuation. Opened, the documents sit on one vertical rule,
 * numbered, each opening the document itself. A reading without filed sources shows nothing.
 */
/**
 * The chain of documents a reading rests on. On the front page it sits under the lead; at
 * the foot of a reading (`page`) it takes the place of a plain bibliography, each document
 * keeping its number and its #source-N anchor. In both places it is closed at first and opens
 * on demand. On a reading it also opens by itself when a number in the text is tapped
 * (the "orbis:open-chain" event from prose.tsx) or the address ends in #source-N.
 */
export function DocumentChain({
  story,
  lang,
  page = false,
}: {
  story: { id: string; sources?: Source[] };
  lang: Lang;
  page?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!page) return;
    const show = () => setOpen(true);
    if (/^#source-\d+$/.test(window.location.hash)) show();
    const onHash = () => {
      if (/^#source-\d+$/.test(window.location.hash)) show();
    };
    window.addEventListener("orbis:open-chain", show);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("orbis:open-chain", show);
      window.removeEventListener("hashchange", onHash);
    };
  }, [page]);
  const sources = [...(story.sources ?? [])].sort((a, b) => a.n - b.n);
  if (sources.length === 0) return null;
  const words = HOME_WORDS[lang];
  const arrow = langMeta[lang].dir === "rtl" ? "←" : "→";
  const label =
    lang === "ar" ? "text-sm text-pine" : "text-xs uppercase tracking-[0.14em] text-pine";
  const quiet =
    lang === "ar" ? "text-sm text-muted" : "text-xs uppercase tracking-[0.14em] text-muted";
  const panelId = `chain-${story.id}`;
  const phoneLinks = 3;
  const moreOnPhone = sources.length - phoneLinks;
  return (
    <section
      className="doc-chain"
      data-lang={lang}
      data-page={page || undefined}
      aria-label={words.chain}
    >
      <div className={page ? "px-4 md:px-6" : "px-5 md:px-8"}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((was) => !was)}
          className="doc-chain-toggle"
        >
          <span className="doc-chain-head">
            <span className="doc-chain-title-row">
              <span className="doc-chain-icon" aria-hidden="true">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className={`block ${label}`}>{words.chain}</span>
                <span className="doc-chain-note">{words.chainNote}</span>
              </span>
            </span>
            <span className="doc-chain-actions">
              <span className={`doc-chain-pill doc-chain-count ${quiet}`}>
                {sourceCount(sources.length, lang)}
              </span>
              <span
                className={`doc-chain-pill doc-chain-open ${lang === "ar" ? "text-sm" : "text-xs uppercase tracking-[0.14em]"}`}
              >
                {open ? words.close : words.open}
                <svg
                  aria-hidden="true"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                >
                  <path d="M2 4.5 6 8.5l4-4" />
                </svg>
              </span>
            </span>
          </span>
          <span aria-hidden="true" className="doc-chain-preview">
            {sources.map((source, index) => (
              <span
                key={source.n}
                className={`doc-chain-node ${index >= phoneLinks ? "max-md:hidden" : ""}`}
              >
                {index > 0 ? <span className="doc-chain-rule" /> : null}
                <span className="doc-chain-chip">
                  <span className="doc-chain-dot">{source.n}</span>
                  <span className="doc-chain-name">{shortName(source.label)}</span>
                </span>
              </span>
            ))}
            {moreOnPhone > 0 ? (
              <span className="doc-chain-node md:hidden">
                <span className="doc-chain-rule" />
                <span className="doc-chain-more">+{moreOnPhone}</span>
              </span>
            ) : null}
          </span>
        </button>
        <div id={panelId} className="chain-panel" data-open={open}>
          <div>
            <ol className="doc-chain-list">
              {sources.map((source) => {
                const { issuer, title } = splitSource(source.label);
                const href = safeHttpUrl(source.url);
                const host = href ? new URL(href).hostname.replace(/^www\./, "") : "";
                const inner = (
                  <>
                    <span className="doc-chain-n">{source.n}</span>
                    <span className="doc-chain-text">
                      {issuer ? <span className="doc-chain-issuer">{issuer}</span> : null}
                      <span className="doc-chain-title">{title}</span>
                      {page && host ? (
                        <span className="doc-chain-host" dir="ltr">
                          {host}
                        </span>
                      ) : null}
                      {page && href ? (
                        <span className="doc-chain-url" dir="ltr">
                          {href}
                        </span>
                      ) : null}
                    </span>
                    <span className="doc-chain-go" aria-hidden="true">
                      {href ? arrow : ""}
                    </span>
                  </>
                );
                return (
                  <li
                    key={source.n}
                    id={page ? `source-${source.n}` : undefined}
                    className={`doc-chain-item scroll-mt-24 ${page ? "source-row" : ""}`}
                  >
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        tabIndex={open ? 0 : -1}
                      >
                        {inner}
                      </a>
                    ) : (
                      <div>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The first lines of the text, shown under the summary at depth 3. When the summary was
 * itself taken from those lines, the sentence already shown is not repeated.
 */
function openingLines(story: Story, lang: Lang, summary: string): string {
  const lead = story.locales[lang].lead.replace(/\s+/g, " ").trim();
  if (!lead) return "";
  const rest = summary && lead.startsWith(summary) ? lead.slice(summary.length).trim() : lead;
  return rest === summary ? "" : rest;
}

/** The opening text without the summary, long enough to fill a desktop column. */
function fillText(story: Story, lang: Lang, summary: string): string {
  const text = (story.locales[lang].opening || story.locales[lang].lead).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const rest = summary && text.startsWith(summary) ? text.slice(summary.length).trim() : text;
  return rest === summary ? "" : rest;
}

/**
 * Desktop only: text that fills the room left at the foot of a short column. It never
 * adds height of its own; it takes the space the column is given and shows as many whole
 * lines as fit, ending with an ellipsis.
 */
function ColumnFill({ text, className }: { text: string; className: string }) {
  if (!text) return null;
  return (
    <div className="atlas-fill" aria-hidden="true">
      <p className={`font-body text-pretty ${className}`}>{text}</p>
    </div>
  );
}

/**
 * Desktop only, top row at depth 2 and 3: the story's opening lines fill the room left in a
 * box under its words, above "Read more". It is a ColumnFill (fitted by fitFills, as the
 * columns lower down); at depth 3 an invisible copy of the card's five opening lines keeps
 * the box exactly as tall as before, so the boxes themselves never change size.
 */
function TopFill({ story, lang }: { story: Story; lang: Lang }) {
  const summary = cellSummary(story, lang);
  const text = fillText(story, lang, summary);
  if (!text) return null;
  const opening = openingLines(story, lang, summary);
  return (
    <div className="atlas-fill atlas-top-fill" aria-hidden="true">
      <p className="font-body pt-1.5 text-pretty text-[0.92rem] leading-[1.4] text-muted">{text}</p>
      {opening ? (
        <p className="atlas-fill-sizer font-body line-clamp-5 pt-1.5 text-pretty text-[0.92rem] leading-[1.4]">
          {opening}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Re-fits the top row's fills: after the 200ms depth transition, when the width changes and
 * when the fonts load. A change of height alone (a phone's address bar) does not refit.
 */
function useTopFill(depth: Depth) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const fit = () => fitFills(root.querySelectorAll<HTMLElement>(".atlas-fill"));
    fit();
    const late = window.setTimeout(fit, 250);
    void document.fonts?.ready.then(fit);
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      fit();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(late);
      window.removeEventListener("resize", onResize);
    };
  }, [depth]);
  return ref;
}

/** Fits each fill to whole lines of the room it is given, ending with an ellipsis. */
function fitFills(boxes: Iterable<HTMLElement>) {
  for (const box of boxes) {
    const text = box.firstElementChild as HTMLElement | null;
    if (!text) continue;
    // Start from the room the column gives, then measure the whole text against it.
    box.style.flexGrow = "";
    box.style.height = "";
    text.style.removeProperty("-webkit-line-clamp");
    const room = box.clientHeight;
    const whole = text.scrollHeight;
    if (whole <= room) {
      // A short reading ends where its text ends; "Read more" follows right under it.
      box.style.flexGrow = "0";
      box.style.height = `${whole}px`;
      text.style.visibility = "visible";
      continue;
    }
    const line = parseFloat(getComputedStyle(text).lineHeight) || 20;
    const top = parseFloat(getComputedStyle(text).paddingTop) || 0;
    const lines = Math.floor((room - top) / line);
    text.style.setProperty("-webkit-line-clamp", String(Math.max(lines, 1)));
    text.style.visibility = lines >= 2 ? "visible" : "hidden";
  }
}

/** Fits every fill on the page to whole lines, again on resize, depth change and font load. */
function useColumnFill(depth: Depth) {
  useEffect(() => {
    const fit = () => {
      fitFills(document.querySelectorAll<HTMLElement>(".atlas-fill:not(.atlas-top-fill)"));
    };
    fit();
    const late = window.setTimeout(fit, 250);
    void document.fonts?.ready.then(fit);
    const watch = new ResizeObserver(fit);
    for (const col of document.querySelectorAll(".atlas-bottom")) watch.observe(col);
    window.addEventListener("resize", fit);
    return () => {
      window.clearTimeout(late);
      watch.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [depth]);
}

type Depth = 1 | 2 | 3;

function readDepth(): Depth {
  try {
    const saved = Number(window.localStorage.getItem(DEPTH_KEY));
    return saved === 1 || saved === 3 ? saved : 2;
  } catch {
    return 2;
  }
}

/**
 * Every reading after the lead, newest first, one per ruled row. The control on the right
 * sets how much of each row shows; the choice is kept in this browser.
 * The two readings of the right column are listed only on a phone, where that column is not shown.
 */
function useDepth(): [Depth, (next: Depth) => void] {
  const [depth, setDepth] = useState<Depth>(2);
  useEffect(() => setDepth(readDepth()), []);
  const choose = (next: Depth) => {
    setDepth(next);
    try {
      window.localStorage.setItem(DEPTH_KEY, String(next));
    } catch {
      /* private window: the choice lasts until the page closes */
    }
  };
  return [depth, choose];
}

/** The ruled bar with the three depth buttons; it heads every reading under the lead. */
function DepthBar({
  lang,
  depth,
  choose,
}: {
  lang: Lang;
  depth: Depth;
  choose: (next: Depth) => void;
}) {
  const words = HOME_WORDS[lang];
  return (
    <div className="px-5 pt-6 md:px-8 md:pt-8">
      <div className="flex items-center justify-between gap-4 border-t-[3px] border-ink pt-3">
        {/* The eight boxes speak for themselves; the newest issue has no visible heading. */}
        <h2 className="sr-only">{words.thisIssue}</h2>
        <div role="radiogroup" aria-label={words.view} className="ms-auto flex items-center">
          {([1, 2, 3] as const).map((step) => (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={depth === step}
              // Before the scripts start, DEPTH_BOOT (lib/depth-boot.ts) marks the stored
              // choice through aria-checked; the colours follow aria-checked alone.
              data-depth-step={step}
              suppressHydrationWarning
              onClick={() => choose(step)}
              className={`border border-ink px-3 py-1 text-xs whitespace-nowrap transition-colors duration-150 md:px-3.5 ${
                step > 1 ? "-ms-px" : ""
              } bg-transparent text-ink hover:bg-highlight active:bg-line aria-checked:bg-ink aria-checked:text-paper aria-checked:hover:bg-ink aria-checked:active:bg-ink ${
                lang === "ar" ? "" : "uppercase tracking-[0.1em]"
              }`}
            >
              {words.depth[step - 1]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type RecordPlan = {
  strip: Story[];
  latest: Story[];
  deep: Story[];
  numbered: Story[];
  counted: boolean;
  more: Story[];
};

/** Which reading goes where; the phone and the desktop are planned apart. */
function planRecords(stories: Story[], mostRead: Story[], desk: boolean): RecordPlan {
  const counted = mostRead.length > 0;
  // The middle column holds the editor's picks in the editor's order (1, then 2): two on a
  // desktop, one on a phone. With no picks it is not shown. The picks leave the other lists.
  const deep = stories
    .filter((story) => story.pick !== undefined)
    .sort((a, b) => (a.pick ?? 0) - (b.pick ?? 0))
    .slice(0, desk ? 2 : 1);
  const picked = new Set(deep.map((s) => s.id));
  const rest = stories.filter((story) => !picked.has(story.id));
  // Phone: a picture strip from eight readings. Desktop: the strip only past thirteen.
  const strip = rest.length >= (desk ? 13 : 8) ? rest.slice(0, 4) : [];
  const remaining = rest.slice(strip.length);
  const latestCount = Math.min(4, Math.max(1, remaining.length - 3));
  const latest = remaining.slice(0, latestCount);
  const after = remaining.slice(latestCount);
  const numbered = counted
    ? mostRead.filter((story) => !picked.has(story.id))
    : after.slice(0, desk ? 3 : 5);
  const shown = new Set([...strip, ...latest, ...deep, ...numbered].map((s) => s.id));
  const more = stories.filter((story) => !shown.has(story.id));
  return { strip, latest, deep, numbered, counted, more };
}

function Records({
  stories,
  lang,
  depth,
  deskSkip,
}: {
  stories: Story[];
  lang: Lang;
  depth: Depth;
  /** A reading the desktop already shows in the top boxes; the phone still lists it here. */
  deskSkip?: string;
}) {
  const ranked = useMostRead(5);
  useColumnFill(depth);
  if (stories.length === 0) return null;
  const byId = new Map(stories.map((story) => [story.id, story]));
  const mostRead = ranked
    ? ranked.map((id) => byId.get(id)).filter((story): story is Story => Boolean(story))
    : [];
  const words = HOME_WORDS[lang];

  return (
    <section className="px-5 pt-6 pb-4 md:px-8 md:pt-8" aria-labelledby="atlas-archive">
      <h2
        id="atlas-archive"
        className="paper-title mb-5 border-t-[3px] border-ink pt-4 text-[1.6rem] font-bold leading-tight text-ink md:mb-7 md:text-[2rem]"
      >
        {words.archive}
      </h2>
      <div className="md:hidden">
        <RecordColumns plan={planRecords(stories, mostRead, false)} lang={lang} depth={depth} />
      </div>
      <div className="hidden md:block">
        <RecordColumns
          plan={planRecords(
            stories.filter((story) => story.id !== deskSkip),
            mostRead.filter((story) => story.id !== deskSkip),
            true,
          )}
          lang={lang}
          depth={depth}
        />
      </div>
    </section>
  );
}

function RecordColumns({ plan, lang, depth }: { plan: RecordPlan; lang: Lang; depth: Depth }) {
  const words = HOME_WORDS[lang];
  const { strip, latest, deep, numbered, counted, more } = plan;
  const heading = `font-body font-normal ${lang === "ar" ? "text-sm text-pine" : "text-xs uppercase tracking-[0.14em] text-pine"}`;

  return (
    <>
      {strip.length ? (
        <ol className="records atlas-strip" data-depth={depth} suppressHydrationWarning>
          {strip.map((story) => (
            <li key={story.id}>
              <RecordRow story={story} lang={lang} />
            </li>
          ))}
        </ol>
      ) : null}

      <div className={`records atlas-bottom ${strip.length ? "mt-5" : ""}`} data-depth={depth} suppressHydrationWarning>
        <section className="atlas-col" aria-label={words.lastIssue}>
          <h3 className={`${heading} mb-3`}>{words.lastIssue}</h3>
          <ol>
            {latest.map((story) => (
              <li key={story.id}>
                <RecordRow story={story} lang={lang} />
              </li>
            ))}
          </ol>
        </section>

        {deep.length ? (
          <section className="atlas-col atlas-picks" aria-label={words.picks}>
            <h3 className={`${heading} mb-3`}>{words.picks}</h3>
            {deep.length === 1 ? (
              <DeepCard story={deep[0]} lang={lang} />
            ) : (
              <ol className="atlas-deep-list">
                {deep.map((story) => (
                  <li key={story.id}>
                    <DeepCard story={story} lang={lang} />
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : null}

        {numbered.length ? (
          <section className="atlas-col" aria-label={counted ? words.mostRead : words.more}>
            <h3 className={`${heading} mb-3`}>{counted ? words.mostRead : words.more}</h3>
            <ol className="atlas-ranked">
              {numbered.map((story, index) => (
                <li key={story.id}>
                  <RankedRow story={story} lang={lang} n={index + 1} depth={depth} />
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      {more.length ? (
        <ol className="records atlas-more-grid mt-6 border-t border-line pt-2" data-depth={depth} suppressHydrationWarning>
          {more.map((story) => (
            <li key={story.id}>
              <RecordRow story={story} lang={lang} />
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

/** A record with a small picture on its start side; the picture and summary fold with depth. */
function RecordRow({ story, lang }: { story: Story; lang: Lang }) {
  const summary = cellSummary(story, lang);
  const opening = openingLines(story, lang, summary);
  return (
    <Link
      {...readLink(lang, story.id)}
      className={`atlas-own group flex items-start border-b border-line py-3.5 ${story.image ? "record-row" : ""}`}
    >
      {story.image ? (
        <div className="record-layer record-thumb me-4 shrink-0" data-layer="2">
          <div>
            <img
              src={story.image.src}
              {...imageSet(story.image.src, "112px")}
              alt={imageCaption(story.image, lang)}
              width={200}
              height={150}
              loading="lazy"
              decoding="async"
              className="block aspect-[4/3] w-[6.5rem] object-cover md:w-28"
            />
          </div>
        </div>
      ) : null}
      <div className="record-text min-w-0 flex-1">
        <Kicker story={story} lang={lang} />
        <h4 className="paper-title font-bold mt-1 text-[1.08rem] leading-[1.18] text-ink decoration-1 underline-offset-[0.14em] group-hover:underline">
          {storyTitle(story, lang)}
        </h4>
        {summary ? (
          <div className="record-layer" data-layer="2">
            <div>
              <p className="font-body pt-1 text-pretty text-[0.92rem] leading-[1.32] text-ink">
                {summary}
              </p>
            </div>
          </div>
        ) : null}
        {opening ? (
          <div className="record-layer" data-layer="3">
            <div>
              <p className="font-body line-clamp-3 pt-1.5 text-pretty text-[0.88rem] leading-[1.4] text-muted">
                {opening}
              </p>
            </div>
          </div>
        ) : null}
        <div className="record-layer" data-layer="3">
          <div>
            <p className="pt-1 text-xs text-muted">{formatDate(story.date, lang)}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

/** The middle column: one reading at length, picture on top. */
function DeepCard({ story, lang }: { story: Story; lang: Lang }) {
  const words = HOME_WORDS[lang];
  const summary = cellSummary(story, lang);
  const opening = openingLines(story, lang, summary);
  const arrow = langMeta[lang].dir === "rtl" ? "←" : "→";
  return (
    <Link {...readLink(lang, story.id)} className="atlas-own deep-card group flex flex-col">
      {story.image ? (
        <div className="record-layer deep-pic" data-layer="2">
          <div>
            <img
              src={story.image.src}
              {...imageSet(story.image.src, "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw")}
              alt={imageCaption(story.image, lang)}
              width={1500}
              height={1000}
              loading="lazy"
              decoding="async"
              className="mb-3 block aspect-[16/10] w-full object-cover"
            />
          </div>
        </div>
      ) : null}
      <Kicker story={story} lang={lang} />
      <h4 className="paper-title font-bold mt-1.5 text-[1.45rem] leading-[1.1] text-ink decoration-1 underline-offset-[0.14em] group-hover:underline md:text-[1.6rem]">
        {storyTitle(story, lang)}
      </h4>
      {summary ? (
        <div className="record-layer" data-layer="2">
          <div>
            <p className="font-body pt-2 text-pretty text-base leading-[1.35] text-ink">
              {summary}
            </p>
          </div>
        </div>
      ) : null}
      {opening ? (
        <div className="record-layer deep-opening" data-layer="3">
          <div>
            <p className="font-body line-clamp-5 pt-2 text-pretty text-[0.95rem] leading-[1.45] text-muted">
              {opening}
            </p>
          </div>
        </div>
      ) : null}
      <ColumnFill
        text={fillText(story, lang, summary)}
        className="pt-2 text-[0.95rem] leading-[1.45] text-muted"
      />
      <span className="atlas-more mt-3 text-[0.8rem]">
        {words.readMore} <span aria-hidden="true">{arrow}</span>
      </span>
    </Link>
  );
}

/** The numbered column: a large number, the title, and the summary when depth allows.
 *  The picture is the reading's own, and it stays visible at every depth. */
function RankedRow({
  story,
  lang,
  n,
  depth,
}: {
  story: Story;
  lang: Lang;
  n: number;
  depth: Depth;
}) {
  const summary = cellSummary(story, lang);
  return (
    <Link
      {...readLink(lang, story.id)}
      className="atlas-own group grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 border-b border-line py-3.5"
    >
      <span className="paper-title font-bold text-[1.6rem] leading-none text-ink tabular-nums">
        {n}
      </span>
      <div className="ranked-body flex min-w-0 items-start gap-3">
        {story.image ? (
          <div className="ranked-pic w-[4.75rem] shrink-0">
            <img
              src={story.image.src}
              {...imageSet(story.image.src, "76px")}
              alt={imageCaption(story.image, lang)}
              width={200}
              height={150}
              loading="lazy"
              decoding="async"
              className="block h-full w-full object-cover"
            />
          </div>
        ) : null}
        <div className="ranked-text min-w-0 flex-1">
        <h4 className="font-body text-[0.98rem] leading-[1.3] text-ink decoration-1 underline-offset-[0.14em] group-hover:underline">
          {storyTitle(story, lang)}
        </h4>
        {summary ? (
          <div className="record-layer" data-layer="3">
            <div>
              <p className="font-body pt-1 text-pretty text-[0.85rem] leading-[1.32] text-muted">
                {summary}
              </p>
            </div>
          </div>
        ) : null}
        <div className="record-layer" data-layer="2">
          <div>
            <div className="pt-1">
              <Kicker story={story} lang={lang} />
            </div>
          </div>
        </div>
        </div>
        {/* The summary shows above only in the deepest view; otherwise the text starts at it. */}
        <ColumnFill
          text={fillText(story, lang, depth === 3 ? summary : "")}
          className="pt-1 text-[0.85rem] leading-[1.38] text-muted"
        />
      </div>
    </Link>
  );
}

type CardSize = "lead" | "side" | "bottom" | "corner" | "more" | "list";

const CARD_TITLE: Record<CardSize, string> = {
  lead: "font-extrabold text-[1.95rem] leading-[1.1] md:text-[2.4rem] md:leading-[1.08] lg:text-[2.9rem]",
  side: "font-bold text-[1.3rem] leading-[1.15] lg:text-[1.45rem]",
  bottom: "font-bold text-[1.35rem] leading-[1.15] lg:text-[1.55rem]",
  corner: "font-bold text-[1.45rem] leading-[1.15] lg:text-[1.7rem]",
  more: "font-bold text-[1.15rem] leading-[1.2] lg:text-[1.25rem]",
  list: "font-bold text-[1.45rem] leading-[1.15]",
};

const CARD_SUMMARY: Record<CardSize, string> = {
  lead: "text-[1.0625rem] leading-[1.35] md:text-[1.3rem]",
  side: "text-base leading-[1.35]",
  bottom: "text-base leading-[1.35]",
  corner: "text-[1.0625rem] leading-[1.38]",
  more: "",
  list: "text-base leading-[1.35]",
};

/** Section name, title, the one-sentence summary and the reading time, in that order. */
function CardBody({ story, lang, size }: { story: Story; lang: Lang; size: CardSize }) {
  const copy = useCopy(lang);
  const summary = size === "more" ? "" : cellSummary(story, lang);
  const minutes = story.locales[lang].minutes;
  return (
    <>
      <p
        className={
          lang === "ar"
            ? "text-sm leading-snug text-pine"
            : "text-xs leading-snug uppercase tracking-[0.14em] text-pine"
        }
      >
        {copy.themes[story.theme]}
      </p>
      <h2
        className={`paper-title text-ink underline-offset-[0.14em] decoration-1 group-hover:underline ${CARD_TITLE[size]}`}
      >
        {storyTitle(story, lang)}
      </h2>
      {summary ? (
        <p className={`font-body text-pretty text-ink ${CARD_SUMMARY[size]}`}>{summary}</p>
      ) : null}
      {minutes ? <ReadTime minutes={minutes} lang={lang} pattern={copy.minRead} story={story} /> : null}
    </>
  );
}

function CardPicture({
  story,
  lang,
  ratio,
  eager = false,
  sizes = "(min-width: 768px) 25vw, 33vw",
}: {
  story: Story;
  lang: Lang;
  ratio: string;
  eager?: boolean;
  /** How wide the picture shows, so the browser downloads a copy of about that size. */
  sizes?: string;
}) {
  if (!story.image) return null;
  return (
    <img
      src={story.image.src}
      {...imageSet(story.image.src, sizes)}
      alt={imageCaption(story.image, lang)}
      width={1500}
      height={1000}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      className={`block w-full object-cover ${ratio}`}
    />
  );
}

function Column({
  story,
  lang,
  section,
  tall = false,
  className = "",
}: {
  story: Story;
  lang: Lang;
  section: Theme | "all";
  tall?: boolean;
  className?: string;
}) {
  const dek = story.locales[lang].dek?.trim();
  const excerpt = dek || story.locales[lang].lead;
  return (
    <Link
      {...readLink(lang, story.id)}
      className={`flex min-w-0 flex-col gap-2 px-5 py-6 md:py-8 lg:px-6 ${tall ? "md:aspect-[3/4]" : ""} ${className}`}
    >
      <h2 className="text-lg leading-snug">{storyTitle(story, lang)}</h2>
      {excerpt ? (
        <p
          className={`font-body text-pretty text-[15px] leading-snug text-muted ${dek ? "" : "line-clamp-3"}`}
        >
          {excerpt}
        </p>
      ) : null}
      <div className="md:mt-auto">
        <Meta story={story} lang={lang} section={section} />
      </div>
    </Link>
  );
}

function Picture({
  story,
  className = "",
  eager = false,
  fill = false,
}: {
  story: Story;
  className?: string;
  eager?: boolean;
  fill?: boolean;
}) {
  const lang = useLang();
  if (!story.image) return null;
  const img = (
    <img
      src={story.image.src}
      {...imageSet(story.image.src, "(min-width: 768px) 60vw, 100vw")}
      alt={imageCaption(story.image, lang)}
      width={1500}
      height={1000}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      className={
        fill
          ? "absolute inset-0 h-full w-full object-cover"
          : `aspect-[3/2] w-full max-w-full object-cover ${className}`
      }
    />
  );
  if (!fill) return img;
  return (
    <div className={`relative w-full md:flex-1 ${className}`}>
      <div aria-hidden="true" className="aspect-[3/2]" />
      {img}
    </div>
  );
}

export function HomePage() {
  return (
    <Shell section="all">
      <Atlas section="all" />
    </Shell>
  );
}

export function SectionPage({ theme }: { theme: Theme }) {
  return (
    <Shell section={theme}>
      <Atlas section={theme} />
    </Shell>
  );
}
