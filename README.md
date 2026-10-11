# Orbis

A sourced reading atlas. Five languages, no breaking-news desk, no opinion page. A listen button appears only after a recording is filed for that language. A number in a sentence jumps to the source; the address opens the document.

Live site: https://orbisreadingatlas.com/

Readings live in content/stories as one JSON file each. The panel (/panel) publishes straight to this repository: text to content/stories, recordings to public/audio, pictures to images/. Each save is one commit; the Publish site workflow rebuilds the pages.

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
