import { createFileRoute, redirect } from "@tanstack/react-router";
import { AccountPage } from "@/components/members/account";
import { DEFAULT_LANG, isPrefixed } from "@/lib/lang-path";
import { membersCopy } from "@/lib/members/copy";
import { SITE_NAME } from "@/lib/site";

/** The member's account in Turkish, Arabic, French or Spanish: /tr/account, … */
export const Route = createFileRoute("/$lang/account")({
  validateSearch: (search: Record<string, unknown>): { back?: string; join?: true } => ({
    ...(typeof search.back === "string" ? { back: search.back } : {}),
    ...(search.join === true || search.join === "true" || search.join === 1 || search.join === "1"
      ? { join: true as const }
      : {}),
  }),
  beforeLoad: ({ params, search }) => {
    if (params.lang === DEFAULT_LANG) throw redirect({ to: "/account", search, replace: true });
    if (!isPrefixed(params.lang)) throw redirect({ to: "/", replace: true });
  },
  head: ({ params }) => ({
    meta: [
      {
        title: `${membersCopy(isPrefixed(params.lang) ? params.lang : DEFAULT_LANG).account} — ${SITE_NAME}`,
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccountPage,
});
