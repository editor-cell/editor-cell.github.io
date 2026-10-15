import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/**
 * Every reading file is checked before the site is built. The "Publish site" workflow runs
 * these tests first; if one fails, nothing is published and the live site stays as it was.
 * A mistake in a new reading can therefore never take the site down: the reading simply
 * waits until its file is fixed.
 */

const DIR = "content/stories";
const LANGS = [
  ...readFileSync("src/lib/types.ts", "utf8")
    .match(/export const LANGS = \[([^\]]*)\]/)[1]
    .matchAll(/"([^"]+)"/g),
].map((m) => m[1]);
const THEMES = [
  ...readFileSync("src/lib/types.ts", "utf8")
    .match(/export const THEMES = \[([\s\S]*?)\]/)[1]
    .matchAll(/"([^"]+)"/g),
].map((m) => m[1]);
const LEGACY = [
  ...(
    readFileSync("src/lib/types.ts", "utf8").match(/LEGACY_THEMES[^{]*\{([\s\S]*?)\}/)?.[1] ?? ""
  ).matchAll(/["']?([a-z-]+)["']?\s*:/g),
].map((m) => m[1]);

/** A media path inside a reading (images/…, audio/…, videos/…) exists in the repository. */
function mediaExists(path) {
  if (!path || /^(https?:|data:|blob:)/.test(path)) return true;
  const clean = path.replace(/^\//, "");
  return existsSync(clean);
}

const files = readdirSync(DIR).filter((name) => name.endsWith(".json"));
const ISSUE_SIZE = Number(
  readFileSync("src/lib/front-order.ts", "utf8").match(/ISSUE_SIZE = (\d+)/)[1],
);

test("no two readings share a place in the same issue", () => {
  const taken = new Map();
  for (const file of files) {
    const story = JSON.parse(readFileSync(join(DIR, file), "utf8"));
    if (story.status === "draft" || story.issue === undefined || story.rank === undefined) continue;
    const key = `${story.issue}/${story.rank}`;
    assert.ok(
      !taken.has(key),
      `issue ${story.issue}, place ${story.rank}: both ${taken.get(key)} and ${file}`,
    );
    taken.set(key, file);
  }
});

test("there are readings", () => assert.ok(files.length > 0));

for (const file of files) {
  test(`reading ${file}`, () => {
    let story;
    try {
      story = JSON.parse(readFileSync(join(DIR, file), "utf8"));
    } catch (err) {
      assert.fail(`${file}: not valid JSON (${err.message})`);
    }
    assert.equal(story.id, file.slice(0, -5), `${file}: "id" must match the file name`);
    if (story.status === "draft") return;

    assert.ok(
      THEMES.includes(story.theme) || LEGACY.includes(story.theme),
      `${file}: unknown section "${story.theme}"`,
    );
    assert.match(String(story.date), /^\d{4}-\d{2}-\d{2}$/, `${file}: date must be YYYY-MM-DD`);
    if (story.issue !== undefined) {
      assert.ok(
        Number.isInteger(story.issue) && story.issue > 0,
        `${file}: issue must be 1, 2, 3, …`,
      );
    }
    if (story.rank !== undefined) {
      assert.ok(story.issue !== undefined, `${file}: a place (rank) needs an issue number`);
      assert.ok(
        Number.isInteger(story.rank) && story.rank >= 1 && story.rank <= ISSUE_SIZE,
        `${file}: place (rank) must be 1 to ${ISSUE_SIZE}`,
      );
    }

    const written = LANGS.filter((lang) => (story.locales?.[lang]?.body ?? "").trim());
    assert.ok(written.length > 0, `${file}: published but no language has a text`);
    for (const lang of written) {
      const copy = story.locales[lang];
      assert.ok((copy.title ?? "").trim(), `${file}: ${lang} text has no title`);
      if (copy.audio?.dataUrl) {
        assert.ok(
          mediaExists(copy.audio.dataUrl),
          `${file}: ${lang} recording ${copy.audio.dataUrl} is missing`,
        );
      }
    }

    if (story.image) {
      assert.ok(mediaExists(story.image.src), `${file}: picture ${story.image.src} is missing`);
    }
    if (story.video) {
      assert.ok(mediaExists(story.video.src), `${file}: video ${story.video.src} is missing`);
    }

    const sources = story.sources ?? [];
    const numbers = new Set();
    for (const source of sources) {
      assert.ok(!numbers.has(source.n), `${file}: source number ${source.n} is used twice`);
      numbers.add(source.n);
      assert.match(
        String(source.url),
        /^https?:\/\//,
        `${file}: source ${source.n} has no web address`,
      );
    }
    // Every [n] in a text points to a source that exists.
    for (const lang of written) {
      for (const m of story.locales[lang].body.matchAll(/\[(\d+)\]/g)) {
        assert.ok(
          numbers.has(Number(m[1])),
          `${file}: ${lang} text cites [${m[1]}] but there is no source ${m[1]}`,
        );
      }
    }
  });
}
