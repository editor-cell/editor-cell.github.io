import { useLayoutEffect, useRef, useState, type RefObject } from "react";

const OPENING_MS = 1100;
const EASING = "cubic-bezier(0.3, 0.12, 0.25, 1)";

/** Move the real, already-visible video out of its circular cover. Layout changes
 * once; the browser animates only transforms and the empty cover's opacity. */
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
  const origin = useRef<{
    circle: DOMRect;
    followers: { element: HTMLElement; top: number }[];
  } | null>(null);

  function prepare() {
    if (!enabled || started || origin.current || full ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cover = box.current?.querySelector<HTMLElement>(".film-portal-cover");
    if (!cover) return;
    const followers = Array.from(box.current?.closest(".video-watch")?.querySelectorAll<HTMLElement>(
      ".video-description, .video-transcript-section, .video-related",
    ) ?? []).map((element) => ({ element, top: element.getBoundingClientRect().top }));
    origin.current = { circle: cover.getBoundingClientRect(), followers };
    setOpening(true);
  }

  useLayoutEffect(() => {
    if (full) {
      origin.current = null;
      setOpening(false);
      return;
    }
    if (!started || !origin.current) return;
    const before = origin.current;
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
    const dx = before.circle.left + before.circle.width / 2 - after.left - after.width / 2;
    const dy = before.circle.top + before.circle.height / 2 - after.top - after.height / 2;
    // The still has 8% padding on either side inside the circle. Match it exactly,
    // then grow uniformly so the video never stretches or starts from invisible.
    const scale = before.circle.width * 0.84 / after.width;
    const options = { duration: OPENING_MS, easing: EASING };
    const grow = video.animate([
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})` },
      { transform: "none" },
    ], options);
    const animations = [grow];
    const cover = box.current?.querySelector<HTMLElement>(".film-portal-cover");
    if (cover) {
      const position = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      animations.push(cover.animate([
        { transform: position, opacity: 1 },
        { transform: position, opacity: 0 },
      ], { ...options, fill: "both" }));
    }
    for (const { element, top } of before.followers) {
      const offset = top - element.getBoundingClientRect().top;
      if (Math.abs(offset) > 1) animations.push(element.animate([
        { transform: `translate3d(0, ${offset}px, 0)` },
        { transform: "none" },
      ], options));
    }
    const finish = () => {
      animations.forEach((animation) => animation.cancel());
      setOpening(false);
    };
    let disposed = false;
    void grow.finished.then(() => { if (!disposed) setOpening(false); }, () => {});
    window.addEventListener("resize", finish, { once: true });
    return () => {
      disposed = true;
      window.removeEventListener("resize", finish);
      animations.forEach((animation) => animation.cancel());
    };
  }, [started, full, box, film]);

  return { opening, prepare };
}
