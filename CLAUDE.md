# Orbis — how work is done in this repository

The site's owner (Yavuz) works from a phone and does not run technical checks himself.
Talk to him in Turkish, in plain words, without file paths or code. Every change below
is published by pushing to `main`: the "Publish site" workflow tests, builds and commits
the pages; Cloudflare (Workers Builds) then serves them at https://orbisreadingatlas.com.

## The gates (nothing broken reaches readers)

1. `scripts/stories-check.test.mjs` (part of `npm run test:site`): every reading file is
   valid, its id matches its file name, its section, date and titles are right, its
   picture, video and recordings exist, every `[n]` points to a source.
2. `scripts/check-built-site.mjs` (last step of `npm run build:pages`): every reading
   page was written with its title, every address inside the site resolves, every DOI is
   registered at doi.org.
3. `scripts/browser/pages.mjs` (`npm run test:pages`, the only browser check in the
   workflow): every built page at phone and desktop width; nothing may stick out past the
   screen, no text may run out of its box (a long unbroken word in a title), every
   picture loads, no page reports an error. Locally: `npm run build:pages` first.

A failing gate stops the workflow before the publish commit, so the live site stays as it
was. Never weaken or skip a gate to get a reading out; fix the reading.

On 13 Oct 2026 the owner took the look comparison (`npm run test:browser`) out of the
publish: it was slow and caught nothing a reading change could break. Do not put it back
without asking him. The workflow already runs the gates, so do not repeat them locally
before every push; push and let the workflow check.

## Adding or changing a reading

1. `git pull` first; work on the latest `main`.
2. One reading per commit, touching only `content/stories/<id>.json` and its own media
   (`images/<id>…jpg`, `audio/<id>-<lang>.mp3`, `videos/`). Never mix a reading
   with a change to site code.
3. Open every source address before publishing and confirm that the title, authors, year
   and the figure cited are really there. The gates prove a DOI exists, not that it is
   the right paper or that it says what the text says.
4. Weekly issues: a reading of an issue carries `"issue": N` (1, 2, 3, …) and
   `"rank": 1–9`, the place the owner gives it (1 = most important). The newest issue
   fills the nine boxes at the top of the front page by rank (1 lead, 2 large middle
   card, 3 left card, 4 and 7 under it, 5, 6 and 8 at the right, 9 under the middle card
   on a desktop; on a phone rank 9 heads the list below); older issues move down to the
   lists below. An issue of eight leaves box 9 to the next reading. Never guess a rank;
   ask the owner. Readings without an issue follow by date. The membership terms still
   sell "eight articles a week": a ninth is extra, not part of what is sold.
5. No local run needed; the workflow runs `test:site` and `build:pages` and stops on failure.
6. Push, watch the "Publish site" run, then the Cloudflare status on the `[site] publish`
   commit (`gh api repos/editor-cell/editor-cell.github.io/commits/<sha>/check-runs`),
   then look at the live page.
7. If a published reading is wrong, `git revert` its commit and push; the site returns
   to the state before it.

## Adding a video

Videos stand on their own: no reading and no issue behind them. One file per video,
`content/videos/<id>.json` (`id`, `date`, `src`, `poster`, `duration` in seconds, and per
language `title`, `dek`, `transcript`; optional `captions`, per language a WebVTT file
`videos/<id>-<lang>.vtt` timed to the narration; they also time that language's transcript, so
they must say what the transcript says, and the check stops a video whose captions do not).
The newest sits first in the one-row media strip between the newest issue and the archive; "Show all" opens `/media`; each video has its
own page `/media/<id>` with the transcript behind a button; search finds a video by its
title and transcript. `scripts/videos-check.test.mjs` checks every file. Cloudflare serves
static files only up to 25 MiB, so a long film goes on outside storage with an https
`src`. The strip must never change the boxes above it or the depth buttons.
The search box reads "Search the readings" / "Okumalarda ara" while there are no
videos; with the first video, the owner wants videos named there again (`src/lib/search.ts`).

## Test period

Until launch, `TRIAL = true` in `src/lib/site.ts`: every reader page shows a thin
"in test" line under the header and every page carries `noindex, nofollow`. The readings
on the site now are interim texts (Gemini drafts corrected against their sources). On
launch day, set `TRIAL` to false.

## Editorial rules from the owner

- Readings rest on public, checkable sources (public institutions first); no essays,
  no pieces about individual people.
- Compare how several countries respond to the same question; Turkey is not the centre.
- About 1.5 A4 pages per reading (measured on the English text).
- Pictures are AI-made (no copyright risk); English first, Turkish second.
- Picture direction (26 Oct 2026): natural editorial photography, believable daylight
  and the subject's own colours. Avoid a uniform cream/beige or sepia cast, artificial
  glow and excessive saturation; the site's burgundy, type and rules provide continuity.

## Changing the site itself

Design and code changes go in their own commits, after `npm run typecheck`,
`npm run test:site` and `npm run build:pages`, and a look at the built pages at phone
(390 px) and desktop (1280 px) width. A fix for the phone must not change the desktop
layout, and the other way round. The owner wants the two to look parallel: the same controls in
the same order and a matching look on a phone and a desktop (20 Oct 2026). It is the
direction every design change works toward, not a rule that each change must land on both
at once; only what the width itself forces (a line that wraps, a pointer instead of a
finger) differs for good.

On 30 Oct 2026 a full redesign ("bound atlas": oxblood cloth cover, gilt globe, Garamond,
text-only contents) went live and the owner rejected the style the same day; it was
reverted. Do not bring that look back.

Media has one source: repository-root `images/`, `audio/`, `videos/`. Do not add copies
under `public/`. Vite emits these files at their existing root URLs. Both content checks
require this source; the built-site check requires the corresponding output. Image
sizes still come from `images/` and are served under `/assets/img/`.
