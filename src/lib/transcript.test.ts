import assert from "node:assert/strict";
import test from "node:test";
import { parseVtt, pieceAt, timeTranscript } from "./transcript.ts";

const VTT = `WEBVTT

1
00:00:00.500 --> 00:00:02.800
Water never stays in one place.

2
00:00:02.800 --> 00:00:05.000 align:start
The same water <i>moves</i>, again and again,

NOTE a note is not a line

3
00:00:05.000 --> 00:00:07.000
between the sea &amp; the sky.

4
00:01:10.000 --> 00:01:12.000
It begins with the sun.
`;

test("the lines of a WebVTT file, as plain text", () => {
  assert.deepEqual(parseVtt(VTT), [
    { start: 0.5, end: 2.8, text: "Water never stays in one place." },
    { start: 2.8, end: 5, text: "The same water moves, again and again," },
    { start: 5, end: 7, text: "between the sea & the sky." },
    { start: 70, end: 72, text: "It begins with the sun." },
  ]);
});

test("a transcript that follows its subtitles is cut into the lines spoken", () => {
  const timed = timeTranscript(
    [
      "Water never stays in one place. The same water moves, again and again, between the sea & the sky.",
      "It begins with the sun.",
    ],
    parseVtt(VTT),
  );
  assert.deepEqual(timed, [
    {
      start: 0.5,
      pieces: [
        { text: "Water never stays in one place.", start: 0.5 },
        { text: "The same water moves, again and again,", start: 2.8 },
        { text: "between the sea & the sky.", start: 5 },
      ],
    },
    { start: 70, pieces: [{ text: "It begins with the sun.", start: 70 }] },
  ]);
});

test("a word the subtitles leave out stays with the line before it", () => {
  const timed = timeTranscript(
    [
      "Water never stays in one place. The same water truly moves, again and again, between the sea and the sky.",
    ],
    parseVtt(VTT),
  );
  assert.ok(timed);
  assert.equal(timed[0].pieces[1].text, "The same water truly moves, again and again,");
});

test("a transcript the subtitles do not follow stays plain", () => {
  assert.equal(
    timeTranscript(["Something else entirely, said in other words."], parseVtt(VTT)),
    null,
  );
  assert.equal(timeTranscript(["Water never stays in one place."], []), null);
});

test("the line being spoken is the last begun", () => {
  const timed = timeTranscript(
    [
      "Water never stays in one place. The same water moves, again and again, between the sea & the sky.",
      "It begins with the sun.",
    ],
    parseVtt(VTT),
  )!;
  assert.equal(pieceAt(timed, 0), null);
  assert.equal(pieceAt(timed, 1), "0-0");
  assert.equal(pieceAt(timed, 6), "0-2");
  // Between two lines the one before stays marked.
  assert.equal(pieceAt(timed, 30), "0-2");
  assert.equal(pieceAt(timed, 71), "1-0");
});
