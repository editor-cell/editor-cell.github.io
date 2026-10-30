import { Play, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Film, type FilmCaption } from "@/components/film";
import { Transcript } from "@/components/transcript";
import { imageSet } from "@/lib/image-set";
import { announceStart, fmt } from "@/lib/listen";
import { seekTo } from "@/lib/seek";
import type { Lang } from "@/lib/types";
import { videoWords } from "@/lib/videos";

export type FilmClip = {
  lang: Lang;
  title: string;
  src: string;
  poster?: string;
  /** Seconds, from the video's file, until the film reports its own length. */
  duration?: number;
  /** Subtitles the reader can turn on in the film. */
  captions?: FilmCaption[];
  /** The transcript's paragraphs, readable under the screen. */
  transcript?: string[];
};

/**
 * A video's still on its page, with the large burgundy play button and the length. A tap
 * turns the lights down, as in a cinema (a projection screen, not a panel sliding up from
 * the foot as on some news sites): the page darkens, a screen comes down from its roller in
 * a little above the middle and the film plays on it with the site's own controls (play,
 * time, seek line, subtitles, speed, sound, full screen; taps and double taps as on
 * YouTube). Under the screen the transcript opens behind one button, as on the page; open,
 * the screen moves up to leave the words the rest of the window, and they follow the film.
 * Only the cross or Escape rolls the screen up and brings the page back (a tap on the dark
 * around the screen does nothing: the owner, 22 Oct 2026); the film waits where it was
 * stopped.
 *
 * The screen and its video element are on the page from the start, hidden, so the reader's
 * tap can start the sound at once on a phone. What follows the still on the page (its
 * transcript) is drawn by `children`, which can start the film at a given second.
 */
export function VideoStart({
  clip,
  className = "",
  children,
}: {
  clip: FilmClip;
  className?: string;
  children?: (startAt: (seconds: number) => void) => ReactNode;
}) {
  const words = videoWords(clip.lang);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [reading, setReading] = useState(false);
  const screen = useRef<HTMLVideoElement | null>(null);
  const still = useRef<HTMLButtonElement | null>(null);
  const cross = useRef<HTMLButtonElement | null>(null);

  // The screen is put under the page's body once the page runs in the browser.
  useEffect(() => setReady(true), []);

  const onScreen = useCallback((el: HTMLVideoElement | null) => {
    screen.current = el;
  }, []);

  /** Lights down and the film on, from where it was or from the second given. */
  function start(at?: number) {
    setOpen(true);
    playFrom(at);
  }

  function playFrom(at?: number) {
    const el = screen.current;
    if (!el) return;
    if (el.paused) {
      announceStart("film");
      void el.play().catch(() => {});
    }
    if (at !== undefined) void seekTo(el, at, true);
  }

  const stop = useCallback(() => {
    screen.current?.pause();
    if (document.fullscreenElement) void document.exitFullscreen();
    setOpen(false);
    still.current?.focus();
  }, []);

  // While the lights are down: the page under it stays still, Escape closes, and the
  // keyboard starts on the cross.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    cross.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) stop();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = before;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, stop]);

  return (
    <>
      <button
        ref={still}
        type="button"
        onClick={() => start()}
        aria-label={`${words.play}: ${clip.title}${clip.duration ? `, ${fmt(clip.duration)}` : ""}`}
        aria-haspopup="dialog"
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
          {clip.duration ? (
            <span aria-hidden="true" dir="ltr" className="film-length">
              {fmt(clip.duration)}
            </span>
          ) : null}
        </span>
      </button>
      {ready
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={clip.title}
              aria-hidden={open ? undefined : true}
              inert={!open}
              className={`theater no-print ${open ? "is-on" : ""} ${reading && clip.transcript?.length ? "is-reading" : ""}`}
            >
              <div className="theater-frame">
                <div className="theater-head">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#a8a39a]">
                      {words.video}
                      {clip.duration ? (
                        <span dir="ltr" className="tabular-nums">{` · ${fmt(clip.duration)}`}</span>
                      ) : null}
                    </p>
                    <p className="paper-title text-lg font-bold leading-tight md:text-2xl">
                      {clip.title}
                    </p>
                  </div>
                  <button
                    ref={cross}
                    type="button"
                    onClick={stop}
                    aria-label={words.closeFilm}
                    title={words.closeFilm}
                    className="theater-close"
                  >
                    <X className="size-6" strokeWidth={1.25} aria-hidden="true" />
                  </button>
                </div>
                <div aria-hidden="true" className="theater-roller" />
                <div className="theater-screen">
                  <Film
                    bare
                    src={clip.src}
                    poster={clip.poster}
                    label={clip.title}
                    lang={clip.lang}
                    length={clip.duration}
                    onScreen={onScreen}
                    captions={clip.captions}
                    className="w-full"
                  />
                </div>
                {clip.transcript?.length ? (
                  <section className="theater-notes">
                    <button
                      type="button"
                      aria-expanded={reading}
                      aria-controls="theater-transcript"
                      onClick={() => setReading((value) => !value)}
                      className="theater-notes-button"
                    >
                      {reading ? words.hideTranscript : words.readTranscript}
                    </button>
                    <Transcript
                      id="theater-transcript"
                      paragraphs={clip.transcript}
                      captions={clip.captions?.find((c) => c.lang === clip.lang)?.src}
                      lang={clip.lang}
                      hidden={!reading}
                      film={open ? screen : null}
                      onPlayFrom={playFrom}
                      className="theater-transcript"
                    />
                  </section>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
      {children?.(start)}
    </>
  );
}
