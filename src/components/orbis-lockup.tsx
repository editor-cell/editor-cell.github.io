import lockup from "@/assets/orbis-lockup.svg?raw";

/**
 * The owner's logo (16 Oct 2026, evening): ORBİS in wide-set, high-contrast serif capitals
 * with the dotted İ, traced from his picture, no motto under it ("the other one was a timid
 * hand"). Drawn in the current text colour, so it is cream on the black bands and light on
 * the dark one. The mark is plain outlines, so it needs no ids of its own and any number of
 * copies (header, footer, menu) can sit on a page.
 */
export function OrbisLockup({ className }: { className: string }) {
  const html = lockup.replace("<svg ", '<svg width="100%" height="100%" aria-hidden="true" ');
  return (
    <span
      role="img"
      aria-label="Orbis"
      className={`block aspect-[1516/380] ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
