import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReadTime } from "@/components/read-time";
import { SearchMark } from "@/components/search-mark";
import { useFrameCopy } from "@/lib/frame-copy";
import { useCopy } from "@/lib/i18n";
import { readLink, videoLink } from "@/lib/lang-path";
import { loadSearchIndexes, searchAll, searchCopy, type SearchIndexes } from "@/lib/search";
import { CARDS } from "@/lib/seed";
import { formatDate, storyTitle } from "@/lib/text";
import { LANGS } from "@/lib/types";
import { useLang } from "@/lib/use-lang";
import { VIDEOS, formatDuration, videoWords } from "@/lib/videos";

/**
 * The search itself, shared by the page and the bar under the masthead: on the first
 * nonempty query the texts of every site language are downloaded (a word is found
 * whichever language it is typed in), then the results follow the typing.
 */
export function useSearch(query: string, ready = true) {
  const lang = useLang();
  const [indexes, setIndexes] = useState<SearchIndexes | null>(null);
  const [failed, setFailed] = useState(false);
  const [requestAttempt, setRequestAttempt] = useState(0);
  const hasQuery = query.trim().length > 0;

  // Cancelling the request keeps a closed bar or a left page from setting state.
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
  return {
    results,
    failed,
    searching: ready && hasQuery && indexes !== null,
    pending: ready && hasQuery && !indexes && !failed,
    retry: () => {
      if (failed) setRequestAttempt((attempt) => attempt + 1);
    },
  };
}

type Found = ReturnType<typeof useSearch>["results"][number];

/** The matching readings and videos as a plain list: title, summary, section and date. */
export function ResultList({
  results,
  className,
  onPick,
}: {
  results: Found[];
  className: string;
  onPick?: () => void;
}) {
  const lang = useLang();
  const copy = useCopy(lang);
  return (
    <ol className={className}>
      {results.map((found) => {
        if (found.kind === "video") {
          const { video } = found;
          const local = video.locales[lang];
          const length = formatDuration(video.duration);
          return (
            <li key={`video-${video.id}`} className="border-b border-line last:border-b-0">
              <Link
                {...videoLink(lang, video.id)}
                className="group flex flex-col gap-2 py-5"
                onClick={onPick}
              >
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
            <Link
              {...readLink(lang, story.id)}
              className="group flex flex-col gap-2 py-5"
              onClick={onPick}
            >
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
                    className={lang === "ar" ? "text-pine" : "uppercase tracking-widest text-pine"}
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
  );
}

/** The number of results, in the small capitals of the labels. */
export function Count({ n, className }: { n: number; className: string }) {
  const lang = useLang();
  return (
    <p
      aria-live="polite"
      className={`${className} ${lang === "ar" ? "text-xs text-muted tabular-nums" : "text-xs uppercase tracking-widest text-muted tabular-nums"}`}
    >
      {searchCopy(lang).count(n)}
    </p>
  );
}

/**
 * The search bar the magnifier in the masthead opens on every page, straight under the
 * black band. The page stays where it is; the results fold open under the bar, over the
 * page, and a tap on a result, outside the bar, on the cross or Escape closes it.
 */
export function SearchBar({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const words = searchCopy(lang);
  const frame = useFrameCopy(lang);
  const input = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const { results, failed, searching, pending, retry } = useSearch(query);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    input.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const note =
    searching && results.length === 0
      ? words.empty
      : pending
        ? words.loading
        : failed
          ? words.failed
          : "";
  const open = (searching && results.length > 0) || note;

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label={frame.close}
        className="search-scrim fixed inset-0 z-30 cursor-default bg-ink/25"
        onClick={onClose}
      />
      <div className="relative z-40 border-b border-rule bg-paper">
        <form
          role="search"
          className="flex items-center gap-3 px-5 md:px-8"
          onSubmit={(event) => {
            event.preventDefault();
            retry();
            // On a phone the keyboard goes down, so the results can be seen.
            input.current?.blur();
          }}
        >
          <SearchMark className="size-[18px] shrink-0 text-muted" />
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
            className="search-field min-h-14 min-w-0 flex-1 bg-transparent text-xl leading-tight text-ink placeholder:text-muted/75 focus:outline-none md:min-h-16 md:text-2xl"
          />
          <button
            type="button"
            aria-label={frame.close}
            onClick={onClose}
            className="-me-2 inline-flex size-11 shrink-0 items-center justify-center text-muted hover:text-ink"
          >
            <X aria-hidden="true" strokeWidth={1.5} className="size-5" />
          </button>
        </form>
        {open ? (
          <div className="absolute inset-x-0 top-full max-h-[min(70dvh,40rem)] overflow-y-auto border-b border-rule bg-paper shadow-[0_12px_24px_-16px_rgb(0_0_0/0.35)]">
            {searching && results.length > 0 ? (
              <>
                <Count n={results.length} className="border-t border-line px-5 pt-3.5 md:px-8" />
                <ResultList results={results} className="px-5 md:px-8" onPick={onClose} />
              </>
            ) : (
              <p
                role="status"
                className="border-t border-line px-5 py-5 text-[15px] text-muted md:px-8"
              >
                {note}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
