import { useId } from "react";
import lockup from "@/assets/orbis-lockup.svg?raw";

/**
 * The owner's logo (15 Oct 2026): ORBIS with the globe inside the O and "The reading atlas."
 * under it, drawn in the current text colour, so it is black on the paper band and light on
 * the dark ones. Each copy gets its own clip id: a copy hidden on one screen (the footer, the
 * menu) must not take the globe's outline away from the one that shows.
 */
export function OrbisLockup({ className }: { className: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const html = lockup
    .replaceAll("orbis-disc", `orbis-disc-${id}`)
    .replace("<svg ", '<svg width="100%" height="100%" aria-hidden="true" ');
  return (
    <span
      role="img"
      aria-label="Orbis. The reading atlas."
      className={`block aspect-[3341/1332] ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
