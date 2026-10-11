/** Pixel thresholds for reader CSS, Tailwind utilities, JS and image selection. */
export const BREAKPOINTS = {
  compact: 520,
  small: 640,
  desktop: 768,
  strip: 801,
  large: 1024,
  more: 1150,
  wide: 1280,
  extraWide: 1536,
} as const;

export const MEDIA = {
  phone: `(width < ${BREAKPOINTS.desktop}px)`,
  desktop: `(width >= ${BREAKPOINTS.desktop}px)`,
  compact: `(width <= ${BREAKPOINTS.compact}px)`,
  strip: `(width >= ${BREAKPOINTS.strip}px)`,
  large: `(width >= ${BREAKPOINTS.large}px)`,
  more: `(width >= ${BREAKPOINTS.more}px)`,
} as const;

export function imageSizes(desktop: string, phone: string, large?: string) {
  return `${large ? `${MEDIA.large} ${large}, ` : ""}${MEDIA.desktop} ${desktop}, ${phone}`;
}
