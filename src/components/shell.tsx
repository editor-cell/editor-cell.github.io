import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { SiteMenu } from "@/components/menu";
import { OrbisLockup } from "@/components/orbis-lockup";
import { SearchBar } from "@/components/search-bar";
import { SearchMark } from "@/components/search-mark";
import { aboutCopy } from "@/lib/about-copy";
import { useFrameCopy } from "@/lib/frame-copy";
import { langMeta, useCopy } from "@/lib/i18n";
import {
  aboutLink,
  accountLink,
  homeLink,
  legalLink,
  mediaLink,
  memberPageLink,
  rememberLang,
  searchLink,
  sectionLink,
  withLang,
} from "@/lib/lang-path";
import { LEGAL_PAGES, legalCopy } from "@/lib/legal-copy";
import { useLibrary } from "@/lib/library";
import { useLook } from "@/lib/look";
import { membersCopy } from "@/lib/members/copy";
import { pagesCopy } from "@/lib/members/pages-copy";
import { paymentOn } from "@/lib/members/plans";
import { useMember } from "@/lib/members/session";
import { searchCopy } from "@/lib/search";
import { LANGS, THEMES, type Lang, type Theme } from "@/lib/types";
import { useLang } from "@/lib/use-lang";
import { videoWords } from "@/lib/videos";

type Tools = {
  openMenu: () => void;
  menuOpen: boolean;
  toggleSearch: () => void;
  searchOpen: boolean;
  setLang: (lang: Lang) => void;
};

const ToolsContext = createContext<Tools | null>(null);

/** The reader's tools, for a page that draws its own masthead (the front page's cover). */
export function useFrameTools(): Tools | null {
  return useContext(ToolsContext);
}

