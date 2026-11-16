import { useLayoutEffect, useRef, useState, type RefObject } from "react";

const OPENING_MS = 1500;
/** Share of the opening the fall lasts; the film bursts out after it. */
const FALL = 0.62;
const FALL_EASE = "cubic-bezier(0.5, 0, 0.9, 0.6)";
const BURST = "cubic-bezier(0.1, 0.8, 0.2, 1)";

/** A fall into the globe opens the video. The eye drops toward Earth, the air
 * turns thick and blue, the cloud deck closes over the view and goes dark, and
 * the film bursts from the middle of that dark. The layout stays still; the
 * globe is drawn closer by its own renderer (a "dive" event on its canvas), and
 * only opacity, filter and the video's clip animate on the page. */
export function usePortalOpening({
  box, film, enabled, started, full,
}: {
  box: RefObject<HTMLDivElement | null>;
  film: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  started: boolean;
  full: boolean;
}) {
  const [opening, setOpening] = useState(false);
  const origin = useRef<number | null>(null);

  function prepare() {
    if (!enabled || started || origin.current || full ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cover = box.current?.querySelector<HTMLElement>(".film-portal-cover");
    if (!cover) return;
    origin.current = cover.getBoundingClientRect().width;
    setOpening(true);
  }

  useLayoutEffect(() => {
    if (full) {
      origin.current = null;
      setOpening(false);
      return;
    }
    if (!started || !origin.current) return;
    origin.current = null;
    const video = film.current;
    if (!video || typeof video.animate !== "function") {
      setOpening(false);
      return;
    }
    const after = video.getBoundingClientRect();
    if (!after.width) {
      setOpening(false);
      return;
    }
    const host = box.current;
    const cover = host?.querySelector<HTMLElement>(".film-portal-cover");
    if (!host || !cover) {
      setOpening(false);
      return;
    }
    const frame = host.getBoundingClientRect(), disc = cover.getBoundingClientRect();
    const cx = disc.left - frame.left + disc.width / 2, cy = disc.top - frame.top + disc.height / 2;
    const vx = after.left - frame.left, vy = after.top - frame.top, vw = after.width, vh = after.height;
    const timing = { duration: OPENING_MS, fill: "both" as FillMode };
    // The globe draws its own fall; any other cover simply swells toward the eye.
    const dive = { duration: OPENING_MS * FALL, handled: false };
    cover.querySelector("canvas")?.dispatchEvent(new CustomEvent("orbis-dive", { detail: dive }));
    const swell = dive.handled ? {} : { transform: "translate(-50%, -50%) scale(1)" };
    const swollen = dive.handled ? {} : { transform: "translate(-50%, -50%) scale(2.4)" };
    const animations = [
      // Light dies inside the cloud; the dark disc then gives way to the film.
      cover.animate([
        { opacity: 1, filter: "brightness(1)", ...swell, easing: FALL_EASE },
        { opacity: 1, filter: "brightness(1)", offset: 0.5 },
        { opacity: 1, filter: "brightness(0.1)", offset: 0.66, ...swollen },
        { opacity: 1, filter: "brightness(0.05)", offset: 0.7, ...swollen },
        { opacity: 0, filter: "brightness(0.05)", offset: 0.84, ...swollen },
        { opacity: 0, filter: "brightness(0.05)", ...swollen },
      ], timing),
    ];
    const centre = `${cx - vx}px ${cy - vy}px`;
    const reach = Math.hypot(Math.max(cx - vx, vw - (cx - vx)), Math.max(cy - vy, vh - (cy - vy))) + 8;
    const grow = video.animate([
      { clipPath: `circle(0px at ${centre})` },
      { clipPath: `circle(0px at ${centre})`, offset: 0.66, easing: BURST },
      { clipPath: `circle(${reach}px at ${centre})`, offset: 0.86 },
      { clipPath: `circle(${reach}px at ${centre})` },
    ], { duration: OPENING_MS });
    animations.push(grow);
    const finish = () => {
      animations.forEach((animation) => animation.cancel());
      setOpening(false);
    };
    let disposed = false;
    void grow.finished.then(() => {
      if (!disposed) setOpening(false);
    }, () => {});
    window.addEventListener("resize", finish, { once: true });
    return () => {
      disposed = true;
      window.removeEventListener("resize", finish);
      animations.forEach((animation) => animation.cancel());
    };
  }, [started, full, box, film]);

  return { opening, prepare };
}
