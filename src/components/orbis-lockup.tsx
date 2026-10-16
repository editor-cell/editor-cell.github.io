import lockup from "@/assets/orbis-lockup.svg?raw";

/**
 * The owner's logo (16 Oct 2026, evening): ORBİS in wide-set, high-contrast serif capitals
 * with the dotted İ, traced from his picture, no motto under it ("the other one was a timid
 * hand"). Drawn in the current text colour, so it is cream on the black bands and light on
 * the dark one. The mark is plain outlines, so it needs no ids of its own and any number of
 * copies (header, footer, menu) can sit on a page.
 */
export function OrbisLockup({
  className,
  mottoClassName,
}: {
  className: string;
  /** On the black bands the owner wants "The reading atlas." centred under the name
   * (16 Oct 2026, evening), in the readable slanted serif; the menu shows the name alone. */
  mottoClassName?: string;
}) {
  const html = lockup.replace("<svg ", '<svg width="100%" height="100%" aria-hidden="true" ');
  const mark = (
    <span
      role="img"
      aria-label="Orbis"
      className={`block aspect-[1516/380] ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
  if (!mottoClassName) return mark;
  return (
    <span className="inline-flex flex-col items-center">
      {mark}
      <span lang="en" className={`masthead-motto mt-1.5 leading-none whitespace-nowrap ${mottoClassName}`}>
        The reading atlas.
      </span>
    </span>
  );
}