/** Three short strokes: the menu. */
function MenuMark() {
  return (
    <svg viewBox="0 0 20 14" className="frame-mark" aria-hidden="true">
      <path d="M1 1.5h18M1 7h18M1 12.5h12" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

/**
 * The row of tools at the top of every page: the menu at the start, the other language
 * and search at the end. The name sits between them, except on the front page, where the
 * cover carries it large.
 */
export function FrameRow({ brand = true }: { brand?: boolean }) {
  const tools = useContext(ToolsContext);
  const lang = useLang();
  const frame = useFrameCopy(lang);
  const search = searchCopy(lang);
  if (!tools) return null;
  const others = LANGS.filter((code) => code !== lang);
  return (
    <div className="frame-row">
      <div className="frame-start">
        <button
          type="button"
          aria-expanded={tools.menuOpen}
          aria-controls="site-menu"
          onClick={tools.openMenu}
          className="frame-tool"
        >
          <MenuMark />
          <span>{frame.menu}</span>
        </button>
      </div>
      {brand ? (
        <Link {...homeLink(lang)} className="frame-brand" dir="ltr">
          <OrbisLockup className="frame-logo" />
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      <div className="frame-end">
        {others.map((code) => (
          <button
            key={code}
            type="button"
            lang={langMeta[code].html}
            onClick={() => tools.setLang(code)}
            className="frame-tool frame-lang"
          >
            {langMeta[code].name}
          </button>
        ))}
        {/* Before the page runs in the browser this is a plain link to the search page. */}
        <Link
          {...searchLink(lang)}
          aria-label={search.title}
          aria-expanded={tools.searchOpen}
          onClick={(event) => {
            event.preventDefault();
            tools.toggleSearch();
          }}
          className="frame-tool frame-search"
        >
          <SearchMark className="frame-mark" />
          <span className="frame-tool-word">{search.title}</span>
        </Link>
      </div>
    </div>
  );
}

/**
 * The frame every reader page shares: the cloth masthead, the page on white paper, and the
 * cloth footer. `section` names the section the page belongs to ("all" on the front page,
 * whose cover replaces the masthead's name with its own, large).
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
  const [look, setLook] = useLook();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const home = section === "all";

  // A result opens another page: the search closes behind it.
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

  const tools: Tools = {
    openMenu: () => setMenuOpen(true),
    menuOpen,
    toggleSearch: () => setSearchOpen((open) => !open),
    searchOpen,
    setLang,
  };

  return (
    <ToolsContext.Provider value={tools}>
      <div
        className={`flex min-h-dvh flex-col bg-paper text-ink ${home ? "orbis-home" : ""} ${layout === "video" ? "orbis-video" : ""}`}
      >
        <header dir="ltr" className="no-print relative">
          {inPanel ? (
            <div className="frame on-cloth">
              <div className="frame-row">
                <Link {...homeLink(lang)} className="frame-brand frame-brand-start">
                  <OrbisLockup className="frame-logo" />
                </Link>
                <span aria-hidden="true" />
                <nav className="frame-end">
                  <Link {...homeLink(lang)} className="frame-tool">
                    {copy.atlas}
                  </Link>
                  <Link to="/panel" className="frame-tool">
                    {copy.panel}
                  </Link>
                </nav>
              </div>
            </div>
          ) : home ? null : (
            // The front page's cover carries its own row of tools, on its cloth.
            <div className="frame on-cloth" dir={meta.dir}>
              <FrameRow />
            </div>
          )}

          {/* The search opens over the page under the masthead; nothing below moves. */}
          {searchOpen && !inPanel ? (
            <div dir={meta.dir} lang={meta.html} className="frame-search-layer">
              <SearchBar onClose={() => setSearchOpen(false)} />
            </div>
          ) : null}
        </header>

        {menuOpen ? (
          <SiteMenu
            lang={lang}
            section={section}
            path={path}
            look={look}
            onClose={() => {
              setMenuOpen(false);
              document.querySelector<HTMLButtonElement>('button[aria-controls="site-menu"]')?.focus();
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
          <div className="flex-1">{children}</div>
          <Footer lang={lang} onLang={setLang} />
        </div>
      </div>
    </ToolsContext.Provider>
  );
}

/** The back cover: the name, what Orbis is, where to go, and the small print. */
function Footer({ lang, onLang }: { lang: Lang; onLang: (lang: Lang) => void }) {
  const copy = useCopy(lang);
  const frame = useFrameCopy(lang);
  const signedIn = useMember().status === "in";
  return (
    <footer className="site-footer no-print on-cloth">
      <div className="footer-inner page-width gutter">
        <div className="footer-brand">
          <Link {...homeLink(lang)} dir="ltr" className="footer-name">
            <OrbisLockup className="footer-logo" mottoClassName="footer-motto" />
          </Link>
          <p className="footer-principle">{frame.principle}</p>
        </div>
        <nav aria-label={copy.sections} className="footer-col">
          <h2 className="footer-head">{copy.sections}</h2>
          <ul>
            {THEMES.map((theme) => (
              <li key={theme}>
                <Link {...sectionLink(lang, theme)} className="footer-link">
                  {copy.themes[theme]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={aboutCopy(lang).title} className="footer-col">
          <h2 className="footer-head">Orbis</h2>
          <ul>
            <li>
              <Link {...mediaLink(lang)} className="footer-link">
                {videoWords(lang).videos}
              </Link>
            </li>
            <li>
              <Link {...aboutLink(lang)} className="footer-link">
                {aboutCopy(lang).title}
              </Link>
            </li>
            <li>
              {signedIn ? (
                <Link {...accountLink(lang)} className="footer-link">
                  {membersCopy(lang).account}
                </Link>
              ) : (
                <Link {...memberPageLink(lang, "membership")} className="footer-link">
                  {paymentOn ? pagesCopy(lang).membership.title : pagesCopy(lang).membership.menu}
                </Link>
              )}
            </li>
            <li>
              <Link {...memberPageLink(lang, "newsletter")} className="footer-link">
                {pagesCopy(lang).newsletter.title}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="footer-col">
          <h2 className="footer-head">{frame.languages}</h2>
          <ul>
            {LANGS.map((code) => (
              <li key={code}>
                <button
                  type="button"
                  lang={langMeta[code].html}
                  aria-pressed={code === lang}
                  onClick={() => {
                    onLang(code);
                    window.scrollTo({ top: 0 });
                  }}
                  className="footer-link"
                >
                  {langMeta[code].name}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} Orbis. {frame.rights}
          </p>
          <nav aria-label={legalCopy(lang).footer}>
            <ul>
              {LEGAL_PAGES.map((page) => (
                <li key={page}>
                  <Link {...legalLink(lang, page)} className="footer-link">
                    {legalCopy(lang)[page].title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export function fieldClass() {
  return "w-full border border-mist bg-sheet px-3 py-3 text-ink";
}
