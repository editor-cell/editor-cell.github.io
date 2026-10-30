import lockup from "@/assets/orbis-lockup.svg?raw";

/**
 * The owner's logo (16 Oct 2026, evening): ORBIS in wide-set, high-contrast serif capitals,
 * traced from his picture. The picture had a Turkish dotted İ; the dot was taken off, since
 * the site's name is English. Drawn in the current text colour: cream on the cloth. The mark is plain outlines, so it needs no ids of its own
 * and any number of copies (header, footer, menu) can sit on a page.
 */
export function OrbisLockup({
  className,
  mottoClassName,
}: {
  className: string;
  /** "the reading atlas" centred under the name, in the text's italic (frame.css,
   * .masthead-motto); the masthead row and the menu show the name alone. */
  mottoClassName?: string;
}) {
  const html = lockup.replace("<svg ", '<svg width="100%" height="100%" aria-hidden="true" ');
  const mark = (
    <span
      role="img"
      aria-label="Orbis"
      className={`block aspect-[1516/308] ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
  if (!mottoClassName) return mark;
  return (
    <span className="inline-flex flex-col items-center">
      {mark}
      <span lang="en" className={`masthead-motto leading-none whitespace-nowrap ${mottoClassName}`}>
        the reading atlas
      </span>
    </span>
  );
}
