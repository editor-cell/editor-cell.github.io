import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Pause, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Pick } from "@/components/pick";
import { SkipButton } from "@/components/player";
import { useDockHeight } from "@/lib/dock";
import { useCopy } from "@/lib/i18n";
import { imageSet } from "@/lib/image-set";
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
import { videoWords } from "@/lib/videos";

/**
 * The listening panel at the foot of the screen, for a recording started from a card or a
 * reading's Listen button. It keeps playing while the reader moves between pages. A black
 * band like the masthead: the reading's picture and its
 * title, which opens the reading; a seek line in the accent with the times under its ends;
 * back 15 · play · ahead 15 in the middle and the speed at the start. Folded, it is one
 * strip (picture, title, play, open, close) with the part heard drawn along its top edge,
 * so most of the page stays in view. A spacer of the panel's height keeps the page's last
 * lines from sitting under it.
 */
export function ListenBar() {
  const now = useListen();
  const clip = now.clip;
  const lang = clip?.lang ?? "en";
  const copy = useCopy(lang);
  const words = videoWords(lang);
  const [open, setOpen] = useState(true);
  const box = useRef<HTMLElement | null>(null);
  const space = useDockHeight(box, clip !== null);

  // A new recording opens the panel again.
  useEffect(() => {
    setOpen(true);
  }, [clip?.src]);

  if (!clip) return null;

  const span = now.duration > 0 ? Math.min(now.time, now.duration) / now.duration : 0;
  const pct = `${span * 100}%`;
  const left = Math.max(0, now.duration - now.time);

  return (
    <>
      <div aria-hidden="true" className="listen-bar-space no-print" style={{ height: space }} />
      <section
        ref={box}
        aria-label={copy.listen}
        className={`dock listen-bar no-print fixed inset-x-0 bottom-0 z-40 ${open ? "is-open" : "is-folded"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {!open ? (
          <span aria-hidden="true" className="dock-progress" style={{ width: pct }} />
        ) : null}
        <div className="reading-player mx-auto flex w-full max-w-2xl min-w-0 flex-col px-5 pt-2 pb-1 md:px-8">
          <div className="flex items-center gap-3 pb-1">
            {clip.image ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                tabIndex={open ? -1 : 0}
                aria-label={open ? undefined : words.openPanel}
                aria-hidden={open ? true : undefined}
                className="dock-thumb"
              >
                <img
                  src={clip.image}
                  {...imageSet(clip.image, "3rem")}
                  alt=""
                  className="block h-full w-full object-cover"
                />
              </button>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted tabular-nums">
                {copy.listen}
                <span dir="ltr">{` · ${fmt(now.time)} / ${fmt(now.duration)}`}</span>
              </p>
              <Link
                {...readLink(clip.lang, clip.id)}
                className="paper-title block min-w-0 truncate text-base font-bold leading-tight text-ink underline-offset-4 hover:underline"
              >
                {clip.title}
              </Link>
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label={now.playing ? copy.pause : copy.listen}
              className="dock-play play-disc size-10"
            >
              {now.playing ? (
                <Pause className="size-4" fill="currentColor" strokeWidth={0} aria-hidden="true" />
              ) : (
                <Play
                  className="ms-0.5 size-4 rtl:-scale-x-100"
                  fill="currentColor"
                  strokeWidth={0}
                  aria-hidden="true"
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-label={open ? words.foldPanel : words.openPanel}
              aria-expanded={open}
              className="dock-icon"
            >
              {open ? (
                <ChevronDown className="size-5" strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <ChevronUp className="size-5" strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={close}
              aria-label={copy.closeListen}
              title={copy.closeListen}
              className="dock-icon -me-2"
            >
              <X className="size-4" strokeWidth={1.25} aria-hidden="true" />
            </button>
          </div>

          <div className="dock-more" inert={!open}>
            <div>
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

              <div className="grid grid-cols-[1fr_auto_1fr] items-center pb-1">
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
                <div className="flex items-center gap-x-5">
                  <SkipButton
                    direction="back"
                    label={copy.skipBack}
                    onClick={() => skip(-SKIP_SECONDS)}
                  />
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label={now.playing ? copy.pause : copy.listen}
                    className="play-disc size-11"
                  >
                    {now.playing ? (
                      <Pause
                        className="size-[18px]"
                        fill="currentColor"
                        strokeWidth={0}
                        aria-hidden="true"
                      />
                    ) : (
                      <Play
                        className="ms-0.5 size-[18px] rtl:-scale-x-100"
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
            </div>
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
