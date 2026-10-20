import { useSyncExternalStore } from "react";
import { AUDIO_EVENT, announceStart, close as closeListening } from "@/lib/listen";
import type { Lang } from "@/lib/types";

/**
 * Watching a video: one film at a time, played by the screen in the panel at the foot of
 * the page (VideoDock), which lives as long as the page does, so the film keeps playing
 * while the reader moves between pages. The still on a video's page starts it here; the
 * panel unrolls its screen and plays.
 *
 * The listening bar and this panel take turns: a film starting closes the bar, a
 * recording starting from a card or a reading closes the panel.
 */

export type WatchClip = {
  id: string;
  lang: Lang;
  title: string;
  src: string;
  poster?: string;
  /** Seconds, from the video's file, until the film reports its own length. */
  duration?: number;
  /** A reading's own film: the panel's title opens the reading, not a video page. */
  reading?: boolean;
};

export type WatchState = {
  clip: WatchClip | null;
  /** The screen unrolled (true) or the panel folded to its strip (false). */
  open: boolean;
};

/** Who starts a film, in AUDIO_EVENT's detail. */
export const FILM = "film";
const BAR = "bar";

const EMPTY: WatchState = { clip: null, open: false };
let state: WatchState = EMPTY;
let screen: HTMLVideoElement | null = null;
let heard = false;
const listeners = new Set<() => void>();

function set(patch: Partial<WatchState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

/** The panel's video element, handed over once the panel is on the page. */
export function registerScreen(el: HTMLVideoElement | null) {
  screen = el;
  if (heard || typeof window === "undefined") return;
  heard = true;
  window.addEventListener(AUDIO_EVENT, (event) => {
    if ((event as CustomEvent<string>).detail === BAR) closeWatch();
  });
}

/**
 * Play a film in the panel, its screen unrolled. Called straight from the reader's tap, so
 * a phone lets the sound play; the same film again only unrolls the screen and resumes it.
 */
export function watch(clip: WatchClip) {
  const el = screen;
  if (!el) return;
  if (state.clip?.src === clip.src) {
    set({ open: true });
    if (el.paused) {
      announceStart(FILM);
      void el.play().catch(() => {});
    }
    return;
  }
  closeListening();
  el.src = clip.src;
  announceStart(FILM);
  void el.play().catch(() => {});
  set({ clip, open: true });
}

export function setOpen(open: boolean) {
  if (state.clip) set({ open });
}

export function toggleFilm() {
  const el = screen;
  if (!el || !state.clip) return;
  if (el.paused) {
    announceStart(FILM);
    void el.play().catch(() => {});
  } else {
    el.pause();
  }
}

/** Stop the film and take the panel away. */
export function closeWatch() {
  if (screen) {
    screen.pause();
    screen.removeAttribute("src");
    screen.load();
  }
  set(EMPTY);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWatch(): WatchState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}
