import { Link } from "@tanstack/react-router";
import { Bookmark, Check, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Film } from "@/components/film";
import { announceStart } from "@/lib/listen";
import { useSavedVideos } from "@/lib/saved-videos";
import { CARDS } from "@/lib/seed";
import { frontOrder } from "@/lib/front-order";
import { imageSizes } from "@/lib/breakpoints";
import { Shell } from "@/components/shell";
import { Trail } from "@/components/trail";
import { Transcript } from "@/components/transcript";
import { imageSet } from "@/lib/image-set";
import { langMeta, useCopy } from "@/lib/i18n";
import { mediaLink, videoLink, readLink } from "@/lib/lang-path";
import { formatDate, paragraphs, storyTitle } from "@/lib/text";
import type { Lang, Video, VideoCard } from "@/lib/types";
import { useLang } from "@/lib/use-lang";
import { formatDuration, videoWords, videosIn } from "@/lib/videos";

/**
 * Videos are their own content: no reading and no issue behind them. On the front page they
 * sit in one row between the newest issue and the archive, newest at the start, swiped
 * sideways; "Show all" opens the list of every video. Each video has its own page with the
 * transcript under it. The depth buttons do not touch the row.
 */

function kickerClass(lang: Lang) {
  return lang === "ar"
    ? "text-sm leading-snug text-pine"
    : "text-xs leading-snug uppercase tracking-[0.14em] text-pine";
}

/** "VIDEO · 1:35": the label a reading shows its section in, with the length beside it. */
function VideoKicker({ video, lang }: { video: { duration?: number }; lang: Lang }) {
  const words = videoWords(lang);
  const length = formatDuration(video.duration);
  return (
    <p className={kickerClass(lang)}>
      {words.video}
      {length ? (
        <span className="text-muted tabular-nums" dir="ltr">
          {" · "}
          {length}
        </span>
      ) : null}
    </p>
  );
}

/** The still of a video with a quiet play mark in its middle. */
function Still({
  video,
  sizes,
  eager = false,
}: {
  video: VideoCard;
  sizes: string;
  eager?: boolean;
}) {
  return (
    <div className="media-still relative aspect-video w-full overflow-hidden bg-ink">
      {video.poster ? (
        <img
          src={video.poster}
          {...imageSet(video.poster, sizes)}
          alt=""
          width={1600}
          height={900}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="block h-full w-full object-cover"
        />
      ) : null}
      <span aria-hidden="true" className="media-play">
        <svg viewBox="0 0 24 24" className="size-[42%]" fill="currentColor">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      </span>
    </div>
  );
}

