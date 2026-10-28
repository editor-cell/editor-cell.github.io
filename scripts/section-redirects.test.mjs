import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sectionRedirects, writeSectionRedirects, readRedirects, redirectFor } from "./section-redirects.mjs";
import { siteServer } from "./site-server.mjs";
import { serveSite } from "./browser/serve.mjs";

const merged = {
  climate: "climate-environment",
  environment: "climate-environment",
  economy: "economy-politics",
  politics: "economy-politics",
  science: "science-technology",
  technology: "science-technology",
  research: "science-technology",
  cities: "economy-politics",
  trade: "science-technology",
  knowledge: "culture",
};

test("old section addresses permanently redirect to their new home in the same language", () => {
  const redirects = sectionRedirects();
  assert.equal(redirects.length, Object.keys(merged).length * 2 * 3);
  assert.equal(new Set(redirects.map(({ from }) => from)).size, redirects.length);
  for (const prefix of ["", "/tr"]) {
    for (const [old, current] of Object.entries(merged)) {
      for (const suffix of ["", "/", ".html"]) {
        assert.deepEqual(redirectFor(redirects, `${prefix}/${old}${suffix}`), {
          location: `${prefix}/${current}`, status: 301,
        });
      }
      assert.equal(redirectFor(redirects, `${prefix}/${current}`), undefined, "no redirect loop");
    }
    assert.equal(redirectFor(redirects, `${prefix}/health`), undefined);
    assert.equal(redirectFor(redirects, `${prefix}/unknown`), undefined);
  }
});

test("section redirects preserve query parameters and do not capture reading addresses", () => {
  const redirects = sectionRedirects();
  assert.deepEqual(redirectFor(redirects, "/tr/climate?depth=2&utm_source=archive"), {
    location: "/tr/climate-environment?depth=2&utm_source=archive", status: 301,
  });
  assert.equal(redirectFor(redirects, "/read/climate"), undefined);
  assert.equal(redirectFor(redirects, "/climate-report"), undefined);
});

test("preview and browser-check hosts apply the deployed section redirects", async () => {
  const root = mkdtempSync(join(tmpdir(), "orbis-section-redirects-"));
  mkdirSync(join(root, "tr"));
  writeFileSync(join(root, "404.html"), "Missing");
  for (const prefix of ["", "tr/"])
    for (const theme of new Set(Object.values(merged)))
      writeFileSync(join(root, `${prefix}${theme}.html`), `Section: ${prefix}${theme}`);
  const redirects = writeSectionRedirects(root);
  assert.deepEqual(readRedirects(root), redirects);
  const preview = siteServer(root);
  await new Promise((resolve) => preview.listen(0, "127.0.0.1", resolve));
  const browser = await serveSite(root);
  try {
    for (const base of [`http://127.0.0.1:${preview.address().port}`, browser.url]) {
      for (const { from, to } of redirects) {
        const response = await fetch(`${base}${from}?from=old`, { redirect: "manual" });
        assert.equal(response.status, 301, from);
        assert.equal(response.headers.get("location"), `${to}?from=old`, from);
      }
      const followed = await fetch(`${base}/tr/politics`);
      assert.equal(followed.status, 200);
      assert.equal(await followed.text(), "Section: tr/economy-politics");
      const head = await fetch(`${base}/science.html`, { method: "HEAD", redirect: "manual" });
      assert.equal(head.status, 301);
      assert.equal(head.headers.get("location"), "/science-technology");
      assert.equal(await head.text(), "");
      assert.equal((await fetch(`${base}/assets/missing.js`)).status, 404);
    }
  } finally {
    await new Promise((resolve) => preview.close(resolve));
    await browser.close();
    rmSync(root, { recursive: true, force: true });
  }
});
