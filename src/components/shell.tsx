import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { SiteMenu } from "@/components/menu";
import { OrbisLockup } from "@/components/orbis-lockup";
import { SearchBar } from "@/components/search-bar";
import { SearchMark } from "@/components/search-mark";
import { LEGAL_PAGES, legalCopy } from "@/lib/legal-copy";
import { searchCopy } from "@/lib/search";
import { aboutCopy } from "@/lib/about-copy";
import { useFrameCopy } from "@/lib/frame-copy";
import { langMeta, useCopy } from "@/lib/i18n";
import {
  aboutLink,
  homeLink,
  legalLink,
  rememberLang,
  searchLink,
  sectionLink,
  withLang,
} from "@/lib/lang-path";
import { useLibrary } from "@/lib/library";
import { useLook } from "@/lib/look";
import { THEMES, type Lang, type Theme } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

type Tools = {
  openMenu: () => void;
  menuOpen: boolean;
  toggleSearch: () => void;
  searchOpen: boolean;
  menuButton: React.RefObject<HTMLButtonElement | null>;
};

const ToolsContext = createContext<Tools | null>(null);

/** Search and menu flank the centred brand. Language, theme and membership live in the menu. */
export function FrameTools({ children }: { children: React.ReactNode }) {
  const tools = useContext(ToolsContext);
  const lang = useLang();
  const frame = useFrameCopy(lang);
  if (!tools) return null;
  return (
    <>
      <button
        ref={tools.menuButton}
        type="button"
        aria-expanded={tools.menuOpen}
        aria-controls="site-menu"
        aria-label={frame.menu}
        onClick={tools.openMenu}
        className="frame-menu inline-flex size-11 shrink-0 items-center justify-center text-ink/70 hover:text-ink"
      >
        <span className="flex w-[17px] flex-col gap-[5px]" aria-hidden="true">
          <span className="h-[1.5px] w-full bg-current" />
          <span className="h-[1.5px] w-full bg-current" />
          <span className="h-[1.5px] w-full bg-current" />
        </span>
      </button>
      {children}
      {/* Before hydration this remains a working link to the search page. */}
      <Link
        {...searchLink(lang)}
        aria-label={searchCopy(lang).title}
        aria-expanded={tools.searchOpen}
        title={searchCopy(lang).title}
        onClick={(event) => {
          event.preventDefault();
          tools.toggleSearch();
        }}
        className="frame-search inline-flex size-11 shrink-0 items-center justify-center text-ink/70 hover:text-ink"
      >
        <SearchMark className="size-[17px]" />
      </Link>
    </>
  );
}

/**
 * Site frame shared by every page: paper masthead, section bar and paper footer.
 * `section` marks the active section in the bar ("all" on the home page with no filter).
 */
