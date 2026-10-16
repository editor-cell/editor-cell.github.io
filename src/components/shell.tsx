import { MEDIA } from "@/lib/breakpoints";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { SiteMenu } from "@/components/menu";
import { OrbisLockup } from "@/components/orbis-lockup";
import { Pick } from "@/components/pick";
import { SearchMark } from "@/components/search-mark";
import { membersOn } from "@/lib/members/config";
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
import { LOOKS, LOOK_SWATCH, useLook, type Look } from "@/lib/look";
import { LANGS, THEMES, type Lang, type Theme } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

function Swatch({ look }: { look: Look }) {
  const [panel, paper] = LOOK_SWATCH[look];
  return (
    <span
      aria-hidden="true"
      className="me-2.5 inline-block size-3.5 shrink-0 rounded-full border border-ink/30"
      style={{ background: `linear-gradient(135deg, ${panel} 50%, ${paper} 50%)` }}
    />
  );
}

function HeaderSwatch({ look, dark = false }: { look: Look; dark?: boolean }) {
  const [panel, paper] = LOOK_SWATCH[look];
  return (
    <span
      aria-hidden="true"
      className={`block size-[12px] rounded-full border transition-colors md:size-[15px] ${dark ? "border-paper/60 group-hover:border-paper group-aria-expanded:border-paper" : "border-ink/40 group-hover:border-ink group-aria-expanded:border-ink"}`}
      style={{ background: `linear-gradient(135deg, ${panel} 50%, ${paper} 50%)` }}
    />
  );
}

function Caret() {
  return (
    <svg
      viewBox="0 0 8 5"
      className="mb-px size-[7px] shrink-0 opacity-70 md:size-2 transition-transform duration-150 group-hover:opacity-100 group-aria-expanded:rotate-180 group-aria-expanded:opacity-100"
      aria-hidden="true"
    >
      <path d="M.75.75 4 4.25 7.25.75" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

type Tools = {
  openMenu: () => void;
  menuOpen: boolean;
  menuButton: React.RefObject<HTMLButtonElement | null>;
  look: Look;
  setLook: (look: Look) => void;
  lang: Lang;
  setLang: (lang: Lang) => void;
};

const ToolsContext = createContext<Tools | null>(null);

/**
 * Search, menu, colour scheme and language. The masthead carries the name alone, so they
 * sit small on the paper at the head of each page, beside the home sentence, a section's
 * name or a reading's way back (place "page"), at every width.
 */
/** A head and shoulders, drawn in the same thin line as the search mark. */
function PersonMark() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
      className="size-[15px] md:size-[18px]"
    >
      <circle cx="10" cy="6.5" r="3.5" />
      <path d="M3 18c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The tools at the end of the header row: search, language, colour scheme, account and
 * the menu, divided by hairlines as a printed masthead's index. On a phone search, the
 * colour scheme, the account and the menu stay; the language is chosen inside the menu.
 */
export function FrameTools() {
  const tools = useContext(ToolsContext);
  const lang = useLang();
  const copy = useCopy(lang);
  const frame = useFrameCopy(lang);
  if (!tools) return null;
  // The tools sit on the black band, light on dark like the name.
  const hover = "hover:text-paper";
  const divider = (
    <span aria-hidden="true" className="mx-1.5 hidden h-4 w-px bg-paper/25 md:block" />
  );
  return (
    <div dir="ltr" className="flex shrink-0 items-center text-paper/85">
      <Link
        {...searchLink(lang)}
        aria-label={searchCopy(lang).title}
        title={searchCopy(lang).title}
        className={`inline-flex h-11 w-9 shrink-0 items-center justify-center ${hover}`}
      >
        <SearchMark className="size-[17px] md:size-[18px]" />
      </Link>
      {divider}
      <div className="hidden md:block">
        <Pick
          tone="panel"
          align="end"
          label={copy.language}
          value={tools.lang}
          onChange={tools.setLang}
          options={LANGS.map((code) => ({
            value: code,
            label: langMeta[code].name,
            lang: langMeta[code].html,
          }))}
          buttonClassName={`group inline-flex h-11 items-center gap-1 px-2 text-[11px] tracking-[0.14em] ${hover}`}
        >
          <span>{langMeta[tools.lang].code}</span>
          <Caret />
        </Pick>
      </div>
      {divider}
      {/* The colour scheme stays on the band at every width, a phone included. */}
      <div>
        <Pick
          tone="panel"
          align="end"
          label={frame.look}
          value={tools.look}
          onChange={tools.setLook}
          options={LOOKS.map((code) => ({
            value: code,
            label: (
              <>
                <Swatch look={code} />
                {frame.looks[code]}
              </>
            ),
          }))}
          buttonClassName="group inline-flex h-11 w-9 items-center justify-center"
        >
          <HeaderSwatch look={tools.look} dark />
        </Pick>
      </div>
      {/* Account once sign-up is on; until then the membership options. On the band at
          every width, a phone included, so signing in is one tap from any page. */}
      <Link
        {...(membersOn ? accountLink(lang) : memberPageLink(lang, "membership"))}
        aria-label={membersOn ? membersCopy(lang).account : pagesCopy(lang).membership.title}
        title={membersOn ? membersCopy(lang).account : pagesCopy(lang).membership.title}
        className={`inline-flex h-11 w-9 shrink-0 items-center justify-center ${hover}`}
      >
        <PersonMark />
      </Link>
      <button
        ref={tools.menuButton}
        type="button"
        aria-expanded={tools.menuOpen}
        aria-controls="site-menu"
        aria-label={frame.menu}
        onClick={tools.openMenu}
        className={`inline-flex h-11 w-9 shrink-0 items-center justify-end ${hover}`}
      >
        <span className="flex w-[17px] flex-col gap-[5px]" aria-hidden="true">
          <span className="h-[1.5px] w-full bg-current" />
          <span className="h-[1.5px] w-full bg-current" />
          <span className="h-[1.5px] w-full bg-current" />
        </span>
      </button>
    </div>
  );
}


/**
 * Site frame shared by every page: header, section bar, footer (black, or burgundy in the second scheme).
 * `section` marks the active section in the bar ("all" on the home page with no filter).
 */
/**
 * A wrapped paragraph keeps the full width of its box even where its longest line ends
 * short of it, which left the footer's first gap wider than the second. On wide screens
 * the column is narrowed to its longest line of text, in whatever language is shown, so
 * both gaps between the three columns come out equal.
 */
function useFitToText(lang: string) {
  const column = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = column.current;
    if (!el) return;
    const wide = window.matchMedia(MEDIA.desktop);
    const fit = () => {
      el.style.width = "";
      if (!wide.matches) return;
      let start = Infinity;
      let end = -Infinity;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (!rect.width) continue;
          start = Math.min(start, rect.left);
          end = Math.max(end, rect.right);
        }
      }
      // The ORBIS mark sits before the first text; it counts towards the start.
      const first = el.firstElementChild?.getBoundingClientRect();
      if (first) start = Math.min(start, first.left);
      if (end > start) el.style.width = `${Math.ceil(end - start)}px`;
    };
    fit();
    void document.fonts?.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [lang]);
  return column;
}

