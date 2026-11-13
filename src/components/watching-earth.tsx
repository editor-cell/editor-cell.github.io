import { useEffect, useRef, useState } from "react";
import { createEarthRenderer } from "@/lib/earth-renderer";

/** A decorative, slowly turning Earth. It is deliberately not a play button. */
export function WatchingEarth({ paused = false }: { paused?: boolean }) {
  const surface = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pause = useRef(paused);
  const refresh = useRef<(() => void) | null>(null);
  pause.current = paused;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const element = surface.current, screen = canvas.current;
    if (!element || !screen) return;
    let frame = 0, visible = false, loaded = false, last = 0, turn = 0;
    let renderer: ReturnType<typeof createEarthRenderer> = null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resize = () => {
      const size = Math.min(900, Math.round(element.clientWidth * Math.min(window.devicePixelRatio || 1, 1.5)));
      if (screen.width !== size) { screen.width=size; screen.height=size; }
      renderer?.draw(turn);
    };
    const tick = (now: number) => {
      if (!visible || document.hidden || reduced.matches || pause.current || !loaded) { frame=0; last=0; return; }
      if (!last || now-last >= 1000/(screen.dataset.renderer === "canvas" ? 20 : 30)) {
        if (last) turn=(turn+Math.min(now-last,80)/240000)%1;
        last=now; renderer?.draw(turn);
      }
      frame=requestAnimationFrame(tick);
    };
    const update = () => {
      cancelAnimationFrame(frame); frame=0; last=0;
      if (visible && !document.hidden && !pause.current && !reduced.matches && loaded) frame=requestAnimationFrame(tick);
    };
    refresh.current=update;
    const observer = new IntersectionObserver(([entry]) => {
      visible=entry.isIntersecting;
      if (visible && !renderer) {
        resize();
        renderer=createEarthRenderer(screen,() => { loaded=true; setReady(true); update(); });
      }
      update();
    });
    observer.observe(element);
    const sizes = new ResizeObserver(resize); sizes.observe(element);
    const onLoss = (event: Event) => { event.preventDefault(); loaded=false; setReady(false); update(); };
    screen.addEventListener("webglcontextlost",onLoss);
    document.addEventListener("visibilitychange",update);
    reduced.addEventListener("change",update);
    return () => {
      refresh.current=null;
      cancelAnimationFrame(frame); observer.disconnect(); sizes.disconnect(); renderer?.dispose();
      screen.removeEventListener("webglcontextlost",onLoss);
      document.removeEventListener("visibilitychange",update); reduced.removeEventListener("change",update);
    };
  }, []);
  useEffect(() => { refresh.current?.(); }, [paused]);
  return <div ref={surface} className="watching-earth" data-ready={ready} aria-hidden="true">
    <div className="watching-earth-fallback" />
    <canvas ref={canvas} width={600} height={600} />
  </div>;
}
