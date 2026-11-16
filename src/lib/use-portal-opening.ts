import { useLayoutEffect, useRef, useState, type RefObject } from "react";

const OPENING_MS = 2200;
const CROSSING = 0.62;

/** One clock takes the eye toward Earth and reveals the first decoded film frame
 * through its blue atmosphere. Neither the player nor the surrounding copy moves. */
export function usePortalOpening({ box, film, enabled, started, full }: {
  box: RefObject<HTMLDivElement | null>;
  film: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  started: boolean;
  full: boolean;
}) {
  const [opening, setOpening] = useState(false);
  const pending = useRef(false);
  const sound = useRef<boolean | null>(null);

  function prepare() {
    if (!enabled || started || pending.current || full ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!box.current?.querySelector(".film-portal-cover") || !film.current) return;
    pending.current = true;
    // Unlock playback in the original tap, but keep narration with the visible film.
    sound.current = film.current.muted;
    film.current.muted = true;
    setOpening(true);
  }

  useLayoutEffect(() => {
    const video = film.current;
    const host = box.current;
    const cover = host?.querySelector<HTMLElement>(".film-portal-cover");
    const restoreSound = () => {
      if (video && sound.current !== null) video.muted = sound.current;
      sound.current = null;
    };
    if (full || !video || !host || !cover || typeof video.animate !== "function") {
      pending.current = false;
      restoreSound();
      setOpening(false);
      return;
    }
    if (!started || !pending.current) return;
    pending.current = false;
    const picture = video.getBoundingClientRect(), disc = cover.getBoundingClientRect();
    if (!picture.width || !disc.width) {
      restoreSound(); setOpening(false); return;
    }
    const canvas = cover.querySelector("canvas");
    const probe = { progress: 0, handled: false };
    canvas?.dispatchEvent(new CustomEvent("orbis-dive", { detail: probe }));
    const scale = Math.max(1.1, picture.width / disc.width, picture.height / disc.height) * 1.08;
    const insetX = Math.max(0, (disc.width - picture.width / scale) / 2);
    const insetY = Math.max(0, (disc.height - picture.height / scale) / 2);
    const timing = { duration: OPENING_MS, fill: "both" as FillMode };
    const animations = [
      cover.animate([
        { opacity: 1, transform: "translate(-50%, -50%) scale(1)", clipPath: "inset(0px)", easing: "cubic-bezier(.45,0,.7,1)" },
        { opacity: 1, transform: `translate(-50%, -50%) scale(${scale})`, clipPath: `inset(${insetY}px ${insetX}px round 4px)`, offset: CROSSING },
        { opacity: 0, transform: `translate(-50%, -50%) scale(${scale})`, clipPath: `inset(${insetY}px ${insetX}px round 4px)`, offset: .94 },
        { opacity: 0 },
      ], timing),
      video.animate([
        { opacity: 0 },
        { opacity: 0, offset: CROSSING },
        { opacity: 1, offset: .94 },
        { opacity: 1 },
      ], timing),
    ];
    // Software-only devices use the already painted globe and cloud map. Only
    // composited transforms and opacity change; no per-pixel CPU work on the fall.
    if (!probe.handled) {
      const world = cover.querySelector<HTMLElement>(".watching-earth");
      const air = cover.querySelector<HTMLElement>(".film-entry-air");
      if (world) animations.push(world.animate([
        { transform: "scale(1)", easing: "cubic-bezier(.5,0,.8,.5)" },
        { transform: "scale(3.6)", offset: CROSSING },
        { transform: "scale(6)" },
      ], timing));
      if (air) animations.push(air.animate([
        { opacity: 0, transform: "scale(1)" },
        { opacity: 0, transform: "scale(1)", offset: .3 },
        { opacity: .92, transform: "scale(1.5)", offset: CROSSING },
        { opacity: .7, transform: "scale(2.4)" },
      ], timing));
    }
    animations.forEach(animation => { animation.pause(); animation.currentTime = 0; });
    let frame = 0, mediaFrame = 0, elapsed = 0, previous = 0;
    let ready = false, held = false, crossed = false, disposed = false;
    const resume = () => {
      if (!held) { restoreSound(); return; }
      held = false;
      void video.play().then(restoreSound, restoreSound);
    };
    const finish = () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      if (mediaFrame) video.cancelVideoFrameCallback?.(mediaFrame);
      animations.forEach(animation => animation.cancel());
      resume();
      setOpening(false);
    };
    const decoded = () => {
      if (disposed || ready) return;
      ready = true;
      // Keep the opening frame and the start of the narration for the crossing.
      if (!video.paused) { held = true; video.pause(); }
    };
    const loaded = () => {
      if (!video.requestVideoFrameCallback && video.readyState >= 2) decoded();
    };
    if (video.requestVideoFrameCallback) mediaFrame = video.requestVideoFrameCallback(decoded);
    else loaded();
    video.addEventListener("loadeddata", loaded);
    video.addEventListener("error", finish);
    const tick = (now: number) => {
      if (disposed) return;
      if (previous && !document.hidden) elapsed += now - previous;
      previous = now;
      // A slow connection waits in the atmosphere, never on an empty black video.
      if (!ready) elapsed = Math.min(elapsed, OPENING_MS * (CROSSING - .04));
      const progress = Math.min(1, elapsed / OPENING_MS);
      if (!crossed && progress >= CROSSING) { crossed = true; resume(); }
      if (probe.handled) canvas?.dispatchEvent(new CustomEvent("orbis-dive", {
        detail: { progress: Math.pow(progress, 1.25) },
      }));
      animations.forEach(animation => { animation.currentTime = elapsed; });
      if (progress < 1) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);
    window.addEventListener("resize", finish, { once: true });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      if (mediaFrame) video.cancelVideoFrameCallback?.(mediaFrame);
      video.removeEventListener("loadeddata", loaded);
      video.removeEventListener("error", finish);
      window.removeEventListener("resize", finish);
      animations.forEach(animation => animation.cancel());
      restoreSound();
      // Fullscreen can interrupt the approach while the opening frame is held.
      if (held && video.isConnected) void video.play().catch(() => {});
    };
  }, [started, full, box, film]);

  return { opening, prepare };
}
