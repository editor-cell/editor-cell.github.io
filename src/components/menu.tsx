import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { OrbisLockup } from "@/components/orbis-lockup";
import { aboutCopy } from "@/lib/about-copy";
import { useFrameCopy } from "@/lib/frame-copy";
import { langMeta, useCopy } from "@/lib/i18n";
import {
  aboutLink,
  accountLink,
  homeLink,
  mediaLink,
  memberPageLink,
  searchLink,
  sectionLink,
  stripLang,
} from "@/lib/lang-path";
import { LOOKS, type Look } from "@/lib/look";
import { membersCopy } from "@/lib/members/copy";
import { pagesCopy } from "@/lib/members/pages-copy";
import { paymentOn } from "@/lib/members/plans";
import { useMember } from "@/lib/members/session";
import { searchCopy } from "@/lib/search";
import { LANGS, THEMES, type Lang, type Theme } from "@/lib/types";
import { videoWords } from "@/lib/videos";

/**
 * The menu: a sheet of the cover's cloth sliding in from the start edge. The sections come
 * first, large, as the parts of the atlas; then the other pages, the language and the
 * scheme. Everything is in view at once; nothing folds. Closes from the cross, a tap
 * outside, Escape, or any link.
 */
export function SiteMenu({
  lang,
  section,
  path,
  look,
  onClose,
  onLang,
  onLook,
  onSearch,
}: {
  lang: Lang;
  section?: Theme | "all";
  path: string;
  look: Look;
  onClose: () => void;
  onLang: (lang: Lang) => void;
  onLook: (look: Look) => void;
  /** Opens the search under the masthead in place of the search page. */
  onSearch: () => void;
}) {
  const copy = useCopy(lang);
  const frame = useFrameCopy(lang);
  const meta = langMeta[lang];
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const here = stripLang(path);
  const signedIn = useMember().status === "in";

  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = before;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const current = (on: boolean) => (on ? ("page" as const) : undefined);

  return (
    <div className="menu-layer">
      <button type="button" aria-label={frame.close} className="menu-scrim" onClick={onClose} />
      <div
        id="site-menu"
        role="dialog"
        aria-modal="true"
        aria-label={frame.menu}
        dir={meta.dir}
        lang={meta.html}
        className="menu-sheet on-cloth"
      >
        <div className="menu-top">
          <Link {...homeLink(lang)} onClick={onClose} dir="ltr" className="menu-brand">
            <OrbisLockup className="menu-logo" />
          </Link>
          <button
            ref={closeRef}
            type="button"
            aria-label={frame.close}
            onClick={onClose}
            className="menu-close"
          >
            <X className="size-5" strokeWidth={1.3} aria-hidden="true" />
          </button>
        </div>

        <nav aria-label={copy.menuSections} className="menu-block">
          <ul className="menu-sections">
            <li>
              <Link
                {...homeLink(lang)}
                aria-current={current(section === "all")}
                onClick={onClose}
                className="menu-section"
              >
                {copy.home}
              </Link>
            </li>
            {THEMES.map((theme) => (
              <li key={theme}>
                <Link
                  {...sectionLink(lang, theme)}
                  aria-current={current(section === theme)}
                  onClick={onClose}
                  className="menu-section"
                >
                  {copy.themes[theme]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={aboutCopy(lang).title} className="menu-block">
          <ul className="menu-pages">
            <li>
              <Link {...mediaLink(lang)} aria-current={current(here.startsWith("/media"))} onClick={onClose} className="menu-page">
                {videoWords(lang).videos}
              </Link>
            </li>
            <li>
              <Link
                {...searchLink(lang)}
                onClick={(event) => {
                  event.preventDefault();
                  onSearch();
                }}
                className="menu-page"
              >
                {searchCopy(lang).title}
              </Link>
            </li>
            <li>
              {signedIn ? (
                <Link {...accountLink(lang)} aria-current={current(here === "/account")} onClick={onClose} className="menu-page">
                  {membersCopy(lang).account}
                </Link>
              ) : (
                <Link
                  {...memberPageLink(lang, "membership")}
                  aria-current={current(here === "/membership")}
                  onClick={onClose}
                  className="menu-page"
                >
                  {paymentOn ? pagesCopy(lang).membership.title : pagesCopy(lang).membership.menu}
                </Link>
              )}
            </li>
            <li>
              <Link
                {...memberPageLink(lang, "newsletter")}
                aria-current={current(here === "/newsletter")}
                onClick={onClose}
                className="menu-page"
              >
                {pagesCopy(lang).newsletter.title}
              </Link>
            </li>
            <li>
              <Link {...aboutLink(lang)} aria-current={current(here === "/about")} onClick={onClose} className="menu-page">
                {aboutCopy(lang).title}
              </Link>
            </li>
          </ul>
        </nav>

        <div className="menu-block menu-choices">
          <div className="menu-choice">
            <p className="menu-label">{frame.languages}</p>
            <div className="menu-options">
              {LANGS.map((code) => (
                <button
                  key={code}
                  type="button"
                  lang={langMeta[code].html}
                  aria-pressed={code === lang}
                  onClick={() => {
                    onLang(code);
                    onClose();
                  }}
                  className="menu-option"
                >
                  {langMeta[code].name}
                </button>
              ))}
            </div>
          </div>
          <div className="menu-choice">
            <p className="menu-label">{frame.look}</p>
            <div className="menu-options">
              {LOOKS.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={code === look}
                  onClick={() => onLook(code)}
                  className="menu-option"
                >
                  {frame.looks[code]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
