import { useSyncExternalStore } from "react";
import type { Lang } from "@/lib/types";

/**
 * Listening from the front page: one recording at a time, played by a single audio
 * element that lives as long as the page does, so it keeps playing while the reader
 * moves between the front page and the sections. The bar at the foot of the screen
 * (ListenBar) shows it; the "Listen" mark on a card starts it.
 *
 * The reading page has its own player. The two never play over each other: whichever
 * starts sends AUDIO_EVENT, and the other pauses.
 */

export type ListenClip = {
  id: string;
  lang: Lang;
  title: string;
  src: string;
  /** The reading's picture, shown small in the bar. */
  image?: string;
};

export type ListenState = {
  clip: ListenClip | null;
  playing: boolean;
  time: number;
  duration: number;
  rate: number;
  error: boolean;
};

export const RATES = [0.75, 1, 1.25, 1.5, 2] as const;
export const SKIP_SECONDS = 15;
const RATE_KEY = "orbis-rate";

/** Fired on window when any player starts; detail names who started it. */
export const AUDIO_EVENT = "orbis:audio-start";
const BAR = "bar";

export function readRate(): number {
  try {
    const next = Number(localStorage.getItem(RATE_KEY));
    if ((RATES as readonly number[]).includes(next)) return next;
  } catch {
    /* keep default */
  }
  return 1;
}

export function writeRate(value: number) {
  try {
    localStorage.setItem(RATE_KEY, String(value));
  } catch {
    /* ignore */
  }
}

export function announceStart(who: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUDIO_EVENT, { detail: who }));
}

const EMPTY: ListenState = {
  clip: null,
  playing: false,
  time: 0,
  duration: 0,
  rate: 1,
  error: false,
};

let state: ListenState = EMPTY;
let audio: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<ListenState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function element(): HTMLAudioElement {
  if (audio) return audio;
  const el = new Audio();
  el.preload = "metadata";
  el.addEventListener("timeupdate", () => set({ time: el.currentTime }));
  el.addEventListener("loadedmetadata", () =>
    set({ duration: Number.isFinite(el.duration) ? el.duration : 0 }),
  );
  el.addEventListener("ended", () => set({ playing: false, time: 0 }));
  el.addEventListener("pause", () => set({ playing: false }));
  el.addEventListener("play", () => set({ playing: true, error: false }));
  el.addEventListener("error", () => {
    if (el.getAttribute("src")) set({ playing: false, error: true });
  });
  window.addEventListener(AUDIO_EVENT, (event) => {
    if ((event as CustomEvent<string>).detail !== BAR) el.pause();
  });
  audio = el;
  return el;
}

async function start() {
  const el = element();
  el.playbackRate = state.rate;
  announceStart(BAR);
  try {
    await el.play();
  } catch {
    set({ playing: false, error: true });
  }
}

/** Start a reading's recording; pressing the same reading again pauses or resumes it. */
export function listenTo(clip: ListenClip) {
  const el = element();
  const same = state.clip && state.clip.src === clip.src;
  if (same) {
    if (state.playing) el.pause();
    else void start();
    return;
  }
  const rate = state.clip ? state.rate : readRate();
  set({ clip, playing: false, time: 0, duration: 0, rate, error: false });
  el.src = clip.src;
  void start();
}

export function toggle() {
  if (!state.clip) return;
  const el = element();
  if (state.playing) el.pause();
  else void start();
}

export function seek(value: number) {
  const el = element();
  el.currentTime = value;
  set({ time: value });
}

/** Move by `step` seconds (negative goes back), kept inside the recording. */
export function skip(step: number) {
  const el = element();
  const end = Number.isFinite(el.duration) ? el.duration : state.duration;
  const next = Math.max(0, Math.min(el.currentTime + step, end || el.currentTime + step));
  seek(next);
}

export function setRate(value: number) {
  writeRate(value);
  if (audio) audio.playbackRate = value;
  set({ rate: value });
}

export function retry() {
  if (!state.clip) return;
  const el = element();
  set({ error: false });
  el.load();
  void start();
}

/** Stop and hide the bar. */
export function close() {
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  set(EMPTY);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useListen(): ListenState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}

export function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${mins}:${rest.toString().padStart(2, "0")}`;
}
