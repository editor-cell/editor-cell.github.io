import { MEDIA } from "@/lib/breakpoints";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { ListenBar } from "@/components/listen-bar";
import { NotFoundPage } from "@/components/not-found";
import { langMeta } from "@/lib/i18n";
import { LANG_BOOT, langFromPath } from "@/lib/lang-path";
import { LOOK_BOOT } from "@/lib/look";
import { CHUNK_RECOVERY_BOOT } from "@/lib/chunk-recovery";
import { feedLink, pageMeta, SITE_DESCRIPTION, SITE_NAME, TRIAL } from "@/lib/site";
import appCss from "../styles.css?url";

// Only the families the stylesheet uses. Google serves Arabic in its own file, which a
// browser fetches only when Arabic text is on screen.
const FONTS =
  "https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400..900&family=Cormorant+Garamond:wght@600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&family=Noto+Naskh+Arabic:wght@500;600&display=swap";

const FONT_BOOT = `(function(){var l=document.createElement("link");l.rel="stylesheet";l.href=${JSON.stringify(FONTS)};document.head.appendChild(l)})();`;

export const Route = createRootRoute({
  // Site-wide defaults; a section or reading page replaces the title, description and
  // link-preview tags with its own.
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0c0c0c" },
      ...pageMeta({ title: SITE_NAME, description: SITE_DESCRIPTION, url: "/" }),
      // During the test period no page is listed by search engines (see TRIAL in site.ts).
      ...(TRIAL ? [{ name: "robots", content: "noindex, nofollow" }] : []),
    ],
    links: [
      // The icons are the Cormorant Garamond Bold O, cream on black. The tab icons set the O a
      // little larger than the home-screen ones so it stays clear at 16 to 32 px.
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/__grok/orbis-32.png?v=20261018-2",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "48x48",
        href: "/__grok/orbis-48.png?v=20261018-2",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        href: "/__grok/orbis-192.png?v=20261018-2",
      },
      { rel: "icon", type: "image/svg+xml", href: "/__grok/orbis-favicon.svg?v=20261018-2" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // The font stylesheet starts downloading at once but does not hold up the first paint
      // (FONT_BOOT below attaches it); until the faces arrive the page shows in Times.
      { rel: "preload", as: "style", href: FONTS },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/orbis.webmanifest?v=20261018-2" },
      { rel: "apple-touch-icon", href: "/__grok/orbis-180.png?v=20261018-2" },
    ],
  }),
  component: RootDocument,
  notFoundComponent: NotFoundPage,
});

function RootDocument() {
  // Reader pages are written in the language of their address, so the document says so
  // from the first byte. The panel sets its own language once it opens.
  const path = useRouterState({ select: (s) => s.location.pathname });
  const lang = path.startsWith("/panel") ? "en" : langFromPath(path);
  const meta = langMeta[lang];
  return (
    <html lang={meta.html} dir={meta.dir} suppressHydrationWarning>
      <head>
        <link {...feedLink(lang)} />
        <HeadContent />
        {/* Before the first paint: the reader's language (plain addresses only), the saved
            colour scheme, then the web fonts (without blocking
            the paint). */}
        <script
          dangerouslySetInnerHTML={{
            __html: CHUNK_RECOVERY_BOOT + LANG_BOOT + LOOK_BOOT + FONT_BOOT,
          }}
        />
        <noscript>
          <link rel="stylesheet" href={FONTS} />
        </noscript>
        <style
          dangerouslySetInnerHTML={{
            __html:
              ".border-t-\\[3px\\].border-ink{border-top-width:1px;margin-inline:-1.25rem;padding-inline:1.25rem}@media" + MEDIA.desktop + "{.border-t-\\[3px\\].border-ink{margin-inline:-2rem;padding-inline:2rem}}",
          }}
        />
      </head>
      <body>
        <Outlet />
        {/* Listening started from a card or a reading keeps playing from page to page. */}
        {path.startsWith("/panel") ? null : <ListenBar />}
        <Scripts />
      </body>
    </html>
  );
}
