import { useEffect, useRef, useState } from "react";
import { WatchingEarth } from "@/components/watching-earth";

const STAR_POSITIONS = [
  [8, 15], [15, 9], [23, 21], [31, 12], [40, 18], [51, 10], [62, 16], [73, 11], [87, 19], [92, 8],
  [12, 32], [19, 43], [28, 35], [47, 28], [60, 41], [73, 30], [83, 39], [91, 29],
  [9, 51], [17, 62], [26, 53], [72, 50], [79, 60], [88, 54], [94, 65],
  [11, 79], [20, 71], [33, 81], [43, 73], [57, 85], [69, 76], [83, 85], [90, 75],
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
      <div className="video-sky">
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
        <div className="video-star-field">
          {STAR_POSITIONS.map(([x, y]) => (
            <span key={`${x}-${y}`} style={{ left: `${x}%`, top: `${y}%` }} />
          ))}
        </div>
      </div>
      <WatchingEarth paused={paused} />
    </div>
  );
}
