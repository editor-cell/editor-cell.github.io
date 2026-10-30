import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Count, ResultList, useSearch } from "@/components/search-bar";
import { SearchMark } from "@/components/search-mark";
import { Shell } from "@/components/shell";
import { searchCopy } from "@/lib/search";
import { useLang } from "@/lib/use-lang";

/** The query in the address (?q=…), so a search can be shared and survives a reload. */
function queryFromAddress(search: string): string {
  try {
    return new URLSearchParams(search).get("q") ?? "";
  } catch {
    return "";
  }
}

/**
 * The search page, kept for shared addresses (/search?q=…): one large field on a rule,
 * then the matching readings as a plain list. Results follow the typing.
 */
export function SearchPage() {
  const lang = useLang();
  const words = searchCopy(lang);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const input = useRef<HTMLInputElement | null>(null);
  // The page is written out without a query; the query is read once the page is open,
  // so the written page and the open page start out the same.
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const { results, failed, searching, pending, retry } = useSearch(query, ready);

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

  return (
    <Shell>
      <main className="page-width gutter">
        <div className="pt-10 md:pt-16">
          <h1 className="page-title">{words.title}</h1>
        </div>

        <div className="pt-6 pb-6 md:pt-8 md:pb-8">
          <form
            role="search"
            className="group flex items-center gap-3 border-b border-rule pb-2.5 focus-within:border-ink"
            onSubmit={(event) => {
              event.preventDefault();
              retry();
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
          {searching && results.length > 0 ? <Count n={results.length} className="mt-3.5" /> : null}
        </div>

        {searching && results.length > 0 ? (
          <ResultList results={results} className="" />
        ) : null}

        {searching && results.length === 0 ? (
          <p aria-live="polite" className="pt-2 pb-10 italic text-muted">
            {words.empty}
          </p>
        ) : null}
        {pending || failed ? (
          <p role="status" className="pt-2 pb-10 italic text-muted">
            {pending ? words.loading : words.failed}
          </p>
        ) : null}
      </main>
    </Shell>
  );
}
