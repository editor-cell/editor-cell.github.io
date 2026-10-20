import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Pick } from "@/components/pick";
import * as bar from "@/lib/listen";
import {
  AUDIO_EVENT,
  RATES,
  SKIP_SECONDS,
  announceStart,
  fmt,
  readRate,
  useListen,
  writeRate,
} from "@/lib/listen";
import type { AudioClip } from "@/lib/types";

/**
 * Back or ahead fifteen seconds: a turning arrow drawn as a hairline circle, with the
 * number set inside it. Placed on either side of the seek line: back before, ahead after.
 */
export function SkipButton({
  direction,
  label,
  onClick,
}: {
  direction: "back" | "ahead";
  label: string;
  onClick: () => void;
}) {
  const back = direction === "back";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex size-8 shrink-0 items-center justify-center text-ink"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-7"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {back ? (
          <>
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </>
        ) : (
          <>
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </>
        )}
        <text
          x="12"
          y="12.4"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="currentColor"
          stroke="none"
          fontSize="7.5"
          letterSpacing="-0.2"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {SKIP_SECONDS}
        </text>
      </svg>
    </button>
  );
}

const PLAYER = "reading";

/** The same recording, whichever way its address is written. */
function sameRecording(a: string, b: string) {
  if (typeof window === "undefined") return a === b;
  try {
    return new URL(a, window.location.href).href === new URL(b, window.location.href).href;
  } catch {
    return a === b;
  }
}

