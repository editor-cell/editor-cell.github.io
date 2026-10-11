import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { publisher } from "./publish-test-module.mjs";

test("the panel writes and deletes media at the canonical root paths", async () => {
  for (const path of ["images/new.jpg", "audio/new.mp3", "videos/new.mp4"])
    assert.equal(publisher.repoPathOf(path), path);
  assert.equal(publisher.repoPathOf("other/new.jpg"), null);
  const draft = JSON.parse(readFileSync("tests/fixtures/stories/carbon-books.json", "utf8"));
  draft.id = "media-test";
  draft.image.src = "data:image/jpeg;base64,aW1hZ2U=";
  draft.locales.en.audio = {
    name: "new.mp3",
    mime: "audio/mpeg",
    dataUrl: "data:audio/mpeg;base64,YXVkaW8=",
  };
  const entries = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes("/contents/")) return new Response("", { status: 404 });
    if (init.method === "POST" && String(url).endsWith("/git/trees"))
      entries.push(...JSON.parse(init.body).tree);
    return Response.json(
      String(url).includes("/git/ref/heads/")
        ? { object: { sha: "head" } }
        : String(url).includes("/git/commits/head")
          ? { tree: { sha: "tree" } }
          : { sha: "new" },
    );
  };
  try {
    const { shown } = await publisher.publishStory("test", draft, undefined, null);
    assert.ok(entries.some((entry) => /^images\/media-test-.*\.jpg$/.test(entry.path)));
    assert.ok(entries.some((entry) => /^audio\/media-test-en-.*\.mp3$/.test(entry.path)));
    assert.ok(entries.every((entry) => !entry.path.startsWith("public/")));
    assert.match(shown.image.src, /^\/images\//);
    assert.match(shown.locales.en.audio.dataUrl, /^\/audio\//);
  } finally {
    globalThis.fetch = original;
  }
});

for (const scenario of [
  "moved before head read",
  "same file changed on retry",
  "other file changed on retry",
]) {
  test(`publisher protects the parent snapshot: ${scenario}`, async () => {
    const { gitApi } = await import("./publish-test-module.mjs");
    const original = globalThis.fetch;
    let attempts = 0,
      writes = 0,
      patches = 0;
    const parents = [];
    globalThis.fetch = async (url, init = {}) => {
      const path = new URL(url).pathname;
      if (path.includes("/git/ref/heads/")) {
        attempts++;
        return Response.json({
          object: {
            sha: scenario === "moved before head read" || attempts > 1 ? "new-head" : "old-head",
          },
        });
      }
      if (path.includes("/contents/")) {
        const ref = new URL(url).searchParams.get("ref");
        assert.ok(
          ["old-head", "new-head"].includes(ref),
          "must compare immutable parent, never main",
        );
        return new Response(
          ref === "new-head" && scenario !== "other file changed on retry"
            ? "newer text"
            : "original text",
        );
      }
      if (init.method === "POST") {
        writes++;
        const body = JSON.parse(init.body);
        if (path.endsWith("/git/commits")) parents.push(body.parents[0]);
        return Response.json({ sha: "created" });
      }
      if (init.method === "PATCH") {
        patches++;
        if (patches === 1) return new Response("branch moved", { status: 409 });
        return Response.json({ object: { sha: "created" } });
      }
      return Response.json({ tree: { sha: "tree-" + attempts } });
    };
    try {
      const save = gitApi.commit("test", "save", [
        { path: "content/stories/test.json", base64: "eA==", expected: "original text" },
      ]);
      if (scenario === "other file changed on retry") {
        await save;
        assert.equal(patches, 2);
        assert.deepEqual(parents, ["old-head", "new-head"]);
      } else {
        await assert.rejects(save, (error) => error.kind === "stale");
        assert.equal(patches, scenario === "moved before head read" ? 0 : 1);
        assert.equal(
          writes,
          scenario === "moved before head read" ? 0 : 3,
          "no objects written after detecting stale text",
        );
      }
    } finally {
      globalThis.fetch = original;
    }
  });
}

test("a missing base cannot bypass the publisher's stale guard", async () => {
  const draft = JSON.parse(readFileSync("tests/fixtures/stories/carbon-books.json", "utf8"));
  await assert.rejects(
    publisher.publishStory("test", draft, undefined, undefined),
    (error) => error.kind === "stale",
  );
});
