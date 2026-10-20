import { imageSizes } from "@/lib/breakpoints";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Film } from "@/components/film";
import { ListenButton } from "@/components/player";
import { DocumentChain } from "@/components/atlas";
import { Prose } from "@/components/prose";
import { Comments } from "@/components/members/comments";
import {
  PdfButton,
  readingUrl,
  RelatedReadings,
  useSignedCopy,
} from "@/components/reading-extras";
import { LockNote, useMemberText } from "@/components/members/locked";
import { Shell } from "@/components/shell";
import { Trail } from "@/components/trail";
import {
  TwinButton,
  TwinHeading,
  TwinPanel,
  TwinProse,
  useTwin,
  writtenLangs,
} from "@/components/twin";
import { byline, editorialCopy, imageCaption } from "@/lib/editorial";
import { imageSet } from "@/lib/image-set";
import { langMeta, useCopy } from "@/lib/i18n";
import { homeLink, readLink, rememberLang, sectionLink } from "@/lib/lang-path";
import { formatDate, hasCopy } from "@/lib/text";
import { countRead, useNoteRead } from "@/lib/reads";
import { LANGS, type Lang, type Story } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

/**
 * A reading page, in the language of its address. `story` is the full published file,
 * loaded by the route; null when no reading has this id.
 */
export function ReadingPage({ story }: { story: Story | null }) {
  return (
    <Shell section={story?.theme}>
      <Reading story={story} />
    </Shell>
  );
}

const TYPE_STEPS = [0.9, 1, 1.1, 1.2, 1.3] as const;
const TYPE_KEY = "orbis-type";

const AI_NOTE: Record<Lang, string> = {
  tr: "Yapay zekâ ile üretilmiş görsel",
  en: "AI-generated image",
  ar: "صورة مولّدة بالذكاء الاصطناعي",
  fr: "Image générée par IA",
  es: "Imagen generada por IA",
};

const AI_VIDEO_NOTE: Record<Lang, string> = {
  tr: "Yapay zekâ ile üretilmiş video",
  en: "AI-generated video",
  ar: "فيديو مولّد بالذكاء الاصطناعي",
  fr: "Vidéo générée par IA",
  es: "Vídeo generado por IA",
};

function readType(): number {
  try {
    const next = Number(localStorage.getItem(TYPE_KEY));
    if ((TYPE_STEPS as readonly number[]).includes(next)) return next;
  } catch {
    /* keep default */
  }
  return 1;
}

function writeType(value: number) {
  try {
    localStorage.setItem(TYPE_KEY, String(value));
  } catch {
    /* ignore */
  }
}

function TypeSize({
  step,
  onDown,
  onUp,
  onReset,
  label,
  downLabel,
  upLabel,
}: {
  step: number;
  onDown: () => void;
  onUp: () => void;
  onReset: () => void;
  label: string;
  downLabel: string;
  upLabel: string;
}) {
  const atMin = step <= 0;
  const atMax = step >= TYPE_STEPS.length - 1;
  const button = "inline-flex h-8 w-8 items-center justify-center text-ink disabled:text-muted";
  return (
    <div
      dir="ltr"
      className="inline-flex shrink-0 items-center rounded-full border border-line px-1"
    >
      <span className="sr-only">{label}</span>
      <button type="button" onClick={onDown} disabled={atMin} className={`${button} text-[12px]`}>
        <span aria-hidden="true">A−</span>
        <span className="sr-only">{downLabel}</span>
      </button>
      <button type="button" onClick={onReset} className={`${button} text-[14px]`}>
        <span aria-hidden="true">A</span>
        <span className="sr-only">{label}</span>
      </button>
      <button type="button" onClick={onUp} disabled={atMax} className={`${button} text-[16px]`}>
        <span aria-hidden="true">A+</span>
        <span className="sr-only">{upLabel}</span>
      </button>
    </div>
  );
}

