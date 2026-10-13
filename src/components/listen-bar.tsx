import { Link } from "@tanstack/react-router";
import { Pause, Play, X } from "lucide-react";
import { Pick } from "@/components/pick";
import { SkipButton } from "@/components/player";
import { useCopy } from "@/lib/i18n";
import { readLink } from "@/lib/lang-path";
import {
  RATES,
  SKIP_SECONDS,
  close,
  fmt,
  retry,
  seek,
  setRate,
  skip,
  toggle,
  useListen,
} from "@/lib/listen";

/**
 * The listening panel at the foot of the screen, for a recording started from a card.
 * It keeps playing while the reader moves between pages. Same hairline and type as the
 * player on a reading: the title opens the reading, a one-pixel seek line runs under it,
 * and back 15 · play · ahead 15 sit in the middle, with the speed at the start and close
 * at the end of the title line. A spacer of the same height keeps the page's last lines
 * from sitting under it.
 *
 * The contents stand in the middle of the screen on every page and at every width, so the
 * panel never looks pushed to one side when the reader scrolls away from the top.
 */
export function ListenBar() {
  const now = useListen();
  const clip = now.clip;
  const copy = useCopy(clip?.lang ?? "en");
  if (!clip) return null;

  const span = now.duration > 0 ? Math.min(now.time, now.duration) / now.duration : 0;
  const pct = `${span * 100}%`;
  const left = Math.max(0, now.duration - now.time);

  return (
    <>
      <div aria-hidden="true" className="listen-bar-space no-print h-28" />
      <section
        aria-label={copy.listen}
        className="listen-bar no-print fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-sheet text-ink"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="reading-player mx-auto flex w-full max-w-2xl min-w-0 flex-col px-5 pt-1.5 pb-1 md:px-8">
          <div className="flex items-center gap-3">
            <Link
              {...readLink(clip.lang, clip.id)}
              className="paper-title block min-w-0 flex-1 truncate text-base font-bold leading-tight text-ink underline-offset-4 hover:underline"
            >
              {clip.title}
            </Link>
            <button
              type="button"
              onClick={close}
              aria-label={copy.closeListen}
              title={copy.closeListen}
              className="-me-2 inline-flex size-8 shrink-0 items-center justify-center text-muted hover:text-ink"
            >
              <X className="size-4" strokeWidth={1.25} aria-hidden="true" />
            </button>
          </div>

          <div className="seek-line mt-0.5 w-full" style={{ flex: "none" }}>
            <div className="seek-rule" aria-hidden="true">
              <span className="seek-fill" style={{ width: pct }} />
              <span className="seek-knob" style={{ insetInlineStart: pct }} />
            </div>
            <input
              className="seek"
              type="range"
              min={0}
              max={now.duration || 0}
              step={0.1}
              value={Math.min(now.time, now.duration || 0)}
              aria-label={copy.listen}
              aria-valuetext={`${fmt(now.time)} / ${fmt(now.duration)}`}
              onChange={(event) => seek(Number(event.target.value))}
            />
          </div>
          <div
            dir="ltr"
            className="-mt-1 flex justify-between text-[11px] tabular-nums tracking-wide text-muted"
          >
            <span>{fmt(now.time)}</span>
            <span>−{fmt(left)}</span>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center">
            <span className="inline-flex justify-self-start">
              <Pick
                tone="page"
                align="start"
                drop="up"
                label={copy.speed}
                value={String(now.rate)}
                onChange={(value) => setRate(Number(value))}
                options={RATES.map((value) => ({ value: String(value), label: `${value}x` }))}
                buttonClassName="min-h-8 gap-1 py-0 text-[11px] tracking-widest text-muted"
              >
                <span dir="ltr" className="tabular-nums text-ink">
                  {now.rate}×
                </span>
                <span aria-hidden="true" className="text-[9px] leading-none">
                  ▴
                </span>
              </Pick>
            </span>
            <div className="flex items-center gap-x-3">
              <SkipButton
                direction="back"
                label={copy.skipBack}
                onClick={() => skip(-SKIP_SECONDS)}
              />
              <button
                type="button"
                onClick={toggle}
                aria-label={now.playing ? copy.pause : copy.listen}
                className="inline-flex size-8 shrink-0 items-center justify-center text-ink"
              >
                {now.playing ? (
                  <Pause
                    className="size-4"
                    fill="currentColor"
                    strokeWidth={0}
                    aria-hidden="true"
                  />
                ) : (
                  <Play
                    className="ms-0.5 size-4 rtl:-scale-x-100"
                    fill="currentColor"
                    strokeWidth={0}
                    aria-hidden="true"
                  />
                )}
              </button>
              <SkipButton
                direction="ahead"
                label={copy.skipAhead}
                onClick={() => skip(SKIP_SECONDS)}
              />
            </div>
            <span aria-hidden="true" />
          </div>

          {now.error ? (
            <p role="alert" className="flex flex-wrap items-center gap-x-3 pb-1 text-sm text-muted">
              {copy.audioError}
              <button
                type="button"
                onClick={retry}
                className="inline-flex min-h-11 items-center text-pine underline underline-offset-4"
              >
                {copy.retry}
              </button>
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
