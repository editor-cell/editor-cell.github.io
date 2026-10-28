import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { HomePage, SectionPage } from "@/components/atlas";
import { DEFAULT_LANG, isPrefixed } from "@/lib/lang-path";
import { homeHead, sectionHead } from "@/lib/site";
import { toTheme, type Theme } from "@/lib/types";

/**
 * A one-part address is either a language's front page (/tr) or an
 * English section (/climate-environment, /economy-politics, …).
 */
export const Route = createFileRoute("/$section")({
  beforeLoad: ({ params }) => {
    const part = params.section;
    if (isPrefixed(part)) return;
    // English has no prefix.
    if (part === DEFAULT_LANG) throw redirect({ to: "/", replace: true });
    const theme = toTheme(part);
    // Neither: the site has no page here.
    if (!theme) throw notFound();
    // An old section name: to the section that replaced it.
    if (theme !== part) {
      throw redirect({ to: "/$section", params: { section: theme }, replace: true });
    }
  },
  head: ({ params }) => {
    const part = params.section;
    if (isPrefixed(part)) return homeHead(part);
    const theme = toTheme(part);
    return theme ? sectionHead(DEFAULT_LANG, theme) : {};
  },
  component: Page,
});

function Page() {
  const { section } = Route.useParams();
  if (isPrefixed(section)) return <HomePage />;
  return <SectionPage theme={toTheme(section) as Theme} />;
}
