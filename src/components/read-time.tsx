import type { KeyboardEvent, MouseEvent } from "react";
import { useCopy } from "@/lib/i18n";
import { listenTo, useListen, type ListenClip } from "@/lib/listen";
import { storyTitle } from "@/lib/text";
import type { Lang, StoryCard } from "@/lib/types";

/**
 * Reading time, as in "4 MIN READ", plain words, no box, in the small spaced capitals of
 * the section label so the two read as one family. Used on the cards only; the reading page does not show it.
 * Arabic has no capitals and is not letter-spaced.
 *
 * When the reading has a recording in this language, "· ▶ LISTEN" follows on the same
 * line, in the same letters: pressing it plays the recording in the bar at the foot of
 * the screen without opening the reading.
 */
export function ReadTime({
  minutes,
  lang,
  pattern,
  story,
}: {
  minutes: number;
  lang: Lang;
  pattern: string;
  /** The card's reading; with a recording in `lang`, the line offers to listen. */
  story?: StoryCard;
}) {
  return (
    <p
      className={
        lang === "ar"
          ? "text-xs whitespace-nowrap text-muted tabular-nums"
          : "text-xs whitespace-nowrap text-muted uppercase tracking-widest tabular-nums"
      }
    >
      {pattern.replace("{n}", String(minutes))}
      {story ? <CardListen story={story} lang={lang} /> : null}
    </p>
  );
}

/** " · ▶ LISTEN" after a card's reading time, when the reading has a recording in `lang`. */
export function CardListen({ story, lang }: { story: StoryCard; lang: Lang }) {
  const src = story.locales[lang].audio;
  if (!src) return null;
  return (
    <>
      <span aria-hidden="true" className="text-muted">
        {" · "}
      </span>
      <ListenMark clip={{ id: story.id, lang, title: storyTitle(story, lang), src }} />
    </>
  );
}

/**
 * Start mark beside the Listen word: a hairline ring with a filled triangle,
 * the same size when the recording is paused.
 */
function StartGlyph({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-3 shrink-0 rtl:-scale-x-100" aria-hidden="true">
      <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="0.8" />
      {playing ? (
        <>
          <rect x="5.05" y="4.9" width="1.85" height="6.2" rx="0.2" fill="currentColor" />
          <rect x="9.1" y="4.9" width="1.85" height="6.2" rx="0.2" fill="currentColor" />
        </>
      ) : (
        <path d="M6.55 4.75 L11.55 8 L6.55 11.25 Z" fill="currentColor" />
      )}
    </svg>
  );
}

/**
 * The "Listen" word on a card. The card itself is a link, so this is a span acting as a
 * button: it stops the link from opening and starts (or pauses) the recording instead.
 */
function ListenMark({ clip }: { clip: ListenClip }) {
  const copy = useCopy(clip.lang);
  const now = useListen();
  const mine = now.clip?.src === clip.src;
  const playing = mine && now.playing;

  function press(event: MouseEvent | KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    listenTo(clip);
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`${playing ? copy.pause : copy.listen}: ${clip.title}`}
      aria-pressed={playing}
      onClick={press}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") press(event);
      }}
      className="listen-mark -my-2 inline-flex cursor-pointer items-center gap-x-1.5 py-2 text-ink hover:underline hover:underline-offset-4"
    >
      <StartGlyph playing={playing} />
      {playing ? copy.pause : copy.listen}
    </span>
  );
}
