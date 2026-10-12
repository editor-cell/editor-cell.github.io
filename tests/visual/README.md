# Browser check

`npm run test:browser` runs before every publish (see `.github/workflows/pages.yml`).

- **Look.** Two copies of the site are built with the test readings in `fixtures/`: the
  approved one (the commit in `reference.txt`) and the one about to be published. The same
  pages are photographed in both, at phone (390 px) and desktop (1280 px) width, in the four
  colour schemes and the three depths, and compared pixel by pixel. If anything looks
  different, nothing is published; the pictures (approved, new, difference) are kept in
  `.browser-check/out/visual/` and, in the workflow, as the run's "browser-check" download.
- **Use.** The new copy is used as a reader would use it: menu, search, language, depth
  buttons, the chain of documents, listening, colour schemes, the video page, the
  not-found page, and a tab left open while the site is published again (once with the
  last week's page code kept, once a week later when it is gone and the page reloads).

The fixtures are frozen copies of the readings of October 2026 with plain placeholder
pictures and silent recordings. Real readings never enter the check, so a new reading
never stops a publish here; a change to code or styles does.

After a deliberate design change that the owner has approved, run `npm run visual:update`
on the approved commit and commit `reference.txt` on its own. Nothing else updates it.
