import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReadTime } from "@/components/read-time";
import { SearchMark } from "@/components/search-mark";
import { Shell } from "@/components/shell";
import { useCopy } from "@/lib/i18n";
import { readLink, videoLink } from "@/lib/lang-path";
import { loadSearchIndexes, searchAll, searchCopy, type SearchIndexes } from "@/lib/search";
import { LANGS } from "@/lib/types";
import { CARDS } from "@/lib/seed";
import { formatDate, storyTitle } from "@/lib/text";
import { useLang } from "@/lib/use-lang";
import { VIDEOS, formatDuration, videoWords } from "@/lib/videos";

/** The query in the address (?q=…), so a search can be shared and survives a reload. */
function queryFromAddress(search: string): string {
  try {
    return new URLSearchParams(search).get("q") ?? "";
  } catch {
    return "";
  }
}

/**
 * The search page: one large field on a rule, then the matching readings as a plain
 * list — title, the reading's one-sentence summary, section and date, and the reading
 * time on its own line under the date, as on the cards. Results follow the typing.
 */
export function SearchPage() {
  const lang = useLang();
  const copy = useCopy(lang);
  const words = searchCopy(lang);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const input = useRef<HTMLInputElement | null>(null);
  // The page is written out without a query; the query is read once the page is open,
  // so the written page and the open page start out the same.
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [indexes, setIndexes] = useState<SearchIndexes | null>(null);
  const [failed, setFailed] = useState(false);
  const [requestAttempt, setRequestAttempt] = useState(0);
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    const q = queryFromAddress(window.location.search);
    setQuery(q);
    setReady(true);
    if (!q) input.current?.focus();
  }, []);

  // The address follows the field, without filling the back button with every letter.
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      const q = query.trim();
      if (q === queryFromAddress(window.location.search).trim()) return;
      void navigate({ href: q ? `${path}?q=${encodeURIComponent(q)}` : path, replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [query, ready, path, navigate]);

  // On the first nonempty query, download the texts of every site language: a word is
  // found whichever language it is typed in. Cancelling the request keeps an unmounted
  // page from setting state.
  useEffect(() => {
    if (!ready || !hasQuery || indexes) return;
    const controller = new AbortController();
    setFailed(false);
    void loadSearchIndexes(LANGS, import.meta.env.BASE_URL, controller.signal)
      .then((loaded) => {
        if (!controller.signal.aborted) setIndexes(loaded);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [ready, hasQuery, indexes, requestAttempt]);

  const results = useMemo(
    () => (indexes ? searchAll(CARDS, VIDEOS, lang, query, indexes) : []),
    [lang, query, indexes],
  );
  const searching = ready && hasQuery && indexes !== null;
  const pending = ready && hasQuery && !indexes && !failed;

  return (
    <Shell>
      <main>
        <div className="flex items-start justify-between gap-4 px-5 py-3.5 md:px-8 md:py-5">
          <h1 className="min-w-0 text-2xl leading-tight md:text-3xl">{words.title}</h1>
        </div>

        <div className="border-t border-rule px-5 pt-7 pb-6 md:px-8 md:pt-10 md:pb-8">
          <form
            role="search"
            className="group flex items-center gap-3 border-b border-rule pb-2.5 focus-within:border-ink"
            onSubmit={(event) => {
              event.preventDefault();
              if (failed) setRequestAttempt((attempt) => attempt + 1);
              const q = query.trim();
              input.current?.blur();
              void navigate({
                href: q ? `${path}?q=${encodeURIComponent(q)}` : path,
                replace: true,
              });
            }}
          >
            <input
              ref={input}
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={words.placeholder}
              aria-label={words.label}
              autoComplete="off"
              enterKeyHint="search"
              className="search-field min-w-0 flex-1 bg-transparent py-1 text-2xl leading-tight text-ink placeholder:text-muted/75 focus:outline-none md:text-[2rem]"
            />
            <button
              type="submit"
              aria-label={words.submit}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-ink"
            >
              <SearchMark className="size-5" />
            </button>
          </form>
          {searching && results.length > 0 ? (
            <p
              aria-live="polite"
              className={
                lang === "ar"
                  ? "mt-3.5 text-xs text-muted tabular-nums"
                  : "mt-3.5 text-xs uppercase tracking-widest text-muted tabular-nums"
              }
            >
              {words.count(results.length)}
            </p>
          ) : null}
        </div>

        {searching && results.length > 0 ? (
          <ol className="px-5 md:px-8">
            {results.map((found) => {
              if (found.kind === "video") {
                const { video } = found;
                const local = video.locales[lang];
                const length = formatDuration(video.duration);
                return (
                  <li key={`video-${video.id}`} className="border-b border-line last:border-b-0">
                    <Link {...videoLink(lang, video.id)} className="group flex flex-col gap-2 py-5">
                      <h2 className="text-lg leading-snug group-hover:underline group-hover:underline-offset-4 lg:text-xl">
                        {local?.title}
                      </h2>
                      {local?.dek ? (
                        <p className="max-w-2xl text-pretty text-[15px] leading-snug text-muted">
                          {local.dek}
                        </p>
                      ) : null}
                      <div className="mt-1 flex flex-col items-start gap-1 text-xs text-muted">
                        <p>
                          <span
                            className={
                              lang === "ar" ? "text-pine" : "uppercase tracking-widest text-pine"
                            }
                          >
                            {videoWords(lang).video}
                          </span>
                          {length ? (
                            <span className="tabular-nums" dir="ltr">{` · ${length}`}</span>
                          ) : null}
                          {" · "}
                          <span className="whitespace-nowrap">{formatDate(video.date, lang)}</span>
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              }
              const story = found.card;
              const local = story.locales[lang];
              const summary = local.dek.trim() || local.lead;
              return (
                <li key={story.id} className="border-b border-line last:border-b-0">
                  <Link {...readLink(lang, story.id)} className="group flex flex-col gap-2 py-5">
                    <h2 className="text-lg leading-snug group-hover:underline group-hover:underline-offset-4 lg:text-xl">
                      {storyTitle(story, lang)}
                    </h2>
                    {summary ? (
                      <p
                        className={`max-w-2xl text-pretty text-[15px] leading-snug text-muted ${local.dek.trim() ? "" : "line-clamp-3"}`}
                      >
                        {summary}
                      </p>
                    ) : null}
                    <div className="mt-1 flex flex-col items-start gap-1 text-xs text-muted">
                      <p>
                        <span
                          className={
                            lang === "ar" ? "text-pine" : "uppercase tracking-widest text-pine"
                          }
                        >
                          {copy.themes[story.theme]}
                        </span>
                        {" · "}
                        <span className="whitespace-nowrap">{formatDate(story.date, lang)}</span>
                      </p>
                      {local.minutes ? (
                        <ReadTime
                          minutes={local.minutes}
                          lang={lang}
                          pattern={copy.minRead}
                          story={story}
                        />
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : null}

        {searching && results.length === 0 ? (
          <p aria-live="polite" className="px-5 pt-2 pb-10 text-[15px] text-muted md:px-8">
            {words.empty}
          </p>
        ) : null}
        {pending || failed ? (
          <p role="status" className="px-5 pt-2 pb-10 text-[15px] text-muted md:px-8">
            {pending ? words.loading : words.failed}
          </p>
        ) : null}
      </main>
    </Shell>
  );
}
