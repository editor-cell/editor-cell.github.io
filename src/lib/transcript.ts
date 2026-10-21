/**
 * A video's transcript timed by its subtitles. The transcript is the text written for the
 * page, in paragraphs; the subtitles in the same language (a WebVTT file) say when each line
 * is spoken. Matched word by word, every run of the transcript gets the time of its line: a
 * paragraph begins with its first line, the line being spoken can be marked, and the reader
 * can start the film at any line. Where the two do not match, the transcript stays plain.
 *
 * Nothing here needs the browser, so the check of the video files uses it too.
 */

/** One line of the subtitles. */
export type Cue = { start: number; end: number; text: string };

/** A run of a paragraph spoken in one line of the subtitles. */
export type TimedPiece = { text: string; start: number };

export type TimedParagraph = { start: number; pieces: TimedPiece[] };

/** How many words of the subtitles a word of the transcript may be looked for ahead. */
const LOOKAHEAD = 12;
/** The share of the transcript's words that must be found in the subtitles. */
const ENOUGH = 0.8;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  nbsp: " ",
  lrm: "",
  rlm: "",
};

/** "00:01:02.500" or "01:02.500" → 62.5 */
function seconds(stamp: string): number {
  return stamp
    .trim()
    .replace(",", ".")
    .split(":")
    .reduce((total, part) => total * 60 + Number(part), 0);
}

/** The lines of a WebVTT file, in order, as plain text. */
export function parseVtt(source: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of source.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const at = lines.findIndex((line) => line.includes("-->"));
    if (at < 0) continue;
    const [from, rest = ""] = lines[at].split("-->");
    const start = seconds(from);
    const end = seconds(rest.trim().split(/\s+/)[0] ?? "");
    const text = lines
      .slice(at + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/&(\w+);/g, (whole, name: string) => ENTITIES[name] ?? whole)
      .replace(/\s+/g, " ")
      .trim();
    if (text && Number.isFinite(start) && Number.isFinite(end)) cues.push({ start, end, text });
  }
  return cues;
}

/** A word as it is compared: small letters and figures only. */
function fold(word: string): string {
  return word.toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * The transcript's paragraphs, each cut into the runs spoken in one line of the subtitles,
 * with the time each run begins; null when too few of its words are in the subtitles.
 */
export function timeTranscript(paragraphs: string[], cues: Cue[]): TimedParagraph[] | null {
  const said: { word: string; cue: number }[] = [];
  cues.forEach((cue, index) => {
    for (const word of cue.text.split(" ")) {
      const key = fold(word);
      if (key) said.push({ word: key, cue: index });
    }
  });
  if (said.length === 0) return null;

  let next = 0;
  let last = -1;
  let words = 0;
  let found = 0;
  const timed = paragraphs.map((paragraph) => {
    const runs: { cue: number; words: string[] }[] = [];
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const key = fold(word);
      let cue = last;
      if (key) {
        words += 1;
        const end = Math.min(said.length, next + LOOKAHEAD);
        let at = -1;
        for (let i = next; i < end; i += 1) {
          if (said[i].word === key) {
            at = i;
            break;
          }
        }
        if (at >= 0) {
          found += 1;
          cue = said[at].cue;
          next = at + 1;
        }
      }
      // A word before any found keeps to the line the subtitles are at.
      if (cue < 0) cue = said[Math.min(next, said.length - 1)].cue;
      last = cue;
      const run = runs.at(-1);
      if (run && run.cue === cue) run.words.push(word);
      else runs.push({ cue, words: [word] });
    }
    const pieces = runs.map((run) => ({ text: run.words.join(" "), start: cues[run.cue].start }));
    return { start: pieces[0]?.start ?? 0, pieces };
  });
  return words > 0 && found / words >= ENOUGH ? timed : null;
}

/** "p-i": the run being spoken at this time (the last begun), or null before the first. */
export function pieceAt(timed: TimedParagraph[], time: number): string | null {
  let key: string | null = null;
  timed.forEach((paragraph, p) => {
    paragraph.pieces.forEach((piece, i) => {
      if (piece.start <= time + 0.05) key = `${p}-${i}`;
    });
  });
  return key;
}
