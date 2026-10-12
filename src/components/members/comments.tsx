import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { NameForm, buttonClass } from "@/components/members/account";
import { fieldClass } from "@/components/shell";
import { accountLink, memberPageLink } from "@/lib/lang-path";
import { pagesCopy } from "@/lib/members/pages-copy";
import { membersOn } from "@/lib/members/config";
import { errorText, membersCopy } from "@/lib/members/copy";
import { isEditor, supabase, useMember } from "@/lib/members/session";
import { formatDate } from "@/lib/text";
import type { Lang } from "@/lib/types";

type Comment = {
  id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

const MAX = 2000;

/** The same small label a reading uses for "Related readings", which sits just above. */
function sectionHead(lang: Lang) {
  const label =
    lang === "ar" ? "text-sm text-pine" : "text-xs uppercase tracking-[0.14em] text-pine";
  return `border-b-[3px] border-ink pb-3 font-body font-normal ${label}`;
}

/**
 * Comments under a reading, in the language of the page. Anyone reads them; members write.
 * The database refuses links, blocked words and haste, and hides a comment that three
 * members report; the page only shows its answer.
 */
export function Comments({ storyId, lang }: { storyId: string; lang: Lang }) {
  const words = membersCopy(lang);
  const member = useMember();
  const here = useRouterState({ select: (s) => s.location.pathname });
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!membersOn) return;
    let live = true;
    setComments(null);
    void supabase()
      .then((client) =>
        client
          .from("comments")
          .select("id, user_id, author_name, body, created_at")
          .eq("story_id", storyId)
          .eq("lang", lang)
          .order("created_at", { ascending: true })
          .limit(300),
      )
      .then(({ data }) => {
        if (live) setComments((data as Comment[] | null) ?? []);
      })
      .catch(() => {
        if (live) setComments([]);
      });
    return () => {
      live = false;
    };
  }, [storyId, lang]);

  // Until sign-up is switched on, the section stands empty with the way to membership.
  if (!membersOn) {
    return (
      <section className="mt-10" aria-labelledby="comments">
        <h2 id="comments" className={sectionHead(lang)}>
          {words.comments}
        </h2>
        <p className="border-b border-line py-6 text-pretty text-muted">{words.noComments}</p>
        <Link
          {...memberPageLink(lang, "membership")}
          className="mt-5 inline-flex min-h-11 items-center text-sm text-pine underline underline-offset-4 hover:underline"
        >
          {pagesCopy(lang).joinToComment}
        </Link>
      </section>
    );
  }

  const userId = member.status === "in" ? member.user.id : null;
  const editor = isEditor(member);
  const named = member.status === "in" && (member.profile?.display_name ?? "").length >= 2;

  async function post(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (text.length < 2 || text.length > MAX) {
      setError(words.errors.length);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const client = await supabase();
      const { data, error } = await client
        .from("comments")
        .insert({ story_id: storyId, lang, body: text })
        .select("id, user_id, author_name, body, created_at")
        .single();
      if (error) throw error;
      setComments((list) => [...(list ?? []), data as Comment]);
      setBody("");
    } catch (err) {
      setError(errorText(err, lang));
    } finally {
      setBusy(false);
    }
  }

  async function report(id: string) {
    try {
      const client = await supabase();
      const { error } = await client.from("comment_reports").insert({ comment_id: id });
      if (error) throw error;
      setReported((set) => new Set(set).add(id));
    } catch (err) {
      setNotes((all) => ({ ...all, [id]: errorText(err, lang) }));
    }
  }

  async function remove(id: string) {
    if (!window.confirm(words.removeConfirm)) return;
    try {
      const client = await supabase();
      const { error } = await client.from("comments").delete().eq("id", id);
      if (error) throw error;
      setComments((list) => (list ?? []).filter((c) => c.id !== id));
    } catch (err) {
      setNotes((all) => ({ ...all, [id]: errorText(err, lang) }));
    }
  }

  return (
    <section className="mt-10" aria-labelledby="comments">
      <h2 id="comments" className={sectionHead(lang)}>
        {words.comments}
        {comments && comments.length ? (
          <span className="ms-3 text-xs tabular-nums tracking-normal text-muted normal-case">
            {comments.length}
          </span>
        ) : null}
      </h2>

      {comments === null ? (
        <p className="border-b border-line py-6 text-sm text-muted">{words.loading}</p>
      ) : comments.length === 0 ? (
        <p className="border-b border-line py-6 text-pretty text-muted">{words.noComments}</p>
      ) : (
        <ol>
          {comments.map((comment) => {
            const own = comment.user_id === userId;
            return (
              <li key={comment.id} className="border-b border-line py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="paper-title text-[1.05rem] font-bold leading-snug">
                    {comment.author_name}
                  </p>
                  <p className="text-xs tabular-nums text-muted">
                    {formatDate(comment.created_at.slice(0, 10), lang)}
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-line break-words leading-relaxed">
                  {comment.body}
                </p>
                {userId ? (
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 text-xs text-muted">
                    {!own ? (
                      reported.has(comment.id) ? (
                        <span>{words.reported}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void report(comment.id)}
                          className="inline-flex min-h-9 items-center hover:text-ink"
                        >
                          {words.report}
                        </button>
                      )
                    ) : null}
                    {own || editor ? (
                      <button
                        type="button"
                        onClick={() => void remove(comment.id)}
                        className="inline-flex min-h-9 items-center hover:text-ink"
                      >
                        {words.remove}
                      </button>
                    ) : null}
                    {notes[comment.id] ? <span role="status">{notes[comment.id]}</span> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-8">
        {member.status === "out" ? (
          <div className="flex flex-col gap-4 border-b border-line pb-6">
            <p className="text-pretty">{words.joinInvite}</p>
            <Link {...accountLink(lang, here, true)} className={`${buttonClass} self-start`}>
              {words.join}
            </Link>
            <p className="text-sm text-muted">
              {words.haveAccount}{" "}
              <Link
                {...accountLink(lang, here)}
                className="text-pine underline underline-offset-4 hover:underline"
              >
                {words.signIn}
              </Link>
            </p>
          </div>
        ) : member.status === "in" && !named ? (
          <div className="flex flex-col gap-3 border-t border-line pt-6">
            <p className="text-sm text-muted">{words.errors.nameRequired}</p>
            <NameForm lang={lang} userId={member.user.id} current="" />
          </div>
        ) : member.status === "in" ? (
          <form onSubmit={post} className="flex flex-col gap-3 border-t border-line pt-6">
            <label className="flex flex-col gap-2">
              <span
                className={
                  lang === "ar"
                    ? "text-sm text-pine"
                    : "text-xs uppercase tracking-[0.14em] text-pine"
                }
              >
                {words.yourComment}
              </span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={4}
                maxLength={MAX}
                className={`${fieldClass()} resize-y`}
              />
            </label>
            <div className="flex items-center justify-between gap-4">
              <button
                type="submit"
                disabled={busy || body.trim().length < 2}
                className={buttonClass}
              >
                {words.post}
              </button>
              <span className="text-xs tabular-nums text-muted">
                {body.length}/{MAX}
              </span>
            </div>
            {error ? (
              <p role="alert" className="text-sm text-pine">
                {error}
              </p>
            ) : null}
          </form>
        ) : null}
      </div>
    </section>
  );
}
