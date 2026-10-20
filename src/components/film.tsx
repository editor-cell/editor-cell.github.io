import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AUDIO_EVENT, announceStart, fmt } from "@/lib/listen";
import type { Lang } from "@/lib/types";
import { videoWords } from "@/lib/videos";

const PLAYER = "film";
/** How long the controls stay after the last touch or pointer move while the film plays. */
const HIDE_AFTER = 2500;

/**
 * The site's own video player, after the clean players of Vimeo and Plyr: before the first
 * play only the still and one large burgundy button; then a thin bar along the foot of the
 * picture (play, time, a seek line in the accent, sound, full screen) that steps aside
 * while the film plays and comes back on a touch, a pointer move or the keyboard. The
 * browser's own controls are not drawn, so they never sit over the words of a still. On an
 * iPhone, full screen hands over to the phone's own player. Starting the film pauses any
 * recording, and a recording started elsewhere pauses the film.
 */
export function Film({
  src,
  poster,
  label,
  lang,
  length = 0,
  preload = "metadata",
  className = "",
}: {
  src: string;
  poster?: string;
  /** The length in seconds as the video's file gives it, until the film reports its own. */
  length?: number;
  label: string;
  lang: Lang;
  preload?: "metadata" | "none";
  className?: string;
}) {
  const words = videoWords(lang);
  const box = useRef<HTMLDivElement | null>(null);
  const film = useRef<HTMLVideoElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [reported, setReported] = useState(0);
  const duration = reported || length;
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);
  const [shown, setShown] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onStart = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== PLAYER) film.current?.pause();
    };
    const onFull = () => setFull(document.fullscreenElement === box.current);
    window.addEventListener(AUDIO_EVENT, onStart);
    document.addEventListener("fullscreenchange", onFull);
    return () => {
      window.removeEventListener(AUDIO_EVENT, onStart);
      document.removeEventListener("fullscreenchange", onFull);
      window.clearTimeout(timer.current);
    };
  }, []);

  /** Bring the controls back; while the film plays they leave again after a pause. */
  function wake(stay = !playing) {
    setShown(true);
    window.clearTimeout(timer.current);
    if (!stay) timer.current = window.setTimeout(() => setShown(false), HIDE_AFTER);
  }

  async function toggle() {
    const el = film.current;
    if (!el) return;
    if (!el.paused) {
      el.pause();
      return;
    }
    try {
      setFailed(false);
      announceStart(PLAYER);
      await el.play();
    } catch {
      setFailed(true);
    }
  }

  function seek(value: number) {
    const el = film.current;
    if (!el) return;
    el.currentTime = value;
    setTime(value);
  }

  function toggleSound() {
    const el = film.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }

  function toggleFull() {
    const el = film.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (box.current?.requestFullscreen) {
      void box.current.requestFullscreen();
    } else {
      el?.webkitEnterFullscreen?.();
    }
  }

  function onKey(event: React.KeyboardEvent) {
    if (event.target instanceof HTMLInputElement) return;
    const el = film.current;
    if (!el) return;
    if (event.key === " " || event.key === "k") {
      event.preventDefault();
      void toggle();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -5 : 5;
      seek(Math.max(0, Math.min(el.currentTime + step, duration || el.currentTime + step)));
    } else if (event.key === "m") {
      toggleSound();
    } else if (event.key === "f") {
      toggleFull();
    } else {
      return;
    }
    wake();
  }

  const span = duration > 0 ? Math.min(time, duration) / duration : 0;
  const pct = `${span * 100}%`;
  const bar = started && (shown || !playing);

  return (
    <div
      ref={box}
      className={`film relative aspect-video overflow-hidden bg-ink ${full ? "is-full" : ""} ${bar ? "" : "is-quiet"} ${className}`}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse") wake();
      }}
      onMouseLeave={() => {
        if (playing) setShown(false);
      }}
      onFocus={() => wake(true)}
      onBlur={() => wake()}
      onKeyDown={onKey}
    >
      <video
        ref={film}
        src={src}
        poster={poster}
        preload={preload}
        playsInline
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback"
        aria-label={label}
        className="block h-full w-full object-contain"
        onClick={() => {
          // A touch first brings the hidden bar back; a click with a mouse plays or pauses.
          if (started && !bar) wake();
          else void toggle();
        }}
        onPlay={() => {
          setStarted(true);
          setPlaying(true);
          wake(false);
        }}
        onPause={() => {
          setPlaying(false);
          wake(true);
        }}
        onEnded={() => {
          setPlaying(false);
          wake(true);
        }}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const d = event.currentTarget.duration;
          setReported(Number.isFinite(d) ? d : 0);
        }}
        onDurationChange={(event) => {
          const d = event.currentTarget.duration;
          setReported(Number.isFinite(d) ? d : 0);
        }}
        onError={() => setFailed(true)}
      />

      {!started ? (
        <button
          type="button"
          onClick={() => void toggle()}
          aria-label={`${words.play}: ${label}`}
          className="film-start absolute inset-0 flex items-center justify-center"
        >
          <span aria-hidden="true" className="film-start-ring">
            <Play
              className="size-[42%] translate-x-[6%] rtl:-scale-x-100"
              fill="currentColor"
              strokeWidth={0}
            />
          </span>
          {duration > 0 ? (
            <span aria-hidden="true" dir="ltr" className="film-length">
              {fmt(duration)}
            </span>
          ) : null}
        </button>
      ) : null}

      {failed ? (
        <p role="alert" className="film-failed absolute inset-x-0 top-0 px-4 py-3 text-sm">
          {words.failed}
        </p>
      ) : null}

      {started ? (
        <div className="film-bar absolute inset-x-0 bottom-0" aria-hidden={!bar}>
          <div className="film-seek relative mx-3 md:mx-4">
            <div className="film-rule" aria-hidden="true">
              <span className="film-fill" style={{ width: pct }} />
              <span className="film-knob" style={{ insetInlineStart: pct }} />
            </div>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(time, duration || 0)}
              aria-label={words.seek}
              aria-valuetext={`${fmt(time)} / ${fmt(duration)}`}
              tabIndex={bar ? 0 : -1}
              onChange={(event) => seek(Number(event.target.value))}
              onPointerDown={() => wake(true)}
              onPointerUp={() => wake()}
            />
          </div>
          <div className="flex items-center gap-1 px-1.5 pb-1 md:px-2.5 md:pb-1.5">
            <button
              type="button"
              onClick={() => void toggle()}
              aria-label={playing ? words.pause : words.play}
              tabIndex={bar ? 0 : -1}
              className="film-button"
            >
              {playing ? (
                <Pause className="size-5" fill="currentColor" strokeWidth={0} aria-hidden="true" />
              ) : (
                <Play
                  className="size-5 rtl:-scale-x-100"
                  fill="currentColor"
                  strokeWidth={0}
                  aria-hidden="true"
                />
              )}
            </button>
            <span dir="ltr" className="film-time tabular-nums">
              {fmt(time)}
              <span className="px-1 opacity-60" aria-hidden="true">
                /
              </span>
              {fmt(duration)}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={toggleSound}
              aria-label={muted ? words.unmute : words.mute}
              tabIndex={bar ? 0 : -1}
              className="film-button"
            >
              {muted ? (
                <VolumeX className="size-5" strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Volume2 className="size-5" strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleFull}
              aria-label={full ? words.exitFullscreen : words.fullscreen}
              tabIndex={bar ? 0 : -1}
              className="film-button"
            >
              {full ? (
                <Minimize className="size-5" strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Maximize className="size-5" strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
