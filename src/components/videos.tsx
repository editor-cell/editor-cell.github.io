import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { VideoStart } from "@/components/video-dock";
import { Shell } from "@/components/shell";
import { Trail } from "@/components/trail";
import { imageSet } from "@/lib/image-set";
import { langMeta } from "@/lib/i18n";
import { mediaLink, videoLink } from "@/lib/lang-path";
import { formatDate, paragraphs } from "@/lib/text";
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
        </div>
        {videos.length === 0 ? (
          <p className="border-t border-rule px-5 py-8 text-[15px] text-muted md:px-8">
            {words.empty}
          </p>
        ) : null}
        <ol className="-mb-5 border-t border-rule px-5 md:mb-0 md:px-8">
          {videos.map((video, index) => {
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

/** One video: the film, its title and sentence, then its transcript behind one button. */
export function VideoPage({ video }: { video: Video | null }) {
  const lang = useLang();
  const words = videoWords(lang);
  const [open, setOpen] = useState(false);
  const copy = video?.locales[lang];
  const transcript = copy?.transcript ? paragraphs(copy.transcript) : [];
  return (
    <Shell>
      <main className="px-5 pt-5 pb-0 md:px-12 md:py-12">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 md:gap-5">
          <VideoTrail lang={lang} title={copy?.title} />
          {video && copy ? (
            <>
              <div className="flex flex-col gap-2">
                <VideoKicker video={video} lang={lang} />
                <h1 className="paper-title font-bold text-[2rem] leading-[1.08] md:text-[2.8rem]">
                  {copy.title}
                </h1>
                {copy.dek ? (
                  <p className="font-body text-pretty text-lg leading-snug text-ink md:text-xl">
                    {copy.dek}
                  </p>
                ) : null}
                <p className="text-sm text-muted">{formatDate(video.date, lang)}</p>
              </div>
              <VideoStart
                clip={{
                  id: video.id,
                  lang,
                  title: copy.title,
                  src: video.src,
                  poster: video.poster,
                  duration: video.duration,
                }}
                className="-mx-5 w-[calc(100%+2.5rem)] max-w-none md:mx-0 md:w-full md:max-w-full"
              />
              {transcript.length ? (
                <section className="-mt-2 md:mt-0 md:border-t md:border-rule md:pt-4">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls="video-transcript"
                    onClick={() => setOpen((value) => !value)}
                    className="atlas-more inline-flex min-h-11 items-center text-[0.85rem]"
                  >
                    {open ? words.hideTranscript : words.readTranscript}
                  </button>
                  {/* Written into the page either way, so search engines read it; shown on demand. */}
                  <div
                    id="video-transcript"
                    hidden={!open}
                    className="font-body mt-3 flex max-w-2xl flex-col gap-5 text-pretty text-[1.05rem] leading-[1.6]"
                  >
                    {transcript.map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <p className="py-10 text-muted">{words.missing}</p>
          )}
        </div>
      </main>
    </Shell>
  );
}
