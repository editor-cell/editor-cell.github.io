import { useLayoutEffect, useRef, useState, type RefObject } from "react";

const OPENING_MS = 1100;
const EASING = "cubic-bezier(0.3, 0.12, 0.25, 1)";

/** Open the real video at the circle's existing center. The surrounding layout
 * stays still; only the video's scale and circular cover's opacity animate. */
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
    // Begin at the circle's full width. Its cropped poster fades above the real
    // video as it grows uniformly into its original, uncropped aspect ratio.
    const scale = circleWidth / after.width;
    const options = { duration: OPENING_MS, easing: EASING };
    const grow = video.animate([
      { transform: `scale(${scale})` },
      { transform: "none" },
    ], options);
    const animations = [grow];
    const cover = box.current?.querySelector<HTMLElement>(".film-portal-cover");
    if (cover) {
      animations.push(cover.animate([
        { opacity: 1 },
        { opacity: 0 },
      ], { ...options, fill: "both" }));
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
