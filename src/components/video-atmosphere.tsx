import { useEffect, useRef, useState } from "react";

/** Four painted layers drift as a whole; no per-frame JavaScript or layout work. */
export function VideoAtmosphere() {
  const surface = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    let visible = false;
    const update = () => setActive(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    }, { rootMargin: "60px" });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div ref={surface} className="video-atmosphere" data-active={active} aria-hidden="true">
      <span className="video-nebula video-nebula-burgundy" />
      <span className="video-nebula video-nebula-blue" />
      <span className="video-stars video-stars-far" />
      <span className="video-stars video-stars-near" />
    </div>
  );
}
