import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Pause, Play, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Film } from "@/components/film";
import { useDockHeight } from "@/lib/dock";
import { imageSet } from "@/lib/image-set";
import { readLink, videoLink } from "@/lib/lang-path";
import { fmt } from "@/lib/listen";
import { videoWords } from "@/lib/videos";
import {
  closeWatch,
  registerScreen,
  setOpen,
  toggleFilm,
  useWatch,
  watch,
  type WatchClip,
} from "@/lib/watch";

/**
 * The film's panel at the foot of the screen, after the listening bar and in its colours:
 * a black band from which the screen unrolls like a projection screen pulled down from its
 * roller, the film playing on it with the site's own controls (play, time, seek line,
 * sound, full screen; taps and double taps as on YouTube). Folded, the screen rolls back up
 * into the band, the film playing on in a strip with its still, title, play and close. It
 * keeps playing while the reader moves between pages.
 *
 * The panel and its video element are always on the page, empty and hidden until a film is
 * started, so the reader's tap on a still can start the sound at once.
 */
export function VideoDock() {
  const now = useWatch();
  const clip = now.clip;
  const lang = clip?.lang ?? "en";
  const words = videoWords(lang);
  const box = useRef<HTMLElement | null>(null);
  const space = useDockHeight(box, clip !== null);
  const [screen, setScreen] = useState<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);

  const onScreen = useCallback((el: HTMLVideoElement | null) => {
    registerScreen(el);
    setScreen(el);
  }, []);

  useEffect(() => {
    if (!screen) return;
    const sync = () => {
      setPlaying(!screen.paused);
      setTime(screen.currentTime);
      setLength(Number.isFinite(screen.duration) ? screen.duration : 0);
    };
    const events = ["play", "pause", "ended", "timeupdate", "loadedmetadata", "emptied"];
    for (const name of events) screen.addEventListener(name, sync);
    return () => {
      for (const name of events) screen.removeEventListener(name, sync);
    };
  }, [screen]);

  const open = clip !== null && now.open;
  const total = length || clip?.duration || 0;
  const pct = `${total > 0 ? (Math.min(time, total) / total) * 100 : 0}%`;

  return (
    <>
      {clip ? <div aria-hidden="true" className="no-print" style={{ height: space }} /> : null}
      <section
        ref={box}
        aria-label={words.video}
        aria-hidden={clip ? undefined : true}
        className={`dock video-dock no-print fixed inset-x-0 bottom-0 z-40 ${clip ? "" : "is-idle"} ${open ? "is-open" : "is-folded"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {clip && !open ? (
          <span aria-hidden="true" className="dock-progress" style={{ width: pct }} />
        ) : null}
        <div className="mx-auto w-full max-w-2xl md:px-8">
          <div className="dock-screen" inert={!open}>
            <div className="dock-roll">
              <Film
                bare
                poster={clip?.poster}
                label={clip?.title ?? ""}
                lang={lang}
                length={clip?.duration}
                onScreen={onScreen}
                className="w-full"
              />
            </div>
          </div>
          <div className="dock-strip flex min-h-14 items-center gap-3 px-5 py-2 md:px-0">
            {clip?.poster ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={words.openPanel}
                className="dock-thumb"
              >
                <img
                  src={clip.poster}
                  {...imageSet(clip.poster, "4rem")}
                  alt=""
                  className="block h-full w-full object-cover"
                />
              </button>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted tabular-nums">
                {words.video}
                <span dir="ltr">{` · ${fmt(time)} / ${fmt(total)}`}</span>
              </p>
              {clip ? (
                <Link
                  {...(clip.reading ? readLink(clip.lang, clip.id) : videoLink(clip.lang, clip.id))}
                  className="paper-title block truncate text-base font-bold leading-tight text-ink underline-offset-4 hover:underline"
                >
                  {clip.title}
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              onClick={toggleFilm}
              aria-label={playing ? words.pause : words.play}
              className="dock-play play-disc size-10"
            >
              {playing ? (
                <Pause className="size-4" fill="currentColor" strokeWidth={0} aria-hidden="true" />
              ) : (
                <Play
                  className="ms-0.5 size-4 rtl:-scale-x-100"
                  fill="currentColor"
                  strokeWidth={0}
                  aria-hidden="true"
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-label={open ? words.foldPanel : words.openPanel}
              aria-expanded={open}
              className="dock-icon"
            >
              {open ? (
                <ChevronDown className="size-5" strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <ChevronUp className="size-5" strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={closeWatch}
              aria-label={words.closeFilm}
              title={words.closeFilm}
              className="dock-icon -me-2"
            >
              <X className="size-4" strokeWidth={1.25} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * A video's still on its page, with the large burgundy play button and the length: a tap
 * opens the panel at the foot of the screen, which unrolls its screen and plays the film.
 * While the film plays there, the still says so; a tap unrolls the screen again.
 */
export function VideoStart({ clip, className = "" }: { clip: WatchClip; className?: string }) {
  const words = videoWords(clip.lang);
  const now = useWatch();
  const here = now.clip?.src === clip.src;
  return (
    <button
      type="button"
      onClick={() => watch(clip)}
      aria-label={`${words.play}: ${clip.title}`}
      className={`film film-still relative block aspect-video overflow-hidden bg-ink ${className}`}
    >
      {clip.poster ? (
        <img
          src={clip.poster}
          {...imageSet(clip.poster, "(min-width: 768px) 48rem, 100vw")}
          alt=""
          width={1600}
          height={900}
          loading="eager"
          decoding="async"
          className="absolute inset-0 block h-full w-full object-cover"
        />
      ) : null}
      <span className="film-start absolute inset-0 flex items-center justify-center">
        <span aria-hidden="true" className="film-start-ring">
          <Play
            className="size-[42%] translate-x-[6%] rtl:-scale-x-100"
            fill="currentColor"
            strokeWidth={0}
          />
        </span>
        {clip.duration && !here ? (
          <span aria-hidden="true" dir="ltr" className="film-length">
            {fmt(clip.duration)}
          </span>
        ) : null}
        {here ? <span className="film-here">{words.inPanel}</span> : null}
      </span>
    </button>
  );
}