function Reading({ story }: { story: Story | null }) {
  const lang = useLang();
  const copy = useCopy(lang);
  const [typeStep, setTypeStep] = useState(1);
  const [twinOpen, setTwinOpen] = useState(false);
  const membersOnly = story?.membersOnly === true;
  // A paid member's full text of a members-only reading; null for everyone else.
  const fullText = useMemberText(story?.id, lang, membersOnly);
  // Twin reading: every reader on an open reading; on a members-only reading, the paid
  // members who have its full text, the twin's full text fetched the same way.
  const twinAllowed =
    !!story &&
    hasCopy(story, lang) &&
    writtenLangs(story).length > 1 &&
    (!membersOnly || fullText !== null);
  const [twin, chooseTwin] = useTwin(story, lang, twinAllowed);
  const twinFull = useMemberText(story?.id, twin ?? lang, membersOnly && twin !== null);
  // Where the reading starts (its header) and ends (after its sources), for the progress line.
  const readStart = useRef<HTMLElement | null>(null);
  const readEnd = useRef<HTMLElement | null>(null);
  // Long passages copied from the page carry the reading's title and address.
  const page = useRef<HTMLDivElement | null>(null);
  useSignedCopy(page, story, lang);

  // One count per visit for the "Most read" column (only once membership is switched on).
  const storyId = story?.id;
  useEffect(() => {
    if (storyId) countRead(storyId);
  }, [storyId]);
  // The signed-in member's own reading history.
  useNoteRead(storyId);

  useEffect(() => {
    const saved = TYPE_STEPS.indexOf(readType() as (typeof TYPE_STEPS)[number]);
    setTypeStep(saved === -1 ? 1 : saved);
  }, []);

  function setStep(next: number) {
    const clamped = Math.min(TYPE_STEPS.length - 1, Math.max(0, next));
    setTypeStep(clamped);
    writeType(TYPE_STEPS[clamped]);
  }

  if (!story) {
    return (
      <main className="px-5 py-12 md:px-12">
        <p>{copy.missing}</p>
        <Link {...homeLink(lang)} className="mt-6 inline-flex min-h-11 items-center text-pine">
          {copy.back}
        </Link>
      </main>
    );
  }

  const locale = story.locales[lang];
  const editorial = editorialCopy(lang);
  const by = byline(story.author, lang);
  const caption = imageCaption(story.image, lang);
  const videoCaption = story.video
    ? story.video.captions?.[lang]?.trim() || story.video.credit?.trim() || ""
    : "";
  const body = fullText ?? locale.body;
  const written = hasCopy(story, lang);
  const sourceNums = new Set(story.sources.map((source) => source.n));
  const sources = [...story.sources].sort((a, b) => a.n - b.n);
  const others = LANGS.filter((code) => hasCopy(story, code));
  const canTwin = twinAllowed;
  // A members-only reading's twin waits for its full text; until then the main text shows alone.
  const twinBody = twin ? (membersOnly ? twinFull : story.locales[twin].body) : null;

  return (
    <main className="px-5 pt-5 pb-10 md:px-12 md:py-14">
      <div ref={page} className="mx-auto flex max-w-[65rem] flex-col gap-7 md:gap-8">
        {/* On paper (print or PDF) the band is left out; the name and the address head the page. */}
        <p className="print-only text-sm" dir="ltr">
          <span className="masthead-name text-2xl">ORBIS</span>
          <span className="ms-3 text-muted">{readingUrl(lang, story.id)}</span>
        </p>
        {/* Where the reading sits: home, its section, its title. */}
        <Trail
          lang={lang}
          here={locale.title || story.locales.en.title}
          parent={(className) => (
            <Link {...sectionLink(lang, story.theme)} className={className}>
              {copy.themes[story.theme]}
            </Link>
          )}
          className="reading-column -mb-3"
        />

        <ReadingProgress start={readStart} end={readEnd} />
        <header ref={readStart} className="reading-column flex w-full flex-col gap-4">
          <p className="text-xs uppercase tracking-widest text-pine">{copy.themes[story.theme]}</p>
          <h1 className="paper-title font-bold text-[2.25rem] leading-[1.08] md:text-5xl md:leading-[1.05]">
            {locale.title || story.locales.en.title}
          </h1>
          {locale.dek ? <p className="reading-dek">{locale.dek}</p> : null}
          {twin ? <TwinHeading story={story} twin={twin} /> : null}
          <div className="flex items-end justify-between gap-x-3 pt-1">
            <div className="flex min-w-0 flex-col items-start gap-0.5">
              {by ? <p className="text-sm font-bold text-ink">{by}</p> : null}
              <p className="text-sm text-muted">
                {[locale.region, formatDate(story.date, lang)].filter(Boolean).join(" · ")}
              </p>
              {story.updatedAt && story.updatedAt !== story.date ? (
                <p className="text-sm text-muted">
                  {editorial.updated}: {formatDate(story.updatedAt, lang)}
                </p>
              ) : null}
            </div>
          </div>
          {/* One thin line, the same on a phone and a wide screen: listen, share, twin
              reading, and PDF at the end. Listening plays in the bar at the foot of the
              screen. */}
          <div className="reading-tools no-print flex flex-wrap items-center gap-x-2 gap-y-2 py-1 sm:gap-x-3 md:py-2.5">
            {locale.audio ? (
              <ListenButton
                clip={{
                  id: story.id,
                  lang,
                  title: locale.title || story.locales.en.title,
                  src: locale.audio.dataUrl,
                }}
                listen={copy.listen}
                pause={copy.pause}
              />
            ) : null}
            <ShareButton lang={lang} title={locale.title || story.locales.en.title} />
            {canTwin ? (
              <TwinButton
                lang={lang}
                on={twin !== null}
                open={twinOpen}
                onToggle={() => setTwinOpen((value) => !value)}
              />
            ) : null}
            <div className="ms-auto flex">
              <PdfButton lang={lang} />
            </div>
          </div>
          {canTwin && twinOpen ? (
            <TwinPanel story={story} lang={lang} twin={twin} choose={chooseTwin} />
          ) : null}
        </header>

        {/* One picture at the top of a reading, wider than the text: a reading with a video
            shows the video in the picture's place; the picture stays on the cards. */}
        {story.video ? (
          <figure className="flex max-w-full flex-col gap-2">
            <Film
              src={story.video.src}
              preload="none"
              label={videoCaption || AI_VIDEO_NOTE[lang]}
              lang={lang}
              className="w-full max-w-full"
            />
            <figcaption className="text-xs leading-snug text-muted">
              {videoCaption ? `${videoCaption} · ${AI_VIDEO_NOTE[lang]}` : AI_VIDEO_NOTE[lang]}
            </figcaption>
          </figure>
        ) : story.image ? (
          <figure className="flex max-w-full flex-col gap-2">
            <img
              src={story.image.src}
              {...imageSet(story.image.src, imageSizes("48rem", "100vw"))}
              alt={caption}
              width={1500}
              height={1000}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="-mx-5 block h-auto w-[calc(100%+2.5rem)] max-w-none md:mx-0 md:w-full md:max-w-full"
            />
            <figcaption className="text-xs leading-snug text-muted">
              {caption ? `${caption} · ${AI_NOTE[lang]}` : AI_NOTE[lang]}
            </figcaption>
          </figure>
        ) : null}

        <div className="reading-column flex w-full flex-col gap-8">
          {written ? (
            <div
              ref={sources.length ? undefined : (node) => void (readEnd.current = node)}
              className="flex flex-col gap-8"
            >
              <div className="flex flex-col gap-3">
                {/* The text size sits right above the text, at its right, after the picture. */}
                <div className="no-print flex justify-end">
                  <TypeSize
                    step={typeStep}
                    onDown={() => setStep(typeStep - 1)}
                    onUp={() => setStep(typeStep + 1)}
                    onReset={() => setStep(1)}
                    label={copy.textSize}
                    downLabel={copy.typeDown}
                    upLabel={copy.typeUp}
                  />
                </div>
                <div style={{ fontSize: `${TYPE_STEPS[typeStep]}em` }}>
                  {twin && twinBody ? (
                    <TwinProse
                      main={body}
                      twin={twinBody}
                      mainLang={lang}
                      twinLang={twin}
                      sourceNums={sourceNums}
                      sourceWord={copy.sourceWord}
                    />
                  ) : (
                    <Prose body={body} sourceNums={sourceNums} sourceWord={copy.sourceWord} />
                  )}
                </div>
              </div>
              {membersOnly && fullText === null ? <LockNote lang={lang} /> : null}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p>{copy.unwritten}</p>
              {others.length ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted">{copy.availableIn}</span>
                  {others.map((code) => (
                    <Link
                      key={code}
                      {...readLink(code, story.id)}
                      onClick={() => rememberLang(code)}
                      lang={langMeta[code].html}
                      className="inline-flex min-h-11 items-center border border-line px-3 text-sm"
                    >
                      {langMeta[code].name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {sources.length ? (
            <section ref={readEnd}>
              <DocumentChain story={story} lang={lang} page />
            </section>
          ) : null}

          <RelatedReadings story={story} lang={lang} />

          <div className="no-print">
            <Comments storyId={story.id} lang={lang} />
          </div>
        </div>
      </div>
    </main>
  );
}

const SHARE: Record<Lang, { share: string; copied: string }> = {
  tr: { share: "Paylaş", copied: "Bağlantı kopyalandı" },
  en: { share: "Share", copied: "Link copied" },
  ar: { share: "مشاركة", copied: "نُسخ الرابط" },
  fr: { share: "Partager", copied: "Lien copié" },
  es: { share: "Compartir", copied: "Enlace copiado" },
};

/** The phone's own share sheet where there is one; elsewhere the address is copied. */
function ShareButton({ lang, title }: { lang: Lang; title: string }) {
  const words = SHARE[lang];
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href.split("#")[0];
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the reader closed the sheet */
    }
  }
  return (
    <button
      type="button"
      onClick={() => void share()}
      aria-label={copied ? words.copied : words.share}
      title={copied ? words.copied : words.share}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-ink md:size-8"
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        aria-hidden="true"
        className="size-[14px]"
      >
        <circle cx="15" cy="4.5" r="2.2" />
        <circle cx="5" cy="10" r="2.2" />
        <circle cx="15" cy="15.5" r="2.2" />
        <path d="m7 9 6-3.4M7 11l6 3.4" />
      </svg>
    </button>
  );
}

/**
 * A hairline fixed to the top of a phone screen that fills as the reader moves from the
 * start of the reading to the end of its sources (or of its text, when it has none). Hidden on wide screens by the stylesheet.
 */
function ReadingProgress({
  start,
  end,
}: {
  start: React.RefObject<HTMLElement | null>;
  end: React.RefObject<HTMLElement | null>;
}) {
  const line = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      frame = 0;
      const from = start.current;
      const to = end.current;
      const bar = line.current;
      if (!from || !to || !bar) return;
      const top = from.getBoundingClientRect().top + window.scrollY;
      const bottom = to.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
      const span = bottom - top;
      const done = span > 0 ? Math.min(1, Math.max(0, (window.scrollY - top) / span)) : 1;
      bar.style.transform = `scaleX(${done})`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [start, end]);
  return <div ref={line} aria-hidden="true" className="reading-progress" />;
}
