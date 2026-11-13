import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Bookmark, Check, Share2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Film } from "@/components/film";
import { announceStart } from "@/lib/listen";
import { seekTo } from "@/lib/seek";
import { useSavedVideos } from "@/lib/saved-videos";
import { Shell } from "@/components/shell";
import { Transcript } from "@/components/transcript";
import { imageSet } from "@/lib/image-set";
import { langMeta } from "@/lib/i18n";
import { mediaLink, videoLink } from "@/lib/lang-path";
import { formatDate, paragraphs } from "@/lib/text";
import type { Lang, Video, VideoCard } from "@/lib/types";
import { useLang } from "@/lib/use-lang";
import { formatDuration, videoWords, videosIn } from "@/lib/videos";
import { usePosterGround } from "@/lib/use-poster-ground";
import { VideoAtmosphere } from "@/components/video-atmosphere";
import { WatchingEarth } from "@/components/watching-earth";
import { WatchingVideos } from "@/components/watching-videos";

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
  const posterGround = usePosterGround(video.poster);
  return (
    <div className="media-still relative aspect-video w-full overflow-hidden bg-ink" style={posterGround.style}>
      {video.poster ? (
        <img
          src={video.poster}
          ref={posterGround.ref}
          onLoad={posterGround.onLoad}
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

/** Shared editorial language for the archive and its viewing room. */
function motionCopy(lang: Lang) {
  return lang === "tr"
    ? {
        label: "Orbis İzle",
        title: "Görmenin başka bir yolu.",
        latest: "Son video",
      }
    : {
        label: "Orbis Watching",
        title: "A different way to see.",
        latest: "Latest film",
      };
}

/** The same world and published-video list as the homepage, with saved filtering. */
export function VideoListPage() {
  const lang = useLang();
  const words = videoWords(lang);
  const videos = videosIn(lang);
  const saved = useSavedVideos();
  const [onlySaved, setOnlySaved] = useState(false);
  const savedVideos = videos.filter((video) => saved.ids.includes(video.id));
  const visible = onlySaved ? savedVideos : videos;
  return <Shell layout="video">
    <main className="video-library watching-library">
      <VideoAtmosphere />
      <header className="watching-top"><p className="video-overline">{motionCopy(lang).label}</p></header>
      <div className="watching-layout">
        <div className="watching-world"><WatchingEarth /></div>
        <section className="watching-sidebar" aria-labelledby="watching-library-title">
          <h1 id="watching-library-title" className="paper-title watching-list-title">{words.videos}</h1>
          <div className="video-list-filters" aria-label={words.videos}>
            <button type="button" aria-pressed={!onlySaved} onClick={() => setOnlySaved(false)}>{words.back}<span>{videos.length}</span></button>
            <button type="button" aria-pressed={onlySaved} onClick={() => setOnlySaved(true)}>{words.savedVideos}<span>{savedVideos.length}</span></button>
          </div>
          {visible.length ? <WatchingVideos videos={visible} lang={lang} /> : <p className="video-empty" role="status">{onlySaved ? words.savedEmpty : words.empty}</p>}
        </section>
      </div>
    </main>
  </Shell>;
}

/** Date and working watch-later/share actions. Duration stays with the screen. */
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
            <article className="video-stage watching-stage">
              <VideoAtmosphere />
              <div className="video-stage-top">
                <p className="video-overline">{motion.label}</p>
                <Link {...mediaLink(lang)} className="video-back">
                  <ArrowLeft aria-hidden="true" />
                  {words.back}
                </Link>
              </div>
              <h1 className="sr-only">{copy.title}</h1>
              <div className="watching-layout">
                <div className="video-screen-frame watching-screen">
                  <Film
                    key={`${video.id}-${lang}`}
                    src={copy.src ?? video.src}
                    poster={video.poster}
                    label={copy.title}
                    lang={lang}
                    length={video.duration}
                    portalCover
                    portalArtwork={<WatchingEarth />}
                    bare
                    onScreen={onScreen}
                    captions={Object.entries(video.captions ?? {}).map(([code, path]) => ({
                      lang: code as Lang,
                      src: path,
                      label: langMeta[code as Lang].name,
                    }))}
                    className="video-inline-player"
                  />
                </div>
                <div className="watching-sidebar">
                  <h2 className="paper-title watching-list-title">{words.videos}</h2>
                  <WatchingVideos videos={videosIn(lang)} lang={lang} selected={video.id} onPlay={() => {
                    const element = screen.current;
                    if (!element) return;
                    announceStart("film");
                    void element.play().catch(() => {});
                  }} />
                  <div className="watching-video-details">
                    {copy.dek ? <p className="video-dek">{copy.dek}</p> : null}
                    <VideoActions key={`${video.id}-${lang}`} video={video} lang={lang} />
                  </div>
                </div>
              </div>
            </article>
            {transcript.length ? (
              <section
                className="video-transcript-section"
                aria-labelledby="video-transcript-toggle"
              >
                <div className="video-transcript-heading">
                  <button
                    id="video-transcript-toggle"
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
          </>
        ) : (
          <p className="video-empty">{words.missing}</p>
        )}
      </main>
    </Shell>
  );
}
