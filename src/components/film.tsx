import { ChevronsLeft, ChevronsRight, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AUDIO_EVENT, RATES, announceStart, fmt } from "@/lib/listen";
import { seekTo } from "@/lib/seek";
import type { Lang } from "@/lib/types";
import { videoWords } from "@/lib/videos";

/** The bar's and the settings panel's own icons: thin ivory lines, drawn here rather than
 * taken from the icon set, after the owner's chosen design (22 Oct 2026). */
function Icon({
  d,
  fill = false,
  className = "film-ico",
}: {
  d: string[];
  fill?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {d.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

const ICON = {
  play: ["M8 5v14l11-7z"],
  pause: ["M6 4h4v16H6z", "M14 4h4v16h-4z"],
  gear: [
    "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
    "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  ],
  sound: ["M11 5L6 9H2v6h4l5 4V5z", "M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"],
  muted: ["M11 5L6 9H2v6h4l5 4V5z", "M16 9l6 6M22 9l-6 6"],
  speed: ["M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z", "M12 6v6l4 2"],
  subtitles: [
    "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    "M7 15h4M13 15h4M7 11h10",
  ],
  full: [
    "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3",
  ],
  exitFull: [
    "M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3",
  ],
};

const PLAYER = "film";
/** How long the controls stay after the last touch or pointer move while the film plays. */
const HIDE_AFTER = 2500;
/** A second tap on the same side within this time is a double tap; after one, each further
 * tap within SEEK_RUN on that side jumps again. */
const DOUBLE_TAP = 300;
const SEEK_RUN = 700;
/** Seconds one tap of a double tap jumps, as on YouTube. */
const TAP_STEP = 10;

type Side = "back" | "ahead";

/** One language of subtitles: a WebVTT file timed to the film. */
export type FilmCaption = { lang: Lang; src: string; label: string };

const CAPTIONS_KEY = "orbis-captions";

/**
 * The site's own video player, after the clean players of Vimeo and Plyr: before the first
 * play only the still and one large burgundy button; then a thin bar along the foot of the
 * picture (play, time, a seek line in the accent, sound, full screen) that steps aside
 * while the film plays and comes back on a touch, a pointer move or the keyboard. The
 * browser's own controls are not drawn, so they never sit over the words of a still. On an
 * iPhone, full screen hands over to the phone's own player. Starting the film pauses any
 * recording, and a recording started elsewhere pauses the film.
 *
 * Touch, as on YouTube: with the bar hidden, a tap anywhere brings it back; with the bar
 * shown, a tap in the middle plays or pauses and a tap at the left or right puts the bar
 * away. Two or more quick taps at the left go back, at the right go ahead, ten seconds a
 * tap. A mouse click plays or pauses, the bar following the pointer.
 */
export function Film({
  src,
  poster,
  label,
  lang,
  length = 0,
  preload = "metadata",
  className = "",
  bare = false,
  controlsBeforePlay = false,
  onScreen,
  captions = [],
}: {
  /** Left out in the panel at the foot of the page, which sets the film itself. */
  src?: string;
  poster?: string;
  /** The length in seconds as the video's file gives it, until the film reports its own. */
  length?: number;
  label: string;
  lang: Lang;
  preload?: "metadata" | "none";
  className?: string;
  /** No start screen: the film is started from outside (the panel's screen). */
  bare?: boolean;
  /** The editorial video page shows its controls over the poster from the start. */
  controlsBeforePlay?: boolean;
  /** Receives the video element once it is on the page. */
  onScreen?: (el: HTMLVideoElement | null) => void;
  /** Subtitles the reader can turn on, one per language. */
  captions?: FilmCaption[];
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
  const [volume, setVolume] = useState(1);
  const [full, setFull] = useState(false);
  const [shown, setShown] = useState(true);
  const [failed, setFailed] = useState(false);
  // The jump just made by taps, shown at its side for a moment: "10 seconds", "20 seconds"...
  const [jump, setJump] = useState<{ side: Side; seconds: number } | null>(null);
  const pointer = useRef("mouse");
  const tap = useRef<{ side: Side; at: number } | null>(null);
  const tapTimer = useRef<number | undefined>(undefined);
  const run = useRef<{ side: Side; until: number } | null>(null);
  const jumpTimer = useRef<number | undefined>(undefined);
  const barShown = useRef(false);
  // The settings panel behind the gear, the one of its lists opened in it (speed or
  // subtitles), the subtitles chosen (none, or a language), the line shown now, and the
  // playing speed.
  const [menu, setMenu] = useState<"settings" | null>(null);
  const [sub, setSub] = useState<"subtitles" | "speed" | null>(null);
  const [cc, setCc] = useState<Lang | null>(null);
  const [cue, setCue] = useState("");
  const [rate, setRate] = useState(1);
  const captionKey = captions.map((c) => `${c.lang}:${c.src}`).join(" ");

  // The reader's last choice of subtitles, if this film has them in that language.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CAPTIONS_KEY);
      if (saved && captions.some((c) => c.lang === saved)) setCc(saved as Lang);
    } catch {
      /* no saved choice */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captionKey]);

  // The chosen language's track is read but not drawn by the browser: the line is set in
  // the site's own type, above the bar when the bar shows.
  useEffect(() => {
    const el = film.current;
    if (!el) return;
    let active: TextTrack | null = null;
    Array.from(el.textTracks).forEach((track, i) => {
      const mine = captions[i]?.lang === cc && cc !== null;
      track.mode = mine ? "hidden" : "disabled";
      if (mine) active = track;
    });
    setCue("");
    const track = active as TextTrack | null;
    if (!track) return;
    const onCue = () => {
      const now = track.activeCues?.[0] as VTTCue | undefined;
      setCue(now ? now.text.replace(/<[^>]+>/g, "") : "");
    };
    track.addEventListener("cuechange", onCue);
    onCue();
    return () => track.removeEventListener("cuechange", onCue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cc, captionKey]);

  useEffect(() => {
    const el = film.current;
    if (!el) return;
    el.defaultPlaybackRate = rate;
    el.playbackRate = rate;
  }, [rate]);

  function closeMenu() {
    setMenu(null);
    setSub(null);
  }

  function chooseCaptions(lang: Lang | null) {
    setCc(lang);
    closeMenu();
    wake();
    try {
      if (lang) localStorage.setItem(CAPTIONS_KEY, lang);
      else localStorage.removeItem(CAPTIONS_KEY);
    } catch {
      /* the choice holds for this visit */
    }
  }

  useEffect(() => {
    onScreen?.(film.current);
    return () => onScreen?.(null);
    // Handed over once: the element lives as long as the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      window.clearTimeout(tapTimer.current);
      window.clearTimeout(jumpTimer.current);
    };
  }, []);

  /** Bring the controls back; while the film plays they leave again after a pause. */
  function wake(stay = !playing) {
    setShown(true);
    window.clearTimeout(timer.current);
    if (!stay)
      timer.current = window.setTimeout(() => {
        setShown(false);
        closeMenu();
      }, HIDE_AFTER);
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
    void seekTo(el, value);
    setTime(value);
  }

  /** Back or ahead TAP_STEP seconds from a tap, and show the sum at that side. */
  function jumpBy(side: Side) {
    const el = film.current;
    if (!el) return;
    const end = duration || el.currentTime + TAP_STEP;
    seek(Math.max(0, Math.min(el.currentTime + (side === "back" ? -TAP_STEP : TAP_STEP), end)));
    run.current = { side, until: performance.now() + SEEK_RUN };
    setJump((last) => ({
      side,
      seconds: last?.side === side ? last.seconds + TAP_STEP : TAP_STEP,
    }));
    window.clearTimeout(jumpTimer.current);
    jumpTimer.current = window.setTimeout(() => setJump(null), SEEK_RUN);
  }

  function hide() {
    window.clearTimeout(timer.current);
    setShown(false);
    closeMenu();
  }

  function onSurface(event: React.MouseEvent<HTMLVideoElement>) {
    // With the settings open, a tap on the picture only puts them away.
    if (menu) {
      closeMenu();
      wake();
      return;
    }
    if (pointer.current === "mouse") {
      void toggle();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const side: Side | null = x < 0.35 ? "back" : x > 0.65 ? "ahead" : null;
    const now = performance.now();
    if (!side) {
      window.clearTimeout(tapTimer.current);
      tap.current = null;
      if (barShown.current) void toggle();
      else wake();
      return;
    }
    // Going on with a run of jumps, or the second tap of a double tap.
    if (run.current?.side === side && now < run.current.until) {
      jumpBy(side);
      return;
    }
    if (tap.current?.side === side && now - tap.current.at < DOUBLE_TAP) {
      window.clearTimeout(tapTimer.current);
      tap.current = null;
      jumpBy(side);
      return;
    }
    // A single tap at a side: wait a moment to see whether a second follows.
    window.clearTimeout(tapTimer.current);
    tap.current = { side, at: now };
    tapTimer.current = window.setTimeout(() => {
      tap.current = null;
      if (barShown.current) hide();
      else wake();
    }, DOUBLE_TAP);
  }

  function toggleSound() {
    const el = film.current;
    if (!el) return;
    if (el.muted && el.volume === 0) el.volume = 0.5;
    el.muted = !el.muted;
  }

  /** The sound bar beside the speaker: all the way left is silence. */
  function setLoudness(value: number) {
    const el = film.current;
    if (!el) return;
    el.volume = value;
    el.muted = value === 0;
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
  const hasControls = started || controlsBeforePlay;
  const bar = hasControls && shown;
  const loud = muted ? 0 : volume;
  barShown.current = bar;

  return (
    <div
      ref={box}
      className={`film relative aspect-video overflow-hidden bg-ink ${full ? "is-full" : ""} ${bar ? "" : "is-quiet"} ${className}`}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse") wake();
      }}
      onPointerDown={(event) => {
        pointer.current = event.pointerType;
      }}
      onMouseLeave={() => {
        if (playing && !menu) setShown(false);
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
        onClick={onSurface}
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
        onLoadStart={() => {
          // A new film: no old time, length or failure carried over.
          setFailed(false);
          setTime(0);
          setReported(0);
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
        onVolumeChange={(event) => {
          setMuted(event.currentTarget.muted);
          setVolume(event.currentTarget.volume);
        }}
      >
        {captions.map((c) => (
          <track key={c.lang} kind="subtitles" src={c.src} srcLang={c.lang} label={c.label} />
        ))}
      </video>

      {cue ? (
        <p aria-live="off" className="film-cue">
          <span>{cue}</span>
        </p>
      ) : null}

      {!started && !bare ? (
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
          {duration > 0 && !controlsBeforePlay ? (
            <span aria-hidden="true" dir="ltr" className="film-length">
              {fmt(duration)}
            </span>
          ) : null}
        </button>
      ) : null}

      {jump ? (
        <div
          key={jump.side}
          aria-hidden="true"
          className={`film-jump absolute inset-y-0 ${jump.side === "back" ? "start-0 rounded-e-[50%]" : "end-0 rounded-s-[50%]"}`}
          dir="ltr"
        >
          {jump.side === "back" ? (
            <ChevronsLeft className="size-7" strokeWidth={1.75} />
          ) : (
            <ChevronsRight className="size-7" strokeWidth={1.75} />
          )}
          <span className="film-jump-words">
            {jump.seconds} {words.seconds}
          </span>
        </div>
      ) : null}

      {failed ? (
        <p role="alert" className="film-failed absolute inset-x-0 top-0 px-4 py-3 text-sm">
          {words.failed}
        </p>
      ) : null}

      {hasControls ? (
        <div className="film-bar" aria-hidden={!bar}>
          <div className="film-glass">
            {menu ? (
              <div role="menu" aria-label={words.settings} className="film-menu">
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={sub === "speed"}
                  onClick={() => {
                    setSub(sub === "speed" ? null : "speed");
                    wake(true);
                  }}
                  className="film-set"
                >
                  <Icon d={ICON.speed} />
                  <span className="film-set-label">{words.speed}</span>
                  <span dir="ltr" className="film-set-value tabular-nums">
                    {rate}×
                  </span>
                </button>
                {sub === "speed" ? (
                  <div role="group" aria-label={words.speed} className="film-sub">
                    {RATES.map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={rate === value}
                        onClick={() => {
                          setRate(value);
                          setSub(null);
                          wake(true);
                        }}
                        className="film-menu-item"
                      >
                        <span dir="ltr" className="tabular-nums">
                          {value}×
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {captions.length ? (
                  <button
                    type="button"
                    role="menuitem"
                    aria-haspopup="menu"
                    aria-expanded={sub === "subtitles"}
                    onClick={() => {
                      setSub(sub === "subtitles" ? null : "subtitles");
                      wake(true);
                    }}
                    className="film-set"
                  >
                    <Icon d={ICON.subtitles} />
                    <span className="film-set-label">{words.subtitles}</span>
                    <span className="film-set-value">
                      {cc ? captions.find((c) => c.lang === cc)?.label : words.subtitlesOff}
                    </span>
                  </button>
                ) : null}
                {sub === "subtitles" ? (
                  <div role="group" aria-label={words.subtitles} className="film-sub">
                    {[null, ...captions.map((c) => c.lang)].map((lang) => (
                      <button
                        key={lang ?? "off"}
                        type="button"
                        role="menuitemradio"
                        aria-checked={cc === lang}
                        onClick={() => chooseCaptions(lang)}
                        className="film-menu-item"
                      >
                        {lang ? captions.find((c) => c.lang === lang)?.label : words.subtitlesOff}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="film-seek">
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
            <div className="film-row">
              <button
                type="button"
                onClick={() => void toggle()}
                aria-label={playing ? words.pause : words.play}
                tabIndex={bar ? 0 : -1}
                className="film-key film-key-main"
              >
                {playing ? (
                  <Icon d={ICON.pause} fill className="film-ico-bar" />
                ) : (
                  <Icon d={ICON.play} fill className="film-ico-bar rtl:-scale-x-100" />
                )}
              </button>
              <div className="film-vol" dir="ltr">
                <button
                  type="button"
                  onClick={() => {
                    toggleSound();
                    wake(true);
                  }}
                  aria-label={muted ? words.unmute : words.mute}
                  tabIndex={bar ? 0 : -1}
                  className="film-key"
                >
                  <Icon
                    d={muted || volume === 0 ? ICON.muted : ICON.sound}
                    className="film-ico-bar"
                  />
                </button>
                <div className="film-vol-line">
                  <div className="film-rule" aria-hidden="true">
                    <span className="film-fill" style={{ width: `${loud * 100}%` }} />
                    <span className="film-knob" style={{ insetInlineStart: `${loud * 100}%` }} />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={loud}
                    aria-label={words.volume}
                    aria-valuetext={`${Math.round(loud * 100)}%`}
                    tabIndex={bar ? 0 : -1}
                    onChange={(event) => setLoudness(Number(event.target.value))}
                    onPointerDown={() => wake(true)}
                    onPointerUp={() => wake()}
                  />
                </div>
              </div>
              <span dir="ltr" className="film-time">
                {fmt(time)}
                <span className="film-time-rule" aria-hidden="true">
                  /
                </span>
                {fmt(duration)}
              </span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => {
                  if (menu) closeMenu();
                  else setMenu("settings");
                  wake(true);
                }}
                aria-label={words.settings}
                aria-haspopup="menu"
                aria-expanded={menu === "settings"}
                tabIndex={bar ? 0 : -1}
                className={`film-key ${menu ? "is-on" : ""}`}
              >
                <Icon d={ICON.gear} className="film-ico-bar" />
              </button>
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  toggleFull();
                }}
                aria-label={full ? words.exitFullscreen : words.fullscreen}
                tabIndex={bar ? 0 : -1}
                className="film-key"
              >
                <Icon d={full ? ICON.exitFull : ICON.full} className="film-ico-bar" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
