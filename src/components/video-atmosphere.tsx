import { useEffect, useRef, useState, type CSSProperties } from "react";
import { WatchingEarth } from "@/components/watching-earth";

// Endpoints relative to the panel, so the stars cross the same part of the sky at any size.
const FLIGHT = [
  [-50, -28], [-30, -48], [12, -47], [48, -33],
  [53, -14], [53, 10], [50, 30], [31, 45],
  [10, 46], [-42, 41], [-53, 19], [-53, -11],
  [31, -45], [-12, 49], [52, 23], [-50, 10],
];

/** The sky and slowly turning Earth share the background of the watching room. */
export function VideoAtmosphere({ paused = false }: { paused?: boolean }) {
  const surface = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    let inView = false;
    const update = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div ref={surface} className="video-atmosphere" data-active={visible && !paused} aria-hidden="true">
      <div className="video-cloud-field">
        {[0, 1].map((pass) => (
          <img
            key={pass}
            className={`video-cloud${pass ? " video-cloud-next" : ""}`}
            src="/images/orbis-deep-sky.webp"
            width={1536}
            height={1024}
            alt=""
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        ))}
      </div>
      {FLIGHT.map(([x, y], index) => {
        const near = index % 3 === 0;
        return (
          <span
            key={index}
            className="video-flight-star"
            style={{
              "--star-x": `${x}cqw`,
              "--star-y": `${y}cqh`,
              "--star-delay": `${-index * 1.7}s`,
              "--star-duration": `${near ? 7.5 + (index % 4) * 0.6 : 15 + (index % 4) * 1.5}s`,
              "--star-size": near ? "2.5px" : "1.5px",
              "--star-opacity": near ? 0.95 : 0.62,
            } as CSSProperties}
          />
        );
      })}
      <WatchingEarth paused={paused} />
    </div>
  );
}
