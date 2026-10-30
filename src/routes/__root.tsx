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
import { BAR, LOOK_BOOT, MAIN_LOOK } from "@/lib/look";
import { CHUNK_RECOVERY_BOOT } from "@/lib/chunk-recovery";
import { feedLink, pageMeta, SITE_DESCRIPTION, SITE_NAME, TRIAL } from "@/lib/site";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  // Site-wide defaults; a section or reading page replaces the title, description and
  // link-preview tags with its own.
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: BAR[MAIN_LOOK] },
      ...pageMeta({ title: SITE_NAME, description: SITE_DESCRIPTION, url: "/" }),
      // During the test period no page is listed by search engines (see TRIAL in site.ts).
      ...(TRIAL ? [{ name: "robots", content: "noindex, nofollow" }] : []),
    ],
    links: [
      // The Bodoni O stays clear in tabs; home-screen icons leave more breathing room.
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/images/icons/orbis-32.png?v=20261030-cloth",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "48x48",
        href: "/images/icons/orbis-48.png?v=20261030-cloth",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        href: "/images/icons/orbis-192.png?v=20261030-cloth",
      },
      { rel: "icon", type: "image/svg+xml", sizes: "any", href: "/images/icons/ora.svg?v=20261030-cloth" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/orbis.webmanifest?v=20261030-cloth" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/images/icons/orbis-180.png?v=20261030-cloth" },
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
        {/* Before the first paint: the reader's language (plain addresses only) and the
            saved colour scheme. The faces are the site's own files, named in the stylesheet. */}
        <script
          dangerouslySetInnerHTML={{
            __html: CHUNK_RECOVERY_BOOT + LANG_BOOT + LOOK_BOOT,
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
