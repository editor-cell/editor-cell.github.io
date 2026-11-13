import { useEffect, useRef, useState, type CSSProperties } from "react";

// A few near stars supply depth without per-frame JavaScript work.
const FLIGHT = [[-48, -28], [-22, -36], [27, -31], [52, -15], [48, 22], [18, 38], [-29, 33], [-55, 10], [-52, -8], [56, 7]];

/** A shared texture crossfades between forward passes; never zooms backwards. */
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
            src="/images/orbis-nebula-detail.webp"
            width={1536}
            height={1024}
            alt=""
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        ))}
      </div>
      {FLIGHT.map(([x, y], index) => (
        <span
          key={index}
          className="video-flight-star"
          style={{
            "--star-x": `${x}vw`,
            "--star-y": `${y}rem`,
            "--star-delay": `${-index * 2.7}s`,
            "--star-duration": `${16 + (index % 3) * 2}s`,
            "--star-size": `${index % 4 === 0 ? 2 : 1.5}px`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
