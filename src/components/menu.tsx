import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { aboutCopy } from "@/lib/about-copy";
import { useFrameCopy } from "@/lib/frame-copy";
import { langMeta, useCopy } from "@/lib/i18n";
import {
  aboutLink,
  homeLink,
  memberPageLink,
  searchLink,
  sectionLink,
  stripLang,
} from "@/lib/lang-path";
import { paymentOn } from "@/lib/members/plans";
import { pagesCopy } from "@/lib/members/pages-copy";
import { searchCopy } from "@/lib/search";
import { LOOKS, LOOK_SWATCH, type Look } from "@/lib/look";
import { LANGS, THEMES, type Lang, type Theme } from "@/lib/types";

/** Pages under the three lists. Contact is added here later; nothing else has to move. */
const MENU_PAGES = ["search", "membership", "newsletter", "about"] as const;

/** The three lists of the menu. Only one is open at a time. */
type Group = "sections" | "languages" | "look";

/**
 * The menu opens with the lists as the reader last left them: a list closed by hand stays
 * closed the next time the menu is opened. Kept for the visit and in the browser; the
 * first time, Sections is open.
 */
const OPEN_KEY = "orbis-menu-open";
let lastOpen: Group | null | undefined;

function readOpen(): Group | null {
  if (lastOpen !== undefined) return lastOpen;
  try {
    const stored = window.localStorage.getItem(OPEN_KEY);
    if (stored === "none") return null;
    if (stored === "sections" || stored === "languages" || stored === "look") return stored;
  } catch {
    // Storage blocked: fall back to the first-time default.
  }
  return "sections";
}

function saveOpen(group: Group | null) {
  lastOpen = group;
  try {
    window.localStorage.setItem(OPEN_KEY, group ?? "none");
  } catch {
    // Storage blocked: the choice still holds for this visit.
  }
}

function Swatch({ look }: { look: Look }) {
  const [panel, paper] = LOOK_SWATCH[look];
  return (
    <span
      aria-hidden="true"
      className="me-3 inline-block size-4 shrink-0 rounded-full border border-ink"
      style={{ background: `linear-gradient(135deg, ${panel} 50%, ${paper} 50%)` }}
    />
  );
}

/**
 * One list of the menu: a bold heading that shows the current choice on the
 * other side, and under it, when open, a framed box with the choices.
 */
