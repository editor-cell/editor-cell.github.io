import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, parse } from "node:path";
import sharp from "sharp";

/**
 * Writes smaller WebP copies of every canonical source picture in images/ (never public/images/) to <out>/assets/img/<name>-<width>.webp
 * (see src/lib/image-set.ts). They sit in assets/, which the "Publish site" workflow already
 * copies and commits. A picture narrower than a width is not enlarged; its copy keeps the
 * picture's own width.
 */
const WIDTHS = [480, 960, 1500];
const SOURCE = /\.(jpe?g|png|webp)$/i;

export async function writeImageSizes(out, source = "images") {
  if (!existsSync(source)) return 0;
  const dir = join(out, "assets", "img");
  mkdirSync(dir, { recursive: true });
  let count = 0;
  for (const file of readdirSync(source)) {
    if (!SOURCE.test(file)) continue;
    const { name } = parse(file);
    for (const width of WIDTHS) {
      await sharp(join(source, file))
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: width <= 480 ? 72 : 78 })
        .toFile(join(dir, `${name}-${width}.webp`));
      count++;
    }
  }
  return count;
}
