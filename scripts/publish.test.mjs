import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { publisher } from "./publish-test-module.mjs";

test("the panel writes and deletes media at the canonical root paths", async () => {
  for (const path of ["images/new.jpg", "audio/new.mp3", "videos/new.mp4"]) assert.equal(publisher.repoPathOf(path), path);
  assert.equal(publisher.repoPathOf("other/new.jpg"), null);
  const draft = JSON.parse(readFileSync("tests/fixtures/stories/carbon-books.json", "utf8"));
  draft.id = "media-test";
  draft.image.src = "data:image/jpeg;base64,aW1hZ2U=";
  draft.locales.en.audio = { name: "new.mp3", mime: "audio/mpeg", dataUrl: "data:audio/mpeg;base64,YXVkaW8=" };
  const entries = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes("/contents/")) return new Response("", { status: 404 });
    if (init.method === "POST" && String(url).endsWith("/git/trees")) entries.push(...JSON.parse(init.body).tree);
    return Response.json(String(url).includes("/git/ref/heads/") ? { object: { sha: "head" } } : String(url).includes("/git/commits/head") ? { tree: { sha: "tree" } } : { sha: "new" });
  };
  try {
    const { shown } = await publisher.publishStory("test", draft, undefined, null);
    assert.ok(entries.some((entry) => /^images\/media-test-.*\.jpg$/.test(entry.path)));
    assert.ok(entries.some((entry) => /^audio\/media-test-en-.*\.mp3$/.test(entry.path)));
    assert.ok(entries.every((entry) => !entry.path.startsWith("public/")));
    assert.match(shown.image.src, /^\/images\//);
    assert.match(shown.locales.en.audio.dataUrl, /^\/audio\//);
  } finally { globalThis.fetch = original; }
});
