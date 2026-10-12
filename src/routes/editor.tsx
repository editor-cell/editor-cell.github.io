import { createFileRoute } from "@tanstack/react-router";
import { EditorPage } from "@/components/members/editor";
import { SITE_NAME } from "@/lib/site";

/** The editor's members panel: comments, members, members-only texts, blocked words. */
export const Route = createFileRoute("/editor")({
  head: () => ({
    meta: [
      { title: `Editör — ${SITE_NAME}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EditorPage,
});
