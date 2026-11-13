import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Bookmark, Check, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Film } from "@/components/film";
import { announceStart } from "@/lib/listen";
import { seekTo } from "@/lib/seek";
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

/** Shared editorial language for the archive and its viewing room. */
function motionCopy(lang: Lang) {
  return lang === "tr"
    ? {
        label: "Hareketli Orbis",
        title: "Görmenin başka bir yolu.",
        latest: "Son video",
        words: "Videonun metni",
      }
    : {
        label: "Orbis in motion",
        title: "A different way to see.",
        latest: "Latest film",
        words: "The story in words",
      };
}

/** The newest published video leads the archive; saved filtering keeps the same layout. */
export function VideoListPage() {
  const lang = useLang();
  useEffect(() => {
    listPlace = historyPlace();
  }, []);
  const words = videoWords(lang);
  const motion = motionCopy(lang);
  const videos = videosIn(lang);
  const saved = useSavedVideos();
  const [onlySaved, setOnlySaved] = useState(false);
  const savedVideos = videos.filter((video) => saved.ids.includes(video.id));
  const visible = onlySaved ? savedVideos : videos;
  const [featured, ...more] = visible;
  return (
    <Shell layout="video">
      <main className="video-library">
        <div className="video-breadcrumb">
          <VideoTrail lang={lang} />
        </div>
        <header className="video-library-heading">
          <div>
            <p className="video-overline">{motion.label}</p>
            <h1 className="paper-title">{words.videos}</h1>
          </div>
          <div className="video-library-note">
            <p className="paper-title">{motion.title}</p>
            <p>{words.listNote}</p>
          </div>
        </header>
        <div className="video-list-filters" aria-label={words.videos}>
          <button type="button" aria-pressed={!onlySaved} onClick={() => setOnlySaved(false)}>
            {words.back}
            <span>{videos.length}</span>
          </button>
          <button type="button" aria-pressed={onlySaved} onClick={() => setOnlySaved(true)}>
            {words.savedVideos}
            <span>{savedVideos.length}</span>
          </button>
        </div>
        {featured ? (
          <article className="video-feature">
            <Link
              {...videoLink(lang, featured.id)}
              aria-label={`${words.play}: ${featured.locales[lang]?.title}`}
              className="video-feature-picture"
            >
              <Still video={featured} sizes={imageSizes("58vw", "100vw")} eager />
              <span className="video-duration" dir="ltr">
                {formatDuration(featured.duration)}
              </span>
            </Link>
            <div className="video-feature-copy">
              <div className="video-feature-top">
                <p className="video-overline">{onlySaved ? words.savedVideos : motion.latest}</p>
                <span aria-hidden="true">01</span>
              </div>
              <h2 className="paper-title">
                <Link {...videoLink(lang, featured.id)}>{featured.locales[lang]?.title}</Link>
              </h2>
              {featured.locales[lang]?.dek ? (
                <p className="video-feature-dek">{featured.locales[lang]?.dek}</p>
              ) : null}
              <time dateTime={featured.date}>{formatDate(featured.date, lang)}</time>
              <Link {...videoLink(lang, featured.id)} className="video-editorial-link">
                {words.play}
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          </article>
        ) : (
          <p className="video-empty" role="status">
            {onlySaved ? words.savedEmpty : words.empty}
          </p>
        )}
        {more.length ? (
          <ol className="video-library-grid">
            {more.map((video) => (
              <li key={video.id}>
                <Link {...videoLink(lang, video.id)} className="video-library-card">
                  <Still video={video} sizes={imageSizes("30vw", "100vw")} />
                  <VideoKicker video={video} lang={lang} />
                  <h2 className="paper-title">{video.locales[lang]?.title}</h2>
                  {video.locales[lang]?.dek ? <p>{video.locales[lang]?.dek}</p> : null}
                  <time dateTime={video.date}>{formatDate(video.date, lang)}</time>
                </Link>
              </li>
            ))}
          </ol>
        ) : null}
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
      if (navigator.share) {
        await navigator.share({ title: video.locales[lang]?.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setShareLink(url);
    }
  }
  return (
    <>
      <div className="video-meta">
        <time dateTime={video.date}>{formatDate(video.date, lang)}</time>
        <span dir="ltr">{formatDuration(video.duration)}</span>
        <button type="button" aria-pressed={marked} onClick={() => saved.toggle(video.id)}>
          {marked ? <Check aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
          {marked ? words.saved : words.watchLater}
        </button>
        <button type="button" onClick={() => void share()}>
          <Share2 aria-hidden="true" />
          {copied ? words.copied : words.share}
        </button>
      </div>
      {marked ? (
        <Link {...mediaLink(lang)} className="video-saved-link">
          {words.savedVideos}
          <ArrowUpRight aria-hidden="true" />
        </Link>
      ) : null}
      {shareLink ? (
        <label className="video-share-link">
          {words.copyLink}
          <input readOnly value={shareLink} onFocus={(event) => event.currentTarget.select()} />
        </label>
      ) : null}
    </>
  );
}

/** Other published videos appear here as they are added; no sample videos are invented. */
function VideoRelated({ video, lang }: { video: Video; lang: Lang }) {
  const words = videoWords(lang);
  const copy = useCopy(lang);
  const others = videosIn(lang)
    .filter((item) => item.id !== video.id)
    .slice(0, 3);
  const readings = frontOrder(CARDS.filter((story) => story.locales[lang].written)).slice(0, 3);
  return (
    <aside className="video-related">
      {others.length ? (
        <section aria-labelledby="video-related-title">
          <h2 id="video-related-title" className="video-section-title">
            {words.related}
          </h2>
          {others.map((item) => (
            <Link key={item.id} {...videoLink(lang, item.id)} className="video-related-card group">
              <div className="video-related-picture">
                {item.poster ? (
                  <img
                    src={item.poster}
                    {...imageSet(item.poster, imageSizes("15vw", "34vw"))}
                    alt=""
                    width={1600}
                    height={900}
                    loading="lazy"
                  />
                ) : null}
                <span className="video-duration" dir="ltr">
                  {formatDuration(item.duration)}
                </span>
              </div>
              <div className="video-related-copy">
                <p className="video-category">{words.video}</p>
                <h3 className="paper-title group-hover:underline">{item.locales[lang]?.title}</h3>
                <p>{item.locales[lang]?.dek}</p>
              </div>
            </Link>
          ))}
        </section>
      ) : null}
      {readings.length ? (
        <section aria-labelledby="video-more-title">
          <h2 id="video-more-title" className="video-section-title">
            {words.more}
          </h2>
          {readings.map((story) => (
            <Link key={story.id} {...readLink(lang, story.id)} className="video-related-card group">
              {story.image ? (
                <div className="video-related-picture">
                  <img
                    src={story.image.src}
                    {...imageSet(story.image.src, imageSizes("15vw", "34vw"))}
                    alt=""
                    width={1500}
                    height={1000}
                    loading="lazy"
                  />
                </div>
              ) : null}
              <div className="video-related-copy">
                <p className="video-category">{copy.themes[story.theme]}</p>
                <h3 className="paper-title group-hover:underline">{storyTitle(story, lang)}</h3>
                <p>
                  {(story.locales[lang].dek || story.locales[lang].lead).match(
                    /^.*?[.!?؟۔](?=\s|$)/,
                  )?.[0] ||
                    story.locales[lang].dek ||
                    story.locales[lang].lead}
                </p>
              </div>
            </Link>
          ))}
        </section>
      ) : null}
    </aside>
  );
}

/** A viewing room around the existing player, gestures, settings and timed text. */
export function VideoPage({ video }: { video: Video | null }) {
  const lang = useLang();
  const words = videoWords(lang);
  const [open, setOpen] = useState(false);
  const screen = useRef<HTMLVideoElement | null>(null);
  const onScreen = useCallback((element: HTMLVideoElement | null) => {
    screen.current = element;
  }, []);
  const copy = video?.locales[lang];
  const transcript = copy?.transcript ? paragraphs(copy.transcript) : [];
  function startAt(seconds: number) {
    const element = screen.current;
    if (!element) return;
    announceStart("film");
    void element.play().catch(() => {});
    void seekTo(element, seconds, true);
  }
  const motion = motionCopy(lang);
  return (
    <Shell layout="video">
      <main className="video-watch">
        {video && copy ? (
          <>
            <article className="video-stage">
              <div className="video-ambient" aria-hidden="true" />
              <div className="video-room-word" aria-hidden="true">ORBIS</div>
              <div className="video-stage-top">
                <p className="video-overline">{motion.label}</p>
                <Link {...mediaLink(lang)} className="video-back">
                  <ArrowLeft aria-hidden="true" />
                  {words.back}
                </Link>
              </div>
              <header className="video-room-heading">
                <p className="video-overline">
                  {words.video}
                  {video.duration ? <span dir="ltr"> · {formatDuration(video.duration)}</span> : null}
                </p>
                <h1 className="paper-title video-title">{copy.title}</h1>
              </header>
              <div className="video-stage-grid">
                <div className="video-screen-frame">
                  <div className="video-orbits" aria-hidden="true">
                    <span className="video-orbit video-orbit-one" />
                    <span className="video-orbit video-orbit-two" />
                    <span className="video-orbit video-orbit-three" />
                    <span className="video-orbit-star video-orbit-star-one" />
                    <span className="video-orbit-star video-orbit-star-two" />
                  </div>
                  <Film
                    key={`${video.id}-${lang}`}
                    src={copy.src ?? video.src}
                    poster={video.poster}
                    label={copy.title}
                    lang={lang}
                    length={video.duration}
                    onScreen={onScreen}
                    captions={Object.entries(video.captions ?? {}).map(([code, path]) => ({
                      lang: code as Lang,
                      src: path,
                      label: langMeta[code as Lang].name,
                    }))}
                    className="video-inline-player"
                  />
                  <span className="video-portal-caption" aria-hidden="true">
                    {words.play}<ArrowUpRight />
                  </span>
                </div>
                <div className="video-description">
                  {copy.dek ? <p className="video-dek">{copy.dek}</p> : null}
                  <VideoActions key={`${video.id}-${lang}`} video={video} lang={lang} />
                </div>
              </div>
            </article>
            {transcript.length ? (
              <section
                className="video-transcript-section"
                aria-labelledby="video-transcript-title"
              >
                <div className="video-transcript-heading">
                  <h2 id="video-transcript-title" className="paper-title">
                    {motion.words}
                  </h2>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls="video-transcript"
                    onClick={() => setOpen((value) => !value)}
                    className="video-transcript-toggle"
                  >
                    {open ? words.hideTranscript : words.readTranscript}
                    <span aria-hidden="true">{open ? "−" : "+"}</span>
                  </button>
                </div>
                <Transcript
                  id="video-transcript"
                  paragraphs={transcript}
                  captions={video.captions?.[lang]}
                  lang={lang}
                  hidden={!open}
                  film={screen}
                  onPlayFrom={startAt}
                  className="video-transcript-copy"
                />
              </section>
            ) : null}
            <VideoRelated video={video} lang={lang} />
          </>
        ) : (
          <p className="video-empty">{words.missing}</p>
        )}
      </main>
    </Shell>
  );
}
