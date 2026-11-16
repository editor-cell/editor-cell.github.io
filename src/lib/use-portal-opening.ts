import { useLayoutEffect, useRef, useState, type RefObject } from "react";

const OPENING_MS = 1900;
const CROSSING = 0.62;
/** The ring drawn around the globe; the window starts wide enough to hold it. */
const RING = 14;

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
    // The round window around the globe widens into the film's frame: one rounded
    // rectangle whose corners close from a circle, so no straight edge ever cuts the
    // sphere. The film sits fully lit beneath the air before the air thins away, so
    // the crossing never dims through the dark page.
    const round = disc.width / 2;
    const frameClip = `inset(${insetY}px ${insetX}px round 4px)`;
    // The camera keeps sinking while the air thins, so the crossing never stands still;
    // the window tightens in step and stays exactly on the film's frame.
    const deeper = scale * 1.12;
    const deeperClip = `inset(${(disc.height - picture.height / deeper) / 2}px ${(disc.width - picture.width / deeper) / 2}px round ${4 / 1.12}px)`;
    const animations = [
      cover.animate([
        { opacity: 1, transform: "translate(-50%, -50%) scale(1)", clipPath: `inset(${-RING}px round ${round + RING}px)`, easing: "cubic-bezier(.4,0,.6,.9)" },
        { opacity: 1, transform: `translate(-50%, -50%) scale(${scale})`, clipPath: frameClip, offset: CROSSING, easing: "cubic-bezier(.25,.18,.5,1)" },
        { opacity: 0, transform: `translate(-50%, -50%) scale(${deeper})`, clipPath: deeperClip, offset: .96 },
        { opacity: 0, transform: `translate(-50%, -50%) scale(${deeper})`, clipPath: deeperClip },
      ], timing),
      video.animate([
        { opacity: 0 },
        { opacity: 0, offset: CROSSING - .05 },
        { opacity: 1, offset: CROSSING },
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
      // The cover leaves with the next render; until then it must not spring back
      // to the globe's held cloud frame for a single painted flash.
      cover.style.visibility = "hidden";
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
      const step = previous && !document.hidden ? Math.min(now - previous, 50) : 0;
      previous = now;
      // A slow connection waits in the atmosphere, never on an empty black video:
      // the fall slows gently toward the edge of the air instead of stopping dead.
      const hold = OPENING_MS * (CROSSING - .06), soft = OPENING_MS * .35;
      if (ready || elapsed < soft) elapsed += step;
      else elapsed += step * Math.max(0, (hold - elapsed) / (hold - soft));
      if (!ready) elapsed = Math.min(elapsed, hold);
      const progress = Math.min(1, elapsed / OPENING_MS);
      if (!crossed && progress >= CROSSING) { crossed = true; resume(); }
      if (probe.handled) canvas?.dispatchEvent(new CustomEvent("orbis-dive", {
        // The eye runs ahead of the widening window, so the sphere's edge has left
        // the view before the window's corners reach it.
        detail: { progress: Math.pow(Math.min(1, progress / .9), 1.1) },
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
