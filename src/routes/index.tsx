import { createFileRoute, redirect } from "@tanstack/react-router";
import { HomePage } from "@/components/atlas";
import { homeHead } from "@/lib/site";
import { toTheme } from "@/lib/types";

/** The front page in English. The other languages' front pages are /tr, /ar, /fr, /es. */
export const Route = createFileRoute("/")({
  // Sections used to open as /?s=climate; old links now land on /climate-environment.
  beforeLoad: ({ search }) => {
    const s = (search as Record<string, unknown>).s;
    const theme = typeof s === "string" ? toTheme(s) : undefined;
    if (theme) throw redirect({ to: "/$section", params: { section: theme }, replace: true });
  },
  head: () => homeHead("en"),
  component: HomePage,
});