export function Shell({
  children,
  section,
}: {
  children: React.ReactNode;
  section?: Theme | "all";
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
  const footerBrand = useFitToText(lang);

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
    menuButton,
    look,
    setLook,
    lang,
    setLang,
  };

  return (
    <ToolsContext.Provider value={tools}>
      <div className="flex min-h-dvh flex-col bg-paper text-ink">
        {/* The header: a black band with the name, the motto under it and the tools, and
          under the band the section strip on the paper, scrolling sideways when narrow. */}
        <header dir="ltr" className="no-print relative">
          {/* The black band carries the name, the motto and the tools, as the footer band does;
              the section strip runs under it on the paper. */}
          <div className="flex items-center justify-between gap-x-6 bg-panel px-5 text-paper md:px-8">
            <Link
              {...homeLink(lang)}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 py-2.5 md:gap-2.5 md:py-3"
            >
              <OrbisLockup className="h-[2.9rem] md:h-[4rem]" />
            </Link>

            <div>
              {/* The editing panel stays out of the reader's menu; open it at /panel. */}
              {inPanel ? (
                <nav className="flex items-center gap-4 text-sm">
                  <Link {...homeLink(lang)} className="inline-flex min-h-11 items-center text-mist">
                    {copy.atlas}
                  </Link>
                  <Link to="/panel" className="inline-flex min-h-11 items-center text-paper">
                    {copy.panel}
                  </Link>
                </nav>
              ) : (
                <FrameTools />
              )}
            </div>
          </div>

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
              className="no-scrollbar flex gap-5 overflow-x-auto px-5 whitespace-nowrap md:justify-between md:gap-7 md:px-8"
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
                <div ref={footerBrand} className="flex flex-col gap-3 md:max-w-sm">
                  <Link
                    {...homeLink(lang)}
                    dir="ltr"
                    className="inline-flex min-h-11 items-center gap-3 self-start text-paper"
                  >
                    <OrbisLockup className="h-[2.6rem]" />
                  </Link>
                  <ul className="flex flex-col">
                    <li>
                      <Link
                        {...aboutLink(lang)}
                        className="inline-flex min-h-9 items-center self-start text-base text-paper"
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
                            className="inline-flex min-h-9 items-center self-start text-base text-paper"
                          >
                            {membersCopy(lang).account}
                          </Link>
                        ) : (
                          <Link
                            {...memberPageLink(lang, item)}
                            className="inline-flex min-h-9 items-center self-start text-base text-paper"
                          >
                            {item === "membership" && !paymentOn
                              ? pagesCopy(lang).membership.menu
                              : pagesCopy(lang)[item].title}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="text-base text-mist">{copy.colophon}</p>
                  {/* No e-mail here: readers talk in the comments; the address stays only on
                      the legal pages, where the privacy law asks for it. */}
                </div>
                <div>
                  <p className="text-sm uppercase tracking-widest text-mist">{copy.sections}</p>
                  <ul className="mt-2 grid w-fit grid-cols-2 gap-x-6">
                    {THEMES.map((theme) => (
                      <li key={theme}>
                        <Link
                          {...sectionLink(lang, theme)}
                          className="inline-flex min-h-9 items-center text-base text-paper"
                        >
                          {copy.themes[theme]}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm uppercase tracking-widest text-mist">{frame.languages}</p>
                  <ul className="mt-2 flex flex-col">
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
