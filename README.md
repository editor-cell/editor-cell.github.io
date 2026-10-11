# Orbis

A sourced reading atlas. Five languages, no breaking-news desk, no opinion page. A listen button appears only after a recording is filed for that language. A number in a sentence jumps to the source; the address opens the document.

Live site: https://orbisreadingatlas.com/

Readings live in content/stories as one JSON file each. The panel (/panel) publishes straight to this repository: text to content/stories, recordings to audio, pictures to images/. Each save is one commit; the Publish site workflow rebuilds the pages.

## Browser checks

After `npm ci`, install the test browser with `npx playwright install --with-deps chromium`.
`npm run visual:update` generates the 80 reference images from commit
`5a29fbe50ed946f46f99beb8aecf1223716e9b74`, using its own locked dependencies.
The frozen readings and media are independent of editorial changes. References are
excluded from repair patches: the evaluator runs this command before comparison.
Approved references must be made available in `tests/visual-reference` before the
publishing gate is enabled (for example, commit them separately after owner approval).
The workflow never generates or accepts new references automatically; a missing
reference set stops publication. For an approved future redesign, change the reference
commit explicitly and regenerate only with the owner's approval, using the same browser
and operating system as CI.

`npm run test:browser` builds a separate frozen-content site, then checks 80 exact
screenshots and reader controls against the actual build. Failures are written to
`artifacts/browser` and `artifacts/browser-report`, also uploaded by CI. The static
server handles extensionless HTML and returns HTTP 404 for absent files. For restricted
local environments, `ORBIS_CHROMIUM` can name an already installed Chromium executable;
use the same executable when generating and comparing references.

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
