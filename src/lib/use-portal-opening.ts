import { useLayoutEffect, useRef, useState, type RefObject } from "react";

const OPENING_MS = 1500;
const SOFT = "cubic-bezier(0.3, 0.12, 0.25, 1)";
const OPEN = "cubic-bezier(0.2, 0.7, 0.2, 1)";

/** A sunrise seen from orbit opens the video. Earth falls into shadow, a thin
 * arc of lit air appears on its right limb, the sun breaks out there, its
 * light runs into one horizontal line across the screen, and the line opens
 * into the film. The layout stays still; only opacity, transform, filter and
 * the video's clip animate, on light elements removed when it ends. */
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
    const circleWidth = origin.current;
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
    const size = disc.width || circleWidth;
    const cx = disc.left - frame.left + disc.width / 2, cy = disc.top - frame.top + disc.height / 2;
    const vx = after.left - frame.left, vw = after.width;
    const sunX = cx + size / 2;
    const timing = { duration: OPENING_MS, fill: "both" as FillMode };
    const made: HTMLElement[] = [];
    const light = (name: string, style: Partial<CSSStyleDeclaration>) => {
      const element = document.createElement("span");
      element.className = name;
      element.setAttribute("aria-hidden", "true");
      Object.assign(element.style, style);
      host.appendChild(element);
      made.push(element);
      return element;
    };
    const arc = light("portal-dawn-arc", {
      left: `${cx}px`, top: `${cy}px`, width: `${size * 1.1}px`, height: `${size * 1.1}px`,
    });
    const sun = light("portal-dawn-sun", {
      left: `${sunX}px`, top: `${cy}px`, width: `${size * 0.16}px`, height: `${size * 0.16}px`,
    });
    const focus = Math.min(100, Math.max(0, ((sunX - vx) / vw) * 100));
    const line = light("portal-dawn-line", {
      left: `${vx}px`, top: `${cy}px`, width: `${vw}px`, transformOrigin: `${focus}% 50%`,
      background: `linear-gradient(90deg, transparent, #f4ece0b3 14%, #fffaf2 ${focus}%, #f4ece0b3 90%, transparent)`,
    });
    const radius = getComputedStyle(video).borderRadius || "0px";
    const shut = `inset(50% 0 50% 0 round ${radius})`;
    const animations = [
      // Earth falls into shadow and stays a dark disc behind the opening film.
      cover.animate([
        { opacity: 1, filter: "brightness(1)", easing: SOFT },
        { opacity: 1, filter: "brightness(0.22)", offset: 0.3 },
        { opacity: 1, filter: "brightness(0.07)", offset: 0.55 },
        { opacity: 1, filter: "brightness(0.07)", offset: 0.68 },
        { opacity: 0, filter: "brightness(0.07)", offset: 0.9 },
        { opacity: 0, filter: "brightness(0.07)" },
      ], timing),
      arc.animate([
        { opacity: 0 },
        { opacity: 0.4, offset: 0.2 },
        { opacity: 1, offset: 0.42 },
        { opacity: 0.7, offset: 0.6 },
        { opacity: 0, offset: 0.76 },
        { opacity: 0 },
      ], timing),
      sun.animate([
        { opacity: 0, transform: "translate(-50%, -50%) scale(0.2)" },
        { opacity: 0, transform: "translate(-50%, -50%) scale(0.2)", offset: 0.25 },
        { opacity: 1, transform: "translate(-50%, -50%) scale(1)", offset: 0.45 },
        { opacity: 1, transform: "translate(-50%, -50%) scale(1.12)", offset: 0.58 },
        { opacity: 0, transform: "translate(-50%, -50%) scale(1.2)", offset: 0.78 },
        { opacity: 0, transform: "translate(-50%, -50%) scale(1.2)" },
      ], timing),
      line.animate([
        { opacity: 0, transform: "translateY(-50%) scaleX(0.02)" },
        { opacity: 0, transform: "translateY(-50%) scaleX(0.02)", offset: 0.35 },
        { opacity: 1, transform: "translateY(-50%) scaleX(0.3)", offset: 0.47, easing: OPEN },
        { opacity: 1, transform: "translateY(-50%) scaleX(1)", offset: 0.66 },
        { opacity: 0, transform: "translateY(-50%) scaleX(1)", offset: 0.84 },
        { opacity: 0, transform: "translateY(-50%) scaleX(1)" },
      ], timing),
    ];
    const grow = video.animate([
      { clipPath: shut },
      { clipPath: shut, offset: 0.62, easing: OPEN },
      { clipPath: `inset(0 0 0 0 round ${radius})` },
    ], { duration: OPENING_MS });
    animations.push(grow);
    const finish = () => {
      animations.forEach((animation) => animation.cancel());
      made.forEach((element) => element.remove());
      setOpening(false);
    };
    let disposed = false;
    void grow.finished.then(() => {
      made.forEach((element) => element.remove());
      if (!disposed) setOpening(false);
    }, () => {});
    window.addEventListener("resize", finish, { once: true });
    return () => {
      disposed = true;
      window.removeEventListener("resize", finish);
      animations.forEach((animation) => animation.cancel());
      made.forEach((element) => element.remove());
    };
  }, [started, full, box, film]);

  return { opening, prepare };
}
