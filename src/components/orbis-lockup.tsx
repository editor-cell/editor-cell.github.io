import lockup from "@/assets/orbis-lockup.svg?raw";

/**
 * The owner's logo (16 Oct 2026): ORBIS in thin Didone capitals with "The reading atlas." in
 * script under it, drawn in the current text colour, so it is cream on the black bands and
 * light on the dark one. The mark is one traced outline, so it needs no ids of its own and
 * any number of copies (header, footer, menu) can sit on a page.
 */
export function OrbisLockup({ className }: { className: string }) {
  const html = lockup.replace("<svg ", '<svg width="100%" height="100%" aria-hidden="true" ');
  return (
    <span
      role="img"
      aria-label="Orbis. The reading atlas."
      className={`block aspect-[913/348] ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