function MenuGroup({
  title,
  current,
  open,
  onToggle,
  children,
}: {
  title: string;
  current?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const boxId = useId();
  return (
    <div className="border-b border-mist">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={boxId}
        onClick={onToggle}
        className="flex min-h-13 w-full items-center justify-between gap-3 px-5 text-start"
      >
        <span className="text-[17px] font-bold text-ink">{title}</span>
        <span className="flex items-center gap-2.5">
          {current ? <span className="text-[15px] text-muted">{current}</span> : null}
          <ChevronDown
            aria-hidden="true"
            strokeWidth={1.5}
            className={`size-4 shrink-0 text-ink transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open ? (
        <ul id={boxId} className="mx-5 mb-4 mt-1 flex flex-col border border-mist bg-sheet">
          {children}
        </ul>
      ) : null}
    </div>
  );
}

/** Row style inside a list box; the chosen one is black and bold, with a tick. */
function rowClass(on: boolean, first: boolean) {
  return [
    "flex min-h-11 w-full items-center justify-between gap-3 px-4 text-start text-[17px]",
    first ? "" : "border-t border-line",
    on ? "font-bold text-ink" : "text-muted hover:text-ink",
  ].join(" ");
}

function Tick({ on }: { on: boolean }) {
  return on ? (
    <Check aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-ink" />
  ) : null;
}

/**
 * The site menu. Opens over the page; the page behind it does not scroll.
 * Closes from the cross, a tap outside, or a link.
 */
export function SiteMenu({
  lang,
  section,
  path,
  look,
  onClose,
  onLang,
  onLook,
}: {
  lang: Lang;
  section?: Theme | "all";
  path: string;
  look: Look;
  onClose: () => void;
  onLang: (lang: Lang) => void;
  onLook: (look: Look) => void;
}) {
  const copy = useCopy(lang);
  const frame = useFrameCopy(lang);
  const meta = langMeta[lang];
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onAbout = stripLang(path) === "/about";
  const onSearch = stripLang(path) === "/search";
  const here = stripLang(path);
  const [openGroup, setOpenGroup] = useState<Group | null>(readOpen);
  const toggle = (group: Group) => {
    const next = openGroup === group ? null : group;
    saveOpen(next);
    setOpenGroup(next);
  };
  const currentSection = section === "all" ? copy.home : section ? copy.themes[section] : undefined;
  const page = (on: boolean) =>
    on
      ? "inline-flex min-h-12 items-center gap-3 text-[17px] font-bold text-ink underline underline-offset-4"
      : "inline-flex min-h-12 items-center gap-3 text-[17px] font-bold text-muted hover:text-ink";

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const prevBody = body.style.overflow;
    const prevHtml = html.style.overflow;
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label={frame.close}
        className="menu-scrim absolute inset-0 bg-ink/40"
        onClick={onClose}
      />
      <div
        id="site-menu"
        role="dialog"
        aria-modal="true"
        aria-label={frame.menu}
        dir={meta.dir}
        lang={meta.html}
        className="absolute inset-y-0 start-0 flex w-full max-w-sm flex-col bg-paper text-ink shadow-lg"
      >
        <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-5">
          <span dir="ltr" className="masthead-name text-[2rem] leading-none">
            ORBIS
          </span>
          <button
            ref={closeRef}
            type="button"
            aria-label={frame.close}
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center"
          >
            <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <nav aria-label={copy.menuSections}>
            <MenuGroup
              title={copy.sections}
              current={currentSection}
              open={openGroup === "sections"}
              onToggle={() => toggle("sections")}
            >
              <li>
                <Link
                  {...homeLink(lang)}
                  aria-current={section === "all" ? "page" : undefined}
                  className={rowClass(section === "all", true)}
                  onClick={onClose}
                >
                  {copy.home}
                  <Tick on={section === "all"} />
                </Link>
              </li>
              {THEMES.map((theme) => (
                <li key={theme}>
                  <Link
                    {...sectionLink(lang, theme)}
                    aria-current={section === theme ? "page" : undefined}
                    className={rowClass(section === theme, false)}
                    onClick={onClose}
                  >
                    {copy.themes[theme]}
                    <Tick on={section === theme} />
                  </Link>
                </li>
              ))}
            </MenuGroup>
          </nav>

          <MenuGroup
            title={frame.languages}
            current={meta.name}
            open={openGroup === "languages"}
            onToggle={() => toggle("languages")}
          >
            {LANGS.map((code, i) => (
              <li key={code}>
                <button
                  type="button"
                  lang={langMeta[code].html}
                  aria-pressed={code === lang}
                  onClick={() => {
                    onLang(code);
                    onClose();
                  }}
                  className={rowClass(code === lang, i === 0)}
                >
                  {langMeta[code].name}
                  <Tick on={code === lang} />
                </button>
              </li>
            ))}
          </MenuGroup>

          <MenuGroup
            title={frame.look}
            current={frame.looks[look]}
            open={openGroup === "look"}
            onToggle={() => toggle("look")}
          >
            {LOOKS.map((code, i) => (
              <li key={code}>
                <button
                  type="button"
                  aria-pressed={code === look}
                  onClick={() => onLook(code)}
                  className={rowClass(code === look, i === 0)}
                >
                  <span className="flex items-center">
                    <Swatch look={code} />
                    {frame.looks[code]}
                  </span>
                  <Tick on={code === look} />
                </button>
              </li>
            ))}
          </MenuGroup>

          <nav aria-label={aboutCopy(lang).title} className="px-5 pb-6 pt-4">
            <ul className="flex flex-col">
              {MENU_PAGES.map((item) =>
                item === "search" ? (
                  <li key={item}>
                    <Link {...searchLink(lang)} className={page(onSearch)} onClick={onClose}>
                      {searchCopy(lang).title}
                      <Search aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />
                    </Link>
                  </li>
                ) : item === "membership" || item === "newsletter" ? (
                  <li key={item}>
                    <Link
                      {...memberPageLink(lang, item)}
                      className={page(here === `/${item}`)}
                      onClick={onClose}
                    >
                      {item === "membership" && !paymentOn
                        ? pagesCopy(lang).membership.menu
                        : pagesCopy(lang)[item].title}
                    </Link>
                  </li>
                ) : item === "about" ? (
                  <li key={item}>
                    <Link {...aboutLink(lang)} className={page(onAbout)} onClick={onClose}>
                      {aboutCopy(lang).title}
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
