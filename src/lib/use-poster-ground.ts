import { useCallback, useState, type CSSProperties, type SyntheticEvent } from "react";
import { posterGroundColor } from "@/lib/poster-ground";

const cache = new Map<string, string | null>();

/** Read the already displayed still once. No extra fetch or per-frame work. */
export function usePosterGround(source = "") {
  const [sample, setSample] = useState<{ source: string; color: string } | null>(null);
  const ref = useCallback((image: HTMLImageElement | null) => {
    if (!image?.complete || !image.naturalWidth) return;
    const key = image.currentSrc || image.src;
    if (!cache.has(key)) {
      let color: string | null = null;
      try {
        const canvas = document.createElement("canvas");
        const scale = 32 / Math.max(image.naturalWidth, image.naturalHeight);
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          color = posterGroundColor(
            context.getImageData(0, 0, canvas.width, canvas.height).data,
            canvas.width,
            canvas.height,
          );
        }
      } catch {
        // A remote still may prohibit pixel access; retain the neutral CSS fallback.
      }
      if (cache.size >= 64) cache.delete(cache.keys().next().value!);
      cache.set(key, color);
    }
    const color = cache.get(key);
    if (color) setSample(previous => previous?.source === source && previous.color === color
      ? previous : { source, color });
  }, [source]);
  const onLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    ref(event.currentTarget);
  }, [ref]);
  const style = sample?.source === source
    ? { "--video-cover-ground": sample.color } as CSSProperties
    : undefined;
  return { ref, onLoad, style };
}
