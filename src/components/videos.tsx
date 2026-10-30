import { Link } from "@tanstack/react-router";
import { Bookmark, Check, Share2 } from "lucide-react";
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
 * Videos are their own content: no reading and no issue behind them. The front page shows
 * them in its Videos block (front.tsx); "Show all" opens the list of every video. Each video
 * has its own page with the transcript under it.
 */

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
      <main className="video-list page-width gutter">
        <header className="video-list-head">
          <h1 className="video-list-title">{words.videos}</h1>
          <p className="video-list-note">{words.listNote}</p>
          <div className="video-list-filters" aria-label={words.videos}>
            <button type="button" aria-pressed={!onlySaved} onClick={() => setOnlySaved(false)}>{words.back}</button>
            <button type="button" aria-pressed={onlySaved} onClick={() => setOnlySaved(true)}>{words.savedVideos} ({videos.filter(video => saved.ids.includes(video.id)).length})</button>
          </div>
        </header>
        {visible.length === 0 ? (
          <p className="video-list-empty">{onlySaved ? words.savedEmpty : words.empty}</p>
        ) : null}
        <ol className="video-list-rows">
          {visible.map((video, index) => {
            const copy = video.locales[lang];
            return (
              <li key={video.id} className="video-list-row">
                <Link {...videoLink(lang, video.id)} className="video-list-link group">
                  <Still video={video} sizes="(min-width: 768px) 24rem, 40vw" eager={index < 3} />
                  <div className="video-list-copy">
                    <h2 className="video-list-item-title">{copy?.title}</h2>
                    {copy?.dek ? <p className="video-list-dek">{copy.dek}</p> : null}
                    <p className="meta">
                      <span className="meta-time">{formatDate(video.date, lang)}</span>
                      {video.duration ? (
                        <span className="meta-time figures" dir="ltr">
                          {formatDuration(video.duration)}
                        </span>
                      ) : null}
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
    {marked ? <Link {...mediaLink(lang)} className="video-saved-link">{words.savedVideos}</Link> : null}
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
    announceStart("film");
    void element.play().catch(() => {});
    void seekTo(element, seconds, true);
  }
  return (
    <Shell layout="video">
      <main className="video-watch page-width gutter">
        <div className="video-breadcrumb"><VideoTrail lang={lang} title={copy?.title} /></div>
        {video && copy ? (
          <div className="video-watch-grid">
            <article className="video-primary">
              <Film
                key={`${video.id}-${lang}`}
                src={copy.src ?? video.src}
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
