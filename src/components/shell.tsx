import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { SiteMenu } from "@/components/menu";
import { OrbisLockup } from "@/components/orbis-lockup";
import { SearchBar } from "@/components/search-bar";
import { SearchMark } from "@/components/search-mark";
import { TRIAL, trialNote } from "@/lib/site";
import { membersCopy } from "@/lib/members/copy";
import { useMember } from "@/lib/members/session";
import { paymentOn } from "@/lib/members/plans";
import { pagesCopy } from "@/lib/members/pages-copy";
import { LEGAL_PAGES, legalCopy } from "@/lib/legal-copy";
import { searchCopy } from "@/lib/search";
import { aboutCopy } from "@/lib/about-copy";
import { useFrameCopy } from "@/lib/frame-copy";
import { langMeta, useCopy } from "@/lib/i18n";
import {
  aboutLink,
  accountLink,
  homeLink,
  legalLink,
  memberPageLink,
  rememberLang,
  searchLink,
  sectionLink,
  withLang,
} from "@/lib/lang-path";
import { useLibrary } from "@/lib/library";
import { useLook } from "@/lib/look";
import { LANGS, THEMES, type Lang, type Theme } from "@/lib/types";
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
        className="frame-menu inline-flex size-11 shrink-0 items-center justify-center text-paper/85 hover:text-paper"
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
        className="frame-search inline-flex size-11 shrink-0 items-center justify-center text-paper/85 hover:text-paper"
      >
        <SearchMark className="size-[17px] md:size-[18px]" />
      </Link>
    </>
  );
}

/**
 * Site frame shared by every page: header, section bar, footer (black, or burgundy in the second scheme).
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
  const signedIn = useMember().status === "in";
  const setPanelLang = useLibrary((s) => s.setLang);
  const navigate = useNavigate();
  const copy = useCopy(lang);
  const frame = useFrameCopy(lang);
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
      className="band-brand inline-flex min-h-11 shrink-0 items-center gap-2 py-2.5 md:gap-2.5 md:py-3"
    >
      <OrbisLockup
        className="h-[1.95rem] md:h-[2.68rem]"
        mottoClassName="mt-[0.8rem] text-[0.8rem] md:mt-[1.05rem] md:text-[1.02rem]"
      />
    </Link>
  );

  return (
    <ToolsContext.Provider value={tools}>
      <div className={`flex min-h-dvh flex-col bg-paper text-ink ${section === "all" ? "orbis-home" : ""} ${layout === "video" ? "orbis-video" : ""}`}>
        {/* The header: a black band with the name, the motto under it and the tools, and
          under the band the section strip on the paper, scrolling sideways when narrow. */}
        <header dir="ltr" className="no-print relative">
          {/* The black band carries the name, the motto and the tools, as the footer band does;
              the section strip runs under it on the paper. */}
          <div
            className={`band-row ${inPanel ? "band-editor" : "band-reader"} flex items-center justify-between gap-x-6 bg-panel px-5 text-paper md:px-8 ${
              searchOpen ? "relative z-40" : ""
            }`}
          >
            {/* The editor keeps its own navigation; reader controls flank the brand. */}
            {inPanel ? (
              <>
                {brand}
                <nav className="flex items-center gap-4 text-sm">
                  <Link {...homeLink(lang)} className="inline-flex min-h-11 items-center text-mist">
                    {copy.atlas}
                  </Link>
                  <Link to="/panel" className="inline-flex min-h-11 items-center text-paper">
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

          {/* The test period: one quiet line on the paper, under the black band. */}
          {TRIAL && !inPanel ? (
            <p
              dir={meta.dir}
              lang={meta.html}
              className="border-b border-rule bg-shade px-5 py-1.5 text-center font-body text-[12px] leading-snug text-ink/75 md:px-8"
            >
              {trialNote(lang)}
            </p>
          ) : null}

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
          {/* On a wide screen the page keeps a newspaper's width in the middle; the black
            bands above and below still run edge to edge. */}
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

          <footer className="no-print bg-panel py-10 text-paper">
            <div className="page-width px-5 md:px-8">
              {/* Three columns spread to the edges: the language list ends at the right margin. */}
              <div className="grid gap-8 md:flex md:justify-between md:gap-12">
                <div className="footer-brand flex flex-col md:w-56">
                  <Link
                    {...homeLink(lang)}
                    dir="ltr"
                    className="inline-flex min-h-11 items-center gap-3 self-start text-paper"
                  >
                    <OrbisLockup className="h-[1.78rem]" mottoClassName="mt-[0.7rem] text-[0.75rem]" />
                  </Link>
                  <ul className="footer-brand-links flex flex-col">
                    <li>
                      <Link
                        {...aboutLink(lang)}
                        className="inline-flex min-h-9 items-center self-start text-base text-mist hover:text-paper"
                      >
                        {aboutCopy(lang).title}
                      </Link>
                    </li>
                    {(["membership", "newsletter"] as const).map((item) => (
                      <li key={item}>
                        {/* A signed-in member is past joining: the row leads to the account. */}
                        {item === "membership" && signedIn ? (
                          <Link
                            {...accountLink(lang)}
                            className="inline-flex min-h-9 items-center self-start text-base text-mist hover:text-paper"
                          >
                            {membersCopy(lang).account}
                          </Link>
                        ) : (
                          <Link
                            {...memberPageLink(lang, item)}
                            className="inline-flex min-h-9 items-center self-start text-base text-mist hover:text-paper"
                          >
                            {item === "membership" && !paymentOn
                              ? pagesCopy(lang).membership.menu
                              : pagesCopy(lang)[item].title}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                  {/* No e-mail here: readers talk in the comments; the address stays only on
                      the legal pages, where the privacy law asks for it. */}
                </div>
                <div>
                  <h2 className="footer-heading">{copy.sections}</h2>
                  <ul className="mt-4 grid w-fit grid-cols-2 gap-x-6">
                    {THEMES.map((theme) => (
                      <li key={theme}>
                        <Link
                          {...sectionLink(lang, theme)}
                          className="inline-flex min-h-9 items-center text-base text-mist hover:text-paper"
                        >
                          {copy.themes[theme]}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h2 className="footer-heading">{frame.languages}</h2>
                  <ul className="mt-4 flex flex-col">
                    {LANGS.map((code) => (
                      <li key={code}>
                        <button
                          type="button"
                          lang={langMeta[code].html}
                          onClick={() => {
                            setLang(code);
                            window.scrollTo({ top: 0 });
                          }}
                          className={
                            code === lang
                              ? "inline-flex min-h-9 items-center text-base text-paper underline underline-offset-4"
                              : "inline-flex min-h-9 items-center text-base text-mist hover:text-paper"
                          }
                        >
                          {langMeta[code].name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-10 flex flex-col gap-3 border-t border-muted pt-6 text-sm text-mist md:flex-row md:items-center md:justify-between">
                <p>
                  © {new Date().getFullYear()} Orbis. {frame.rights}
                </p>
                <nav aria-label={legalCopy(lang).footer}>
                  <ul className="flex flex-wrap gap-x-5">
                    {LEGAL_PAGES.map((page) => (
                      <li key={page}>
                        <Link
                          {...legalLink(lang, page)}
                          className="inline-flex min-h-9 items-center text-mist hover:text-paper"
                        >
                          {legalCopy(lang)[page].title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
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
