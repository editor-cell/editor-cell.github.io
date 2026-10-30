import { imageSizes } from "@/lib/breakpoints";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { VideoStart } from "@/components/theater";
import { ListenButton } from "@/components/player";
import { Sources } from "@/components/sources";
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
import { byline, editorialCopy, imageCaption, visibleCaption } from "@/lib/editorial";
import { imageSet } from "@/lib/image-set";
import { langMeta, useCopy } from "@/lib/i18n";
import { homeLink, readLink, rememberLang, sectionLink } from "@/lib/lang-path";
import { placeLine } from "@/lib/places";
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
  return (
    <div dir="ltr" className="type-size" role="group" aria-label={label}>
      <button type="button" onClick={onDown} disabled={atMin} className="type-key type-key-down">
        <span aria-hidden="true">A</span>
        <span className="sr-only">{downLabel}</span>
      </button>
      <button type="button" onClick={onReset} className="type-key type-key-mid">
        <span aria-hidden="true">A</span>
        <span className="sr-only">{label}</span>
      </button>
      <button type="button" onClick={onUp} disabled={atMax} className="type-key type-key-up">
        <span aria-hidden="true">A</span>
        <span className="sr-only">{upLabel}</span>
      </button>
    </div>
  );
}

function Reading({ story }: { story: Story | null }) {
  const lang = useLang();
  const copy = useCopy(lang);
  const [typeStep, setTypeStep] = useState(1);
  const membersOnly = story?.membersOnly === true;
  // A paid member's full text of a members-only reading; null for everyone else.
  const fullText = useMemberText(story?.id, lang, membersOnly);
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
      <main className="page-plain">
        <p>{copy.missing}</p>
        <Link {...homeLink(lang)} className="text-link mt-6 inline-flex min-h-11 items-center">
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
  const others = LANGS.filter((code) => hasCopy(story, code));
  const title = locale.title || story.locales.en.title;
  const places = placeLine(locale.region, lang);

  return (
    <main className="reading" dir={langMeta[lang].dir}>
      <div ref={page}>
        {/* On paper (print or PDF) the masthead is left out; the name and the address head the page. */}
        <p className="print-only reading-print-head" dir="ltr">
          <span className="reading-print-name">ORBIS</span>
          <span>{readingUrl(lang, story.id)}</span>
        </p>

        <ReadingProgress start={readStart} end={readEnd} />
        <header ref={readStart} className="reading-head">
          <Link {...sectionLink(lang, story.theme)} className="reading-section">
            {copy.themes[story.theme]}
          </Link>
          <h1 className="reading-title">{title}</h1>
          {locale.dek ? <p className="reading-dek">{locale.dek}</p> : null}
          <p className="reading-meta">
            {places ? <span className="meta-places">{places}</span> : null}
            <span>{formatDate(story.date, lang)}</span>
            {story.updatedAt && story.updatedAt !== story.date ? (
              <span>
                {editorial.updated} {formatDate(story.updatedAt, lang)}
              </span>
            ) : null}
            {by ? <span className="reading-by">{by}</span> : null}
          </p>
          <div className="reading-tools no-print">
            {locale.audio ? (
              <ListenButton
                clip={{
                  id: story.id,
                  lang,
                  title,
                  src: locale.audio.dataUrl,
                  image: story.image?.src,
                }}
                listen={copy.listen}
                pause={copy.pause}
              />
            ) : null}
            <ShareButton lang={lang} title={title} />
            <PdfButton story={story} lang={lang} />
            {written ? (
              <TypeSize
                step={typeStep}
                onDown={() => setStep(typeStep - 1)}
                onUp={() => setStep(typeStep + 1)}
                onReset={() => setStep(1)}
                label={copy.textSize}
                downLabel={copy.typeDown}
                upLabel={copy.typeUp}
              />
            ) : null}
          </div>
        </header>

        {/* One picture at the head of a reading, wider than the text: a reading with a video
            shows the video in the picture's place; the picture stays on the cards. */}
        {story.video ? (
          <figure className="reading-figure">
            <VideoStart
              clip={{
                lang,
                title: videoCaption || title,
                src: story.video.src,
              }}
              className="w-full max-w-full"
            />
            <figcaption className="reading-caption">
              {videoCaption ? `${videoCaption} ${AI_VIDEO_NOTE[lang]}.` : `${AI_VIDEO_NOTE[lang]}.`}
            </figcaption>
          </figure>
        ) : story.image ? (
          <figure className="reading-figure">
            <img
              src={story.image.src}
              {...imageSet(story.image.src, imageSizes("min(64rem, 92vw)", "100vw"))}
              alt={caption}
              width={1500}
              height={1000}
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
            <figcaption className="reading-caption">
              {visibleCaption(story.image, lang)
                ? `${visibleCaption(story.image, lang)} ${AI_NOTE[lang]}.`
                : `${AI_NOTE[lang]}.`}
            </figcaption>
          </figure>
        ) : null}

        <div className="reading-body">
          {written ? (
            <div ref={story.sources.length ? undefined : (node) => void (readEnd.current = node)}>
              {/* The text's own size (larger on a wide screen), times the reader's step. */}
              <div className="reading-text" style={{ fontSize: `${TYPE_STEPS[typeStep]}em` }}>
                <Prose body={body} sourceNums={sourceNums} sourceWord={copy.sourceWord} />
              </div>
              {membersOnly && fullText === null ? <LockNote lang={lang} /> : null}
            </div>
          ) : (
            <div className="reading-unwritten">
              <p>{copy.unwritten}</p>
              {others.length ? (
                <p className="reading-other-langs">
                  <span>{copy.availableIn}</span>
                  {others.map((code) => (
                    <Link
                      key={code}
                      {...readLink(code, story.id)}
                      onClick={() => rememberLang(code)}
                      lang={langMeta[code].html}
                      className="text-link"
                    >
                      {langMeta[code].name}
                    </Link>
                  ))}
                </p>
              ) : null}
            </div>
          )}

          <Sources
            sources={story.sources}
            lang={lang}
            endRef={(node) => {
              if (story.sources.length) readEnd.current = node;
            }}
          />
        </div>
      </div>

      <div className="reading-after no-print">
        <RelatedReadings story={story} lang={lang} />
        <Comments storyId={story.id} lang={lang} />
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
    <button type="button" onClick={() => void share()} className="reading-tool" aria-live="polite">
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        aria-hidden="true"
        className="reading-tool-mark"
      >
        <circle cx="15" cy="4.5" r="2.2" />
        <circle cx="5" cy="10" r="2.2" />
        <circle cx="15" cy="15.5" r="2.2" />
        <path d="m7 9 6-3.4M7 11l6 3.4" />
      </svg>
      {copied ? words.copied : words.share}
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
