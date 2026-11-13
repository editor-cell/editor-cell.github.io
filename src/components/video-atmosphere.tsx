import { useEffect, useRef, useState, type CSSProperties } from "react";
import { imageSet } from "@/lib/image-set";

// Tiny independent points supply depth without moving viewport-sized star planes.
const FLIGHT = [[-48, -28], [-22, -36], [27, -31], [52, -15], [48, 22], [18, 38], [-29, 33], [-55, 10]];

/** One compressed cloud texture and eight small stars, paused outside the viewport. */
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
      <img
        className="video-cloud"
        src="/images/orbis-nebula-cloud.webp"
        {...imageSet("/images/orbis-nebula-cloud.webp", "100vw")}
        width={960}
        height={640}
        alt=""
        loading="lazy"
        decoding="async"
        fetchPriority="low"
      />
      {FLIGHT.map(([x, y], index) => (
        <span
          key={index}
          className="video-flight-star"
          style={{
            "--star-x": `${x}vw`,
            "--star-y": `${y}rem`,
            "--star-delay": `${-index * 2.7}s`,
            "--star-duration": `${18 + (index % 3) * 2}s`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
