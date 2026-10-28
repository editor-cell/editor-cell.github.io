import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { SectionPage } from "@/components/atlas";
import { DEFAULT_LANG, isPrefixed } from "@/lib/lang-path";
import { sectionHead } from "@/lib/site";
import { toTheme, type Theme } from "@/lib/types";

/** A section in Turkish: /tr/climate-environment, /tr/economy-politics, … */
export const Route = createFileRoute("/$lang/$section")({
  beforeLoad: ({ params }) => {
    const theme = toTheme(params.section);
    if (params.lang === DEFAULT_LANG && theme) {
      throw redirect({ to: "/$section", params: { section: theme }, replace: true });
    }
    if (!isPrefixed(params.lang) || !theme) throw notFound();
    if (theme !== params.section) {
      throw redirect({
        to: "/$lang/$section",
        params: { lang: params.lang, section: theme },
        replace: true,
      });
    }
  },
  head: ({ params }) => {
    const theme = toTheme(params.section);
    return isPrefixed(params.lang) && theme ? sectionHead(params.lang, theme) : {};
  },
  component: Page,
});

function Page() {
  const { section } = Route.useParams();
  return <SectionPage theme={toTheme(section) as Theme} />;
}
