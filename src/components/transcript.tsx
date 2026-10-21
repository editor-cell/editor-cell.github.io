import { Play } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type RefObject } from "react";
import { fmt } from "@/lib/listen";
import { parseVtt, pieceAt, timeTranscript, type Cue, type TimedParagraph } from "@/lib/transcript";
import type { Lang } from "@/lib/types";
import { videoWords } from "@/lib/videos";

const loaded = new Map<string, Promise<Cue[]>>();

/** The lines of a subtitles file, fetched once a visit; none when it cannot be read. */
function loadCues(url: string): Promise<Cue[]> {
  let cues = loaded.get(url);
  if (!cues) {
    cues = fetch(url)
      .then((response) => (response.ok ? response.text() : ""))
      .then(parseVtt)
      .catch(() => []);
    cues.then((list) => {
      if (list.length === 0) loaded.delete(url);
    });
    loaded.set(url, cues);
  }
  return cues;
}

/**
 * A video's transcript. With subtitles in its language it is timed by them: beside each
 * paragraph, in a narrow column that scrolls with the words, a small play key and the time
 * the paragraph begins. Only that key moves the film; a tap on the words themselves does
 * nothing to it.
 *
 * Under the screen, while the film is in sight, the line being spoken is marked and the
 * words follow it on their own. When the reader scrolls them, they stay where the reader put
 * them, and a key brings the following back.
 */
export function Transcript({
  id,
  paragraphs,
  captions,
  lang,
  hidden,
  film,
  onPlayFrom,
  className = "",
}: {
  id: string;
  paragraphs: string[];
  /** The subtitles in the transcript's language: they time it. */
  captions?: string;
  lang: Lang;
  hidden: boolean;
  /** The film on the screen while it is in sight: its words are then marked and followed. */
  film?: RefObject<HTMLVideoElement | null> | null;
  onPlayFrom: (seconds: number) => void;
  className?: string;
}) {
  const words = videoWords(lang);
  const box = useRef<HTMLDivElement | null>(null);
  const [timed, setTimed] = useState<TimedParagraph[] | null>(null);
  const [now, setNow] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const leap = useRef(true);
  const text = paragraphs.join("\n\n");
  const live = Boolean(film) && !hidden && timed !== null;

  useEffect(() => {
    setTimed(null);
    if (!captions) return;
    let current = true;
    void loadCues(captions).then((cues) => {
      if (current) setTimed(timeTranscript(paragraphs, cues));
    });
    return () => {
      current = false;
    };
    // The paragraphs are new each time the page draws; their words are what count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captions, text]);

  // Each time the words come into sight under the film they start by following it.
  useEffect(() => {
    if (!live) return;
    setFollow(true);
    leap.current = true;
  }, [live]);

  useEffect(() => {
    const el = film?.current;
    if (!el || !timed) {
      setNow(null);
      return;
    }
    const onTime = () => setNow(pieceAt(timed, el.currentTime));
    onTime();
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onTime);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeked", onTime);
    };
  }, [film, timed]);

  // Keep the line being spoken a third of the way down the words.
  useEffect(() => {
    const frame = box.current;
    if (!live || !follow || !frame) return;
    const line = now ? frame.querySelector<HTMLElement>(`[data-piece="${now}"]`) : null;
    const top = line
      ? line.getBoundingClientRect().top - frame.getBoundingClientRect().top + frame.scrollTop
      : 0;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    frame.scrollTo({
      top: Math.max(0, top - frame.clientHeight / 3),
      behavior: leap.current || still ? "auto" : "smooth",
    });
    leap.current = false;
  }, [live, follow, now]);

  /** The reader moved the words: they stay where they are put. */
  function letGo() {
    const frame = box.current;
    if (live && frame && frame.scrollHeight > frame.clientHeight) setFollow(false);
  }

  function playFrom(seconds: number) {
    setFollow(true);
    onPlayFrom(seconds);
  }

  return (
    <div
      id={id}
      ref={box}
      hidden={hidden}
      className={`transcript ${className}`}
      onWheel={letGo}
      onTouchMove={letGo}
      onPointerDown={(event) => {
        // The scroll bar of the words is the box itself.
        if (event.target === event.currentTarget) letGo();
      }}
      onKeyDown={(event) => {
        if (
          event.target === event.currentTarget &&
          ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)
        )
          letGo();
      }}
    >
      {paragraphs.map((paragraph, p) => {
        if (!captions) return <p key={p}>{paragraph}</p>;
        const row = timed?.[p];
        const nowHere = live && now?.startsWith(`${p}-`);
        return (
          <div key={p} className={`transcript-row ${nowHere ? "is-now" : ""}`}>
            {/* The column is kept while the times load, so the words do not move when they come. */}
            <span className="transcript-time">
              {row ? (
                <button
                  type="button"
                  onClick={() => playFrom(row.start)}
                  aria-label={`${words.playFrom}: ${fmt(row.start)}`}
                  className="transcript-play"
                >
                  <span aria-hidden="true" className="transcript-play-ring">
                    <Play
                      className="ms-px size-2.5 rtl:-scale-x-100"
                      fill="currentColor"
                      strokeWidth={0}
                    />
                  </span>
                  <span aria-hidden="true" dir="ltr">
                    {fmt(row.start)}
                  </span>
                </button>
              ) : null}
            </span>
            <p>
              {row
                ? row.pieces.map((piece, i) => (
                    <Fragment key={i}>
                      {i ? " " : null}
                      <span
                        data-piece={`${p}-${i}`}
                        className={`transcript-piece ${live && now === `${p}-${i}` ? "is-now" : ""}`}
                      >
                        {piece.text}
                      </span>
                    </Fragment>
                  ))
                : paragraph}
            </p>
          </div>
        );
      })}
      {live && !follow ? (
        <button type="button" onClick={() => setFollow(true)} className="transcript-follow">
          {words.followFilm}
        </button>
      ) : null}
    </div>
  );
}
