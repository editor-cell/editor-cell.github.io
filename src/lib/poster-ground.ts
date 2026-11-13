/** Pick the dominant edge color, not the illustration or title in the middle.
 * Nearby shades share a bucket so JPEG noise does not change the result. */
export function posterGroundColor(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
): string | null {
  if (width < 1 || height < 1 || pixels.length < width * height * 4) return null;
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  const edge = Math.max(1, Math.floor(Math.min(width, height) / 10));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= edge && x < width - edge && y >= edge && y < height - edge) continue;
      const at = (y * width + x) * 4;
      if (pixels[at + 3] < 240) continue;
      const r = pixels[at], g = pixels[at + 1], b = pixels[at + 2];
      const key = `${Math.round(r / 16)},${Math.round(g / 16)},${Math.round(b / 16)}`;
      const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  }
  let winner: { count: number; r: number; g: number; b: number } | undefined;
  for (const bucket of buckets.values()) {
    if (!winner || bucket.count > winner.count) winner = bucket;
  }
  if (!winner) return null;
  return `rgb(${Math.round(winner.r / winner.count)}, ${Math.round(winner.g / winner.count)}, ${Math.round(winner.b / winner.count)})`;
}