export function ReadingPlayer({
  clip,
  listen,
  pause,
  speed = "Speed",
  failed = "The recording could not be played.",
  retry = "Try again",
  back = "Back 15 seconds",
  ahead = "Ahead 15 seconds",
}: {
  clip: AudioClip;
  listen: string;
  pause: string;
  speed?: string;
  failed?: string;
  retry?: string;
  back?: string;
  ahead?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  // The recording would not load or play: say so, and offer another try.
  const [error, setError] = useState(false);
  const rateRef = useRef(1);
  rateRef.current = rate;

  useEffect(() => {
    setRate(readRate());
  }, []);

  // The bar at the foot of the screen started a recording: this one stops.
  useEffect(() => {
    const onStart = (event: Event) => {
      if ((event as CustomEvent<string>).detail === PLAYER) return;
      audioRef.current?.pause();
      setPlaying(false);
    };
    window.addEventListener(AUDIO_EVENT, onStart);
    return () => window.removeEventListener(AUDIO_EVENT, onStart);
  }, []);

  useEffect(() => {
    // A new language brings a new recording: start it from the top, stopped.
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    setError(false);
    const audio = new Audio(clip.dataUrl);
    audio.preload = "metadata";
    audio.playbackRate = rateRef.current;
    audioRef.current = audio;
    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    const onFail = () => {
      setPlaying(false);
      setError(true);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("error", onFail);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onFail);
      audioRef.current = null;
    };
  }, [clip.dataUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
  }, [rate]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      audio.playbackRate = rate;
      announceStart(PLAYER);
      await audio.play();
      setPlaying(true);
      setError(false);
    } catch {
      setPlaying(false);
      setError(true);
    }
  }

  /** Fetch the recording again after a failure (a dropped connection, say). */
  function tryAgain() {
    const audio = audioRef.current;
    if (!audio) return;
    setError(false);
    audio.load();
    void toggle();
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setProgress(value);
  }

  function skip(step: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const end = duration || (Number.isFinite(audio.duration) ? audio.duration : 0);
    seek(Math.max(0, end ? Math.min(audio.currentTime + step, end) : audio.currentTime + step));
  }

  function changeRate(value: number) {
    setRate(value);
    writeRate(value);
    const audio = audioRef.current;
    if (audio) audio.playbackRate = value;
  }

  // This reading's recording already playing in the bar at the foot of the screen (started
  // from a card): the player here shows where it is and steers it, instead of offering to
  // start it again from the top.
  const now = useListen();
  const shared = now.clip !== null && sameRecording(now.clip.src, clip.dataUrl);
  const view = shared
    ? {
        playing: now.playing,
        progress: now.time,
        duration: now.duration,
        rate: now.rate,
        error: now.error,
        toggle: async () => bar.toggle(),
        seek: bar.seek,
        skip: bar.skip,
        changeRate: bar.setRate,
        tryAgain: bar.retry,
      }
    : { playing, progress, duration, rate, error, toggle, seek, skip, changeRate, tryAgain };

  const span = view.duration > 0 ? Math.min(view.progress, view.duration) / view.duration : 0;
  const pct = `${span * 100}%`;

  return (
    <div className="reading-player w-full min-w-0">
      {/* Wide screen: one line, the seek line giving up width before anything moves down.
          Phone (mobile.css): stacked as in the bar at the foot of the screen, the seek line
          the full width, the times under its ends, then the speed and the group of keys. */}
      <div className="listen-row flex w-full min-w-0 flex-nowrap items-center gap-x-1.5 sm:gap-x-3">
        {/* Back · play · ahead as one group, as on the listening apps: the play button, filled
            in the accent and a size larger, between the two turning arrows. */}
        <div className="listen-keys flex shrink-0 items-center gap-x-0.5 sm:gap-x-1">
          <SkipButton direction="back" label={back} onClick={() => view.skip(-SKIP_SECONDS)} />
          <button
            type="button"
            onClick={() => void view.toggle()}
            aria-label={view.playing ? pause : listen}
            className="play-disc size-9"
          >
            {/* The triangle sits a hair right of centre to look centred. */}
            {view.playing ? (
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
          <SkipButton direction="ahead" label={ahead} onClick={() => view.skip(SKIP_SECONDS)} />
        </div>
        {/* The word, beside the group on a wide screen; on a phone it gives its room to the
            PDF and share marks on the same line. The button above already carries it. */}
        <span
          aria-hidden="true"
          onClick={() => void view.toggle()}
          className="listen-word hidden shrink-0 cursor-pointer text-[11px] uppercase tracking-[0.18em] text-ink sm:inline"
        >
          {view.playing ? pause : listen}
        </span>
        <div className="seek-line">
          <div className="seek-rule" aria-hidden="true">
            <span className="seek-fill" style={{ width: pct }} />
            <span className="seek-knob" style={{ insetInlineStart: pct }} />
          </div>
          <input
            className="seek"
            type="range"
            min={0}
            max={view.duration || 0}
            step={0.1}
            value={Math.min(view.progress, view.duration || 0)}
            aria-label={listen}
            aria-valuetext={`${fmt(view.progress)} / ${fmt(view.duration)}`}
            onChange={(event) => view.seek(Number(event.target.value))}
          />
        </div>
        <span
          dir="ltr"
          className="listen-time shrink-0 text-[11px] tabular-nums tracking-wide text-muted"
        >
          {fmt(view.progress)}
          <span className="px-1 text-rule" aria-hidden="true">
            —
          </span>
          {fmt(view.duration)}
        </span>
        {/* The phone's times, under the two ends of the seek line: heard, and still to go. */}
        <span
          dir="ltr"
          aria-hidden="true"
          className="listen-ends text-[11px] tabular-nums tracking-wide text-muted"
        >
          <span>{fmt(view.progress)}</span>
          <span>−{fmt(Math.max(0, view.duration - view.progress))}</span>
        </span>
        <span className="listen-speed inline-flex shrink-0">
          <Pick
            tone="page"
            align="end"
            label={speed}
            value={String(view.rate)}
            onChange={(value) => view.changeRate(Number(value))}
            options={RATES.map((value) => ({ value: String(value), label: `${value}x` }))}
            buttonClassName="gap-1 py-0 text-[11px] tracking-widest text-muted"
          >
            <span dir="ltr" className="tabular-nums text-ink">
              {view.rate}×
            </span>
            <span aria-hidden="true" className="text-[9px] leading-none">
              ▾
            </span>
          </Pick>
        </span>
      </div>
      {view.error ? (
        <p role="alert" className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
          {failed}
          <button
            type="button"
            onClick={() => void view.tryAgain()}
            className="inline-flex min-h-11 items-center text-pine underline underline-offset-4"
          >
            {retry}
          </button>
        </p>
      ) : null}
    </div>
  );
}
