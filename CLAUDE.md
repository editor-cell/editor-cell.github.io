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
The newest sits first in the front page's Videos block, after the contents; "Show all" opens `/media`; each video has its
own page `/media/<id>` with the transcript behind a button; search finds a video by its
title and transcript. `scripts/videos-check.test.mjs` checks every file. Cloudflare serves
static files only up to 25 MiB, so a long film goes on outside storage with an https
`src`.
The search box reads "Search the readings" / "Okumalarda ara" while there are no
videos; with the first video, the owner wants videos named there again (`src/lib/search.ts`).

## Test period

Until launch, `TRIAL = true` in `src/lib/site.ts`: every page carries `noindex, nofollow`
and the front page calls its issue "Preview issue" while no reading has an issue number
(the visible "in test" line was taken off on 28 Oct 2026). The readings on the site now are
interim texts (Gemini drafts corrected against their sources). On launch day, set `TRIAL`
to false.

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

Media has one source: repository-root `images/`, `audio/`, `videos/`. Do not add copies
under `public/`. Vite emits these files at their existing root URLs. Both content checks
require this source; the built-site check requires the corresponding output. Image
sizes still come from `images/` and are served under `/assets/img/`.

## The design (30 Oct 2026)

On 30 Oct 2026 the owner handed the whole design over to Claude ("tamamen sana bırakıyorum":
layout, section names, videos, membership pages, languages). The site was redesigned as a
bound atlas. Keep to it; change it only when the owner asks.

- **Colours** (`src/styles/base.css`): the binding is oxblood cloth `#5a1a24` with gilt
  `#d4ba82` and cream `#f4ead8` (masthead, the front page's cover, the menu, the listening
  strip, the footer); inside, white paper and warm ink `#1d1b19`, the accent `#8a2632`.
  `.on-cloth` resets the colour tokens for anything set on the cloth. The dark scheme
  (`html[data-look="night"]`) keeps the same roles. The browser bar and the icons are the
  cloth.
- **Type**: Cormorant Garamond for every title, EB Garamond for text, both served from
  `src/assets/fonts/` (Latin and Latin Extended, normal and italic; OFL licences beside
  them). No Google Fonts. Garamond's x-height is small, so the Tailwind type scale is set
  larger in `@theme`. Labels are plain words, never spaced capitals; numbers of the issue and
  of the documents are lining figures.
- **Sections** keep their addresses (`/climate-environment`, …) but are named in one word:
  Earth, Society, Science, Health, Culture (Yeryüzü, Toplum, Bilim, Sağlık, Kültür) in
  `src/lib/section-copy.js`. Search also knows the older topic words (`SECTION_TOPICS` in
  `src/lib/search.ts`), so "climate" or "ekonomi" still finds those readings.
- **Front page** (`src/components/front.tsx`): the cover on cloth (the tools, ORBIS large,
  the issue line, reading no. 1 with its photograph framed like a tipped-in plate, and the
  gilt globe of `globe.tsx`, the site's only ornament); then, on paper, Contents (readings
  2–9 numbered), Videos, Earlier issues (small cloth covers, once readings carry issue
  numbers), From the archive, and the Index of places. On a wide screen each block keeps its
  title in a margin column (3 of 12) beside its content (9 of 12).
- **Places**: a reading's `region` ("Denmark · Austria · Greece", or "Global") is set in
  italic as a sentence ("Denmark, Austria and Greece", "Worldwide") by `src/lib/places.ts`;
  the index of places lists every named place in the language's alphabetical order.
- **Reading page**: section, title, standfirst, places and date, one row of tools (listen,
  share, PDF, type size), the photograph wider than the text, the text in one column with a
  dropped first letter, then Documents (always open; a number in the text lights its
  document), related readings and comments.
- **Stylesheets** (`src/styles/`): `base` (fonts, tokens, schemes), `frame` (masthead, menu,
  footer), `front`, `section`, `reading`, `players` (film, listening strip, cinema,
  transcript), `video-page`, `pages` (about, legal, search, membership, account), `print`.
  Phone first; wide-screen rules sit in `@media (--orbis-desktop)` inside each file.

