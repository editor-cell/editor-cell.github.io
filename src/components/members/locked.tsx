import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { accountLink } from "@/lib/lang-path";
import { membersOn } from "@/lib/members/config";
import { membersCopy } from "@/lib/members/copy";
import { isPaid, supabase, useMember } from "@/lib/members/session";
import type { Lang } from "@/lib/types";

/**
 * Members-only readings: the public story file carries only the opening. For a paid member
 * the full text in this language is read from Supabase; for everyone else it stays null
 * and the page shows the opening with the lock note under it.
 */
export function useMemberText(
  storyId: string | undefined,
  lang: Lang,
  membersOnly: boolean,
): string | null {
  const member = useMember();
  const paid = member.status === "in" && isPaid(member.profile);
  const [text, setText] = useState<{ key: string; body: string } | null>(null);
  const key = `${storyId}/${lang}`;

  useEffect(() => {
    if (!membersOn || !membersOnly || !storyId || !paid) return;
    let live = true;
    void supabase()
      .then((client) =>
        client
          .from("member_texts")
          .select("body")
          .eq("story_id", storyId)
          .eq("lang", lang)
          .maybeSingle(),
      )
      .then(({ data }) => {
        const body = (data as { body?: string } | null)?.body?.trim();
        if (live && body) setText({ key, body });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [storyId, lang, membersOnly, paid, key]);

  return paid && text?.key === key ? text.body : null;
}

/** The address of the page on screen, for the way back after signing in. */
function useHere(): string {
  return useRouterState({ select: (s) => s.location.pathname });
}

/** Under the opening of a members-only reading, for anyone without a paid membership. */
export function LockNote({ lang }: { lang: Lang }) {
  const words = membersCopy(lang);
  const member = useMember();
  const here = useHere();
  return (
    <div className="flex flex-col gap-3 border-y border-line py-6">
      <p className="text-xs uppercase tracking-widest text-pine">{words.membersOnly}</p>
      <p>{words.lockNote}</p>
      {membersOn && member.status === "out" ? (
        <Link
          {...accountLink(lang, here)}
          className="inline-flex min-h-11 items-center self-start text-pine"
        >
          {words.lockSignIn}
        </Link>
      ) : null}
      {membersOn && member.status === "in" ? (
        <>
          <p className="text-sm text-muted">{words.paidSoon}</p>
          <Link
            {...accountLink(lang, here)}
            className="inline-flex min-h-11 items-center self-start text-pine"
          >
            {words.lockPaid}
          </Link>
        </>
      ) : null}
    </div>
  );
}
