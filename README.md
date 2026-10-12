# Orbis

A sourced reading atlas. Five languages, no breaking-news desk, no opinion page. A listen button appears only after a recording is filed for that language. A number in a sentence jumps to the source; the address opens the document.

Live site: https://orbisreadingatlas.com/

Readings live in content/stories as one JSON file each. The panel (/panel) publishes straight to this repository: text to content/stories, recordings to audio, pictures to images/. Each save is one commit; the Publish site workflow rebuilds the pages.

## Browser checks

After `npm ci`, install the test browser with `npx playwright install --with-deps chromium`.
`npm run test:browser` runs before every publish and has two parts:

- **Look** (`scripts/browser/look.mjs`): the approved commit (`tests/visual/reference.txt`)
  and the current code are both built with the frozen readings in `tests/visual/fixtures`
  and photographed side by side in the same run: 96 views (English and Turkish, 390 and
  1280 px, four schemes, the front page at three depths, a section and a reading, plus the
  video, about, membership and not-found pages). Nothing is stored, so no reference can be
  missing or come from another computer. Every pixel must match, any change of colour
  included. Differences are kept in `.browser-check/out/`. The words of the front page's
  faint filler text are covered in the pictures (their line count varies from load to load
  with the same code); their box is compared in the picture, and their text, face, size,
  colour and visibility are compared separately, with one line of play in the count. The
  real faces are required: before every picture, every font file the page asked for must
  have arrived and Tinos and Playfair Display must be in use; otherwise the check stops.
- **Reader** (`tests/browser`): menu, search, language, depth, chain, listening, schemes,
  the layout boundary and a tab left open across a publish, on frozen readings.

After a design change the owner has approved, run `npm run visual:update` on that commit and
commit `tests/visual/reference.txt` alone. The workflow never does this. On a machine that
cannot reach Google Fonts, `ORBIS_OFFLINE_FONTS=1` lets the reader checks run with fallback
faces; `ORBIS_CHROMIUM` can name an installed Chromium.

## Media sources

`images/`, `audio/` and `videos/` at the repository root are the only media sources.
The panel writes these paths, both source checks require files here, and the Vite media
plugin emits them at the same `/images/`, `/audio/`, `/videos/` URLs. `public/` holds
other static assets, never duplicate media. Image sizing reads `images/` and writes
WebP variants to `/assets/img/`. Publishing copies the generated media without changing
its bytes; `.assetsignore` excludes `public/`, never these media directories.

The publishing step copies every build output except `_shell.html`, using
`.site-output.json` to remove obsolete outputs. It then compares the file list and every
file's bytes with `dist/client`; a forgotten folder prevents the publish commit.

Publish runs use GitHub's `queue: max` concurrency (up to 100 waiting runs) and checkout
current `main` when each run starts. If `main` moves during the build or final push,
that run succeeds without publishing stale pages; the next queued run builds the newest
content. No rebase of old generated pages is attempted. Source-only media edits also
trigger a build; generated page, asset and manifest commits remain ignored.

Old tabs keep the two previous code-asset generations, for up to seven days (expired
files are removed on the next publish). Retained files are capped at 64 MiB; total
outputs are capped at the Workers Free limit of 20,000 files and 25 MiB per file.
The output verifier still compares every current file exactly; only explicitly listed
old hashed code assets are additional. Reader pages install an early error handler:
a failed chunk or entry script reloads the clicked destination at most once per tab
and destination. If session storage is blocked, automatic reload is disabled to avoid
loops. `test:browser` builds A and B from a one-title change and tests old-tab navigation
with retention, with old assets deliberately removed, and with permanently missing JS.

The application has one static build (`build` delegates to `build:pages`) and one test
suite (`test` delegates to `test:site`). The unused Better Auth/PGlite application,
preview bridge, multiplayer samples and alternate hosting setup are removed. Supabase
membership and the GitHub-token panel are unchanged. PGlite remains a development
dependency because the protected Supabase SQL tests actually use it. The static PWA
manifest and icons still come from `public/__grok` at their original addresses.
Browser font checks fail if the real masthead font does not load. `ORBIS_BROWSER_PROXY`
is an optional local HTTPS-proxy setting for restricted environments; CI does not set it.

Reader styles are split into shared, phone-only and desktop-only sheets under
`src/styles/`. Card text uses named slots rather than child positions. An unassigned
new phone-card text element follows the existing slots; the top-three ranked list
keeps position selectors because its order represents rank.

`src/lib/breakpoints.ts` is the single width list. Vite generates matching Tailwind
thresholds and custom media in the ignored `breakpoints.generated.css`. Tailwind’s
Lightning CSS compiler expands these queries before publication. The phone query is
strictly below 768 px and desktop is at least 768 px, so fractional widths have no
gap. Image sizes and both JS media listeners use the same definitions. The 801 px
four-column strip step remains unchanged: 768–800 px still has two columns.