export function Shell({
  children,
  section,
  layout,
}: {
  children: React.ReactNode;
  section?: Theme | "all";
  layout?: "video";
}) {
  const lang = useLang();
  const setPanelLang = useLibrary((s) => s.setLang);
  const navigate = useNavigate();
  const copy = useCopy(lang);
  const meta = langMeta[lang];
  const path = useRouterState({ select: (s) => s.location.pathname });
  const inPanel = path.startsWith("/panel");
  const bar = useRef<HTMLDivElement | null>(null);
  const menuButton = useRef<HTMLButtonElement | null>(null);
  const [look, setLook] = useLook();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // On a phone the section row scrolls sideways: bring the open section into view.
  useEffect(() => {
    const on = bar.current?.querySelector<HTMLElement>('[data-on="true"]');
    // "nearest" keeps the page itself still; works for right-to-left Arabic too.
    on?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [section, lang]);

  // The fade at the end of the section row goes away once the row is scrolled to its end.
  // In right-to-left Arabic scrollLeft runs negative, so its size is what counts.
  useEffect(() => {
    const row = bar.current;
    if (!row) return;
    const mark = () => {
      const end = Math.abs(row.scrollLeft) + row.clientWidth >= row.scrollWidth - 2;
      row.parentElement?.setAttribute("data-end", String(end));
      row.parentElement?.setAttribute("data-start", String(Math.abs(row.scrollLeft) <= 2));
    };
    mark();
    row.addEventListener("scroll", mark, { passive: true });
    window.addEventListener("resize", mark);
    return () => {
      row.removeEventListener("scroll", mark);
      window.removeEventListener("resize", mark);
    };
  }, [section, lang]);

  // A result opens another page: the bar closes behind it.
  useEffect(() => setSearchOpen(false), [path]);

  useEffect(() => {
    document.documentElement.lang = meta.html;
    document.documentElement.dir = meta.dir;
  }, [meta.html, meta.dir]);

  // Reader pages: the same page at the other language's address. The panel keeps its address.
  function setLang(code: Lang) {
    rememberLang(code);
    setPanelLang(code);
    if (!inPanel) void navigate({ href: withLang(code, path) });
  }

  // Section names in small capitals; the open one carries a short rule in the accent colour.
  const caps = lang === "ar" ? "text-[13px]" : "text-[11px] uppercase tracking-[0.1em]";
  const barItem = (on: boolean) =>
    `section-link inline-flex min-h-10 shrink-0 items-center border-b-2 ${caps} ${
      on ? "border-pine text-ink" : "border-transparent text-ink/75 hover:text-ink"
    }`;

  const tools: Tools = {
    openMenu: () => setMenuOpen(true),
    menuOpen,
    toggleSearch: () => setSearchOpen((open) => !open),
    searchOpen,
    menuButton,
  };

  const brand = (
    <Link
      {...homeLink(lang)}
      className="band-brand inline-flex min-w-0 shrink-0 items-center"
    >
      <OrbisLockup
        className="band-mark"
        mottoClassName="band-motto"
      />
    </Link>
  );

  return (
    <ToolsContext.Provider value={tools}>
      <div className={`flex min-h-dvh flex-col bg-paper text-ink ${section === "all" ? "orbis-home" : ""} ${layout === "video" ? "orbis-video" : ""}`}>
        {/* The name and tools share the page's paper, above a single accent rule. */}
        <header dir="ltr" className="no-print relative">
          <div
            className={`band-row ${inPanel ? "band-editor" : "band-reader"} flex items-center justify-between gap-x-3 border-b border-pine bg-paper px-5 pt-[0.35rem] pb-[0.45rem] text-ink md:px-8 ${
              searchOpen ? "relative z-40" : ""
            }`}
          >
            {/* The editor keeps its own navigation; reader controls flank the brand. */}
            {inPanel ? (
              <>
                {brand}
                <nav className="flex items-center gap-4 text-sm">
                  <Link {...homeLink(lang)} className="inline-flex min-h-11 items-center text-muted">
                    {copy.atlas}
                  </Link>
                  <Link to="/panel" className="inline-flex min-h-11 items-center text-ink">
                    {copy.panel}
                  </Link>
                </nav>
              </>
            ) : (
              <FrameTools>{brand}</FrameTools>
            )}
          </div>

          {searchOpen && !inPanel ? (
            <div dir={meta.dir} lang={meta.html}>
              <SearchBar onClose={() => setSearchOpen(false)} />
            </div>
          ) : null}

          {/* The test line under the masthead was taken off on 28 Oct 2026 (the owner):
              nobody pays and few come in yet. TRIAL still keeps search engines away. */}

          <nav
            aria-label={copy.sections}
            dir={meta.dir}
            lang={meta.html}
            data-start="true"
            className="section-bar relative min-w-0 border-b border-rule bg-paper"
          >
            <div
              ref={bar}
              className="bar-row no-scrollbar flex gap-5 overflow-x-auto px-5 whitespace-nowrap md:justify-between md:gap-7 md:px-8"
            >
              {/* Home first, then the sections; on a wide screen the row runs edge to edge. */}
              <Link
                {...homeLink(lang)}
                data-on={section === "all"}
                className={barItem(section === "all")}
              >
                {copy.home}
              </Link>
              {THEMES.map((theme) => (
                <Link
                  key={theme}
                  {...sectionLink(lang, theme)}
                  data-on={section === theme}
                  className={barItem(section === theme)}
                >
                  {copy.themes[theme]}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        {menuOpen ? (
          <SiteMenu
            lang={lang}
            section={section}
            path={path}
            look={look}
            onClose={() => {
              setMenuOpen(false);
              // Back to whichever menu button is on screen: the masthead's or the page's.
              const buttons = document.querySelectorAll<HTMLButtonElement>(
                'button[aria-controls="site-menu"]',
              );
              ([...buttons].find((b) => b.offsetParent !== null) ?? menuButton.current)?.focus();
            }}
            onLang={setLang}
            onLook={setLook}
            onSearch={() => {
              setMenuOpen(false);
              setSearchOpen(true);
            }}
          />
        ) : null}

        <div dir={meta.dir} lang={meta.html} className="flex flex-1 flex-col">
          {/* On a wide screen the reading surface stays centred within the full-width frame. */}
          <div className="page-width flex flex-1 flex-col">
            <div className="flex-1">{children}</div>

            <div
              aria-hidden="true"
              className="no-print flex items-center gap-3 px-5 pt-12 pb-10 md:px-8"
            >
              <span className="h-px flex-1 bg-rule" />
              <span className="size-1.5 rounded-full bg-ink" />
              <span className="h-px flex-1 bg-rule" />
            </div>
          </div>

          {/* The footer is the draft the owner approved (28 Oct 2026): the name and motto, and
              three links. Sections, languages, joining and the newsletter live in the menu. */}
          <footer className="site-footer no-print bg-paper py-10 text-ink">
            <div className="page-width flex flex-col items-center gap-6 px-5 text-center md:flex-row md:items-center md:justify-between md:px-8 md:text-start">
              <Link
                {...homeLink(lang)}
                dir="ltr"
                className="inline-flex min-h-11 items-center text-ink"
              >
                <OrbisLockup className="h-[1.78rem]" mottoClassName="mt-[0.7rem] text-[0.75rem]" />
              </Link>
              <nav aria-label={legalCopy(lang).footer}>
                <ul className="flex flex-wrap justify-center gap-x-6">
                  <li>
                    <Link
                      {...aboutLink(lang)}
                      className="inline-flex min-h-11 items-center text-base text-ink underline-offset-4 hover:underline"
                    >
                      {aboutCopy(lang).title}
                    </Link>
                  </li>
                  {LEGAL_PAGES.map((page) => (
                    <li key={page}>
                      <Link
                        {...legalLink(lang, page)}
                        className="inline-flex min-h-11 items-center text-base text-ink underline-offset-4 hover:underline"
                      >
                        {legalCopy(lang)[page].title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </footer>
        </div>
      </div>
    </ToolsContext.Provider>
  );
}

export function fieldClass() {
  return "w-full border border-line bg-sheet px-3 py-3 text-ink";
}
