import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { langMeta, useCopy } from "@/lib/i18n";
import { homeLink } from "@/lib/lang-path";
import type { Lang } from "@/lib/types";

const crumb = "inline-flex min-h-8 shrink-0 items-center hover:text-ink";

/** Where a page sits, set like the trail above a reading: Home › (a parent page ›) title. */
export function Trail({
  lang,
  here,
  parent,
  className = "",
}: {
  lang: Lang;
  here: string;
  className?: string;
  /** A page between Home and this one, as a link (Membership above Payment). */
  parent?: (className: string) => ReactNode;
}) {
  const copy = useCopy(lang);
  const mark = langMeta[lang].dir === "rtl" ? "‹" : "›";
  return (
    <nav
      aria-label={copy.trail}
      className={`no-print flex w-full min-w-0 items-center gap-2 text-xs text-muted ${className}`}
    >
      <Link {...homeLink(lang)} className={crumb}>
        {copy.home}
      </Link>
      <span aria-hidden="true">{mark}</span>
      {parent ? (
        <>
          {parent(crumb)}
          <span aria-hidden="true">{mark}</span>
        </>
      ) : null}
      <span className="min-w-0 truncate">{here}</span>
    </nav>
  );
}