/** The row of videos on the front page. Nothing is shown while there is no video. */
export function MediaStrip({ lang }: { lang: Lang }) {
  const videos = videosIn(lang);
  if (videos.length === 0) return null;
  const words = videoWords(lang);
  const arrow = langMeta[lang].dir === "rtl" ? "←" : "→";
  return (
    <section data-media-strip aria-labelledby="atlas-media" className="px-5 pt-4 md:px-8 md:pt-8">
      <div className="mb-3 flex items-baseline justify-between gap-4 border-t border-rule pt-3 md:mb-4">
        <h2 id="atlas-media" className={`font-body font-normal ${kickerClass(lang)}`}>
          {words.videos}
        </h2>
        <Link {...mediaLink(lang)} className="atlas-more shrink-0 text-[0.8rem]">
          {words.showAll} <span aria-hidden="true">{arrow}</span>
        </Link>
      </div>
      <ol className="media-strip">
        {videos.map((video) => (
          <li key={video.id}>
            <Link {...videoLink(lang, video.id)} className="group flex flex-col gap-2">
              <Still video={video} sizes="(min-width: 768px) 24vw, 78vw" />
              <VideoKicker video={video} lang={lang} />
              <h3 className="paper-title font-bold text-[1.05rem] leading-[1.15] text-ink decoration-1 underline-offset-[0.14em] group-hover:underline md:text-[1.1rem]">
                {video.locales[lang]?.title}
              </h3>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The browser-history place of the list of videos, when the reader has opened it. */
let listPlace: number | null = null;
function historyPlace(): number | null {
  if (typeof window === "undefined") return null;
  const place = (window.history.state as { __TSR_index?: number } | null)?.__TSR_index;
  return typeof place === "number" ? place : null;
}

/** Where the page sits, as on a reading: Home › Videos, and on a video Home › Videos › title.
 * On a video, "Videos" goes up, not forward: back to the list the reader came from, or in
 * the video's place, so the phone's back button then leaves the videos at once. */
function VideoTrail({ lang, title }: { lang: Lang; title?: string }) {
  const words = videoWords(lang);
  if (!title) return <Trail lang={lang} here={words.videos} />;
  return (
    <Trail
      lang={lang}
      here={title}
      parent={(className) => (
        <Link
          {...mediaLink(lang)}
          replace
          onClick={(event) => {
            const here = historyPlace();
            if (here !== null && listPlace !== null && here === listPlace + 1) {
              event.preventDefault();
              window.history.back();
            }
          }}
          className={className}
        >
          {words.videos}
        </Link>
      )}
    />
  );
}

/** Every video, newest first: a still at the start of each row, then its words. */
export function VideoListPage() {
  const lang = useLang();
  useEffect(() => {
    listPlace = historyPlace();
  }, []);
  const words = videoWords(lang);
  const videos = videosIn(lang);
  const saved = useSavedVideos();
  const [onlySaved, setOnlySaved] = useState(false);
  const visible = onlySaved ? videos.filter(video => saved.ids.includes(video.id)) : videos;
  return (
    <Shell>
      <main>
        <div className="px-5 pt-5 pb-4 md:px-8 md:pt-8 md:pb-6">
          <div className="mb-3">
            <VideoTrail lang={lang} />
          </div>
          <h1 className="paper-title font-bold text-[2.4rem] leading-[1.05] md:text-[3rem]">
            {words.videos}
          </h1>
          <p className="mt-2 text-[15px] text-muted">{words.listNote}</p>
          <div className="video-list-filters" aria-label={words.videos}>
            <button type="button" aria-pressed={!onlySaved} onClick={() => setOnlySaved(false)}>{words.back}</button>
            <button type="button" aria-pressed={onlySaved} onClick={() => setOnlySaved(true)}>{words.savedVideos} ({videos.filter(video => saved.ids.includes(video.id)).length})</button>
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="border-t border-rule px-5 py-8 text-[15px] text-muted md:px-8">
            {onlySaved ? words.savedEmpty : words.empty}
          </p>
        ) : null}
        <ol className="-mb-5 border-t border-rule px-5 md:mb-0 md:px-8">
          {visible.map((video, index) => {
            const copy = video.locales[lang];
            return (
              <li key={video.id} className="border-b border-line last:border-b-0 last:[&>a]:pb-0 md:last:[&>a]:pb-5">
                <Link
                  {...videoLink(lang, video.id)}
                  className="group grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-start gap-4 py-5 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:gap-7"
                >
                  <Still video={video} sizes="(min-width: 768px) 18rem, 9rem" eager={index < 3} />
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <VideoKicker video={video} lang={lang} />
                    <h2 className="paper-title font-bold text-[1.15rem] leading-[1.15] text-ink group-hover:underline group-hover:underline-offset-4 md:text-[1.5rem]">
                      {copy?.title}
                    </h2>
                    {copy?.dek ? (
                      <p className="font-body hidden max-w-2xl text-pretty text-[15px] leading-snug text-ink sm:block">
                        {copy.dek}
                      </p>
                    ) : null}
                    {/* Under the label, as on the reading cards (styles.css orders title, sentence, label). */}
                    <p className="text-xs text-muted" style={{ order: 4 }}>
                      {formatDate(video.date, lang)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </main>
    </Shell>
  );
}

/** Date, duration and working watch-later/share actions, as in the selected reference. */
function VideoActions({ video, lang }: { video: Video; lang: Lang }) {
  const words = videoWords(lang);
  const saved = useSavedVideos();
  const marked = saved.ids.includes(video.id);
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState("");
  async function share() {
    const url = window.location.href.split("#")[0];
    try {
      if (navigator.share) { await navigator.share({ title: video.locales[lang]?.title, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setShareLink(url);
    }
  }
  return <>
    <div className="video-meta">
      <time dateTime={video.date}>{formatDate(video.date, lang)}</time>
      <span dir="ltr">{formatDuration(video.duration)}</span>
      <button type="button" aria-pressed={marked} onClick={() => saved.toggle(video.id)}>
        {marked ? <Check aria-hidden="true" /> : <Bookmark aria-hidden="true" />}{marked ? words.saved : words.watchLater}
      </button>
      <button type="button" onClick={() => void share()}><Share2 aria-hidden="true" />{copied ? words.copied : words.share}</button>
    </div>
    {marked ? <Link {...mediaLink(lang)} className="video-saved-link">{words.savedVideos} →</Link> : null}
    {shareLink ? <label className="video-share-link">{words.copyLink}<input readOnly value={shareLink} onFocus={event => event.currentTarget.select()} /></label> : null}
  </>;
}

/** Other published videos appear here as they are added; no sample videos are invented. */
function VideoRelated({ video, lang }: { video: Video; lang: Lang }) {
  const words = videoWords(lang);
  const copy = useCopy(lang);
  const others = videosIn(lang).filter(item => item.id !== video.id).slice(0, 3);
  const readings = frontOrder(CARDS.filter(story => story.locales[lang].written)).slice(0, 3);
  return (
    <aside className="video-related">
      {others.length ? <section aria-labelledby="video-related-title">
        <h2 id="video-related-title" className="video-section-title">{words.related}</h2>
        {others.map(item => <Link key={item.id} {...videoLink(lang, item.id)} className="video-related-card group">
          <div className="video-related-picture">
            {item.poster ? <img src={item.poster} {...imageSet(item.poster, imageSizes("15vw", "34vw"))} alt="" width={1600} height={900} loading="lazy" /> : null}
            <span className="video-duration" dir="ltr">{formatDuration(item.duration)}</span>
          </div>
          <div className="video-related-copy">
            <p className="video-category">{words.video}</p>
            <h3 className="paper-title group-hover:underline">{item.locales[lang]?.title}</h3>
            <p>{item.locales[lang]?.dek}</p>
          </div>
        </Link>)}
      </section> : null}
      {readings.length ? <section aria-labelledby="video-more-title">
        <h2 id="video-more-title" className="video-section-title">{words.more}</h2>
        {readings.map(story => <Link key={story.id} {...readLink(lang, story.id)} className="video-related-card group">
          {story.image ? <div className="video-related-picture"><img src={story.image.src} {...imageSet(story.image.src, imageSizes("15vw", "34vw"))} alt="" width={1500} height={1000} loading="lazy" /></div> : null}
          <div className="video-related-copy">
            <p className="video-category">{copy.themes[story.theme]}</p>
            <h3 className="paper-title group-hover:underline">{storyTitle(story, lang)}</h3>
            <p>{(story.locales[lang].dek || story.locales[lang].lead).match(/^.*?[.!?؟۔](?=\s|$)/)?.[0] || story.locales[lang].dek || story.locales[lang].lead}</p>
          </div>
        </Link>)}
      </section> : null}
    </aside>
  );
}

/** The existing player stays in the article, including gestures, settings and timed text. */
export function VideoPage({ video }: { video: Video | null }) {
  const lang = useLang();
  const words = videoWords(lang);
  const [open, setOpen] = useState(false);
  const screen = useRef<HTMLVideoElement | null>(null);
  const onScreen = useCallback((element: HTMLVideoElement | null) => { screen.current = element; }, []);
  const copy = video?.locales[lang];
  const transcript = copy?.transcript ? paragraphs(copy.transcript) : [];
  function startAt(seconds: number) {
    const element = screen.current;
    if (!element) return;
    element.currentTime = seconds;
    announceStart("film");
    void element.play().catch(() => {});
  }
  return (
    <Shell layout="video">
      <main className="video-watch">
        <div className="video-breadcrumb"><VideoTrail lang={lang} title={copy?.title} /></div>
        <h2 className="video-section-title video-page-label">{words.videos}</h2>
        {video && copy ? (
          <div className="video-watch-grid">
            <article className="video-primary">
              <Film
                key={`${video.id}-${lang}`}
                src={video.src}
                poster={video.poster}
                label={copy.title}
                lang={lang}
                length={video.duration}
                controlsBeforePlay
                onScreen={onScreen}
                captions={Object.entries(video.captions ?? {}).map(([code, path]) => ({ lang: code as Lang, src: path, label: langMeta[code as Lang].name }))}
                className="video-inline-player"
              />
              <div className="video-description">
                <p className="video-category">{words.video}</p>
                <h1 className="paper-title video-title">{copy.title}</h1>
                {copy.dek ? <p className="video-dek">{copy.dek}</p> : null}
                {transcript[0] ? <p className="video-intro">{transcript[0]}</p> : null}
                <VideoActions key={`${video.id}-${lang}`} video={video} lang={lang} />
              </div>
              {transcript.length ? <section className="video-transcript-section">
                <button type="button" aria-expanded={open} aria-controls="video-transcript" onClick={() => setOpen(value => !value)} className="video-transcript-toggle">
                  {open ? words.hideTranscript : words.readTranscript}<span aria-hidden="true">{open ? "−" : "+"}</span>
                </button>
                <Transcript id="video-transcript" paragraphs={transcript} captions={video.captions?.[lang]} lang={lang} hidden={!open} film={screen} onPlayFrom={startAt} className="video-transcript-copy" />
              </section> : null}
            </article>
            <VideoRelated video={video} lang={lang} />
          </div>
        ) : <p className="py-10 text-muted">{words.missing}</p>}
      </main>
    </Shell>
  );
}
