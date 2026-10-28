import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parseVtt, timeTranscript } from "../src/lib/transcript.ts";

/**
 * Every video file is checked before the site is built, as the reading files are. A video
 * stands on its own (no reading, no issue): content/videos/<id>.json with its film, its
 * still, and in each language a title, one sentence and the full transcript. Subtitles in a
 * language time that language's transcript, so they must say what it says. If a check
 * fails, nothing is published and the live site stays as it was.
 */

const DIR = "content/videos";
const LANGS = [
  ...readFileSync("src/lib/types.ts", "utf8")
    .match(/export const LANGS = \[([^\]]*)\]/)[1]
    .matchAll(/"([^"]+)"/g),
].map((m) => m[1]);

function mediaExists(path) {
  if (!path || /^https:/.test(path)) return true;
  const clean = path.replace(/^\//, "");
  return existsSync(clean);
}

const files = existsSync(DIR) ? readdirSync(DIR).filter((name) => name.endsWith(".json")) : [];

for (const file of files) {
  test(`video ${file}`, () => {
    const video = JSON.parse(readFileSync(join(DIR, file), "utf8"));
    const id = file.slice(0, -5);
    assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${file}: the file name is the address`);
    assert.equal(video.id ?? id, id, `${file}: id must match the file name`);
    assert.ok(
      [undefined, "draft", "published"].includes(video.status),
      `${file}: status is draft or published`,
    );
    assert.match(String(video.date), /^\d{4}-\d{2}-\d{2}$/, `${file}: date is YYYY-MM-DD`);
    assert.ok(typeof video.src === "string" && video.src, `${file}: src is missing`);
    assert.ok(!/^http:/.test(video.src), `${file}: the film's address must be https`);
    assert.ok(mediaExists(video.src), `${file}: film ${video.src} is missing`);
    if (video.poster)
      assert.ok(mediaExists(video.poster), `${file}: still ${video.poster} is missing`);
    if (video.duration !== undefined) {
      assert.ok(
        Number.isFinite(video.duration) && video.duration > 0,
        `${file}: duration in seconds`,
      );
    }
    for (const [lang, path] of Object.entries(video.captions ?? {})) {
      assert.ok(LANGS.includes(lang), `${file}: subtitles in an unknown language ${lang}`);
      assert.match(String(path), /\.vtt$/, `${file} (${lang}): subtitles are a .vtt file`);
      assert.ok(mediaExists(path), `${file} (${lang}): subtitles ${path} are missing`);
      if (/^https:/.test(path)) continue;
      const source = readFileSync(path.replace(/^\//, ""), "utf8");
      assert.match(source, /^(\uFEFF)?WEBVTT/, `${file} (${lang}): ${path} must begin with WEBVTT`);
      const transcript = video.locales?.[lang]?.transcript?.trim();
      if (transcript)
        assert.ok(
          timeTranscript(transcript.split(/\n\s*\n/), parseVtt(source)),
          `${file} (${lang}): the subtitles in ${path} do not follow the transcript, so its times cannot be shown`,
        );
    }
    const langs = Object.keys(video.locales ?? {});
    for (const lang of langs) {
      assert.ok(LANGS.includes(lang), `${file}: unknown language ${lang}`);
      const copy = video.locales[lang];
      if (copy?.src !== undefined) {
        assert.ok(typeof copy.src === "string" && copy.src, `${file} (${lang}): src is empty`);
        assert.ok(!/^http:/.test(copy.src), `${file} (${lang}): the film's address must be https`);
        assert.ok(mediaExists(copy.src), `${file} (${lang}): film ${copy.src} is missing`);
      }
      if (!copy?.title?.trim()) continue;
      assert.ok(
        copy.transcript?.trim(),
        `${file} (${lang}): a video with a title needs its transcript`,
      );
    }
    assert.ok(video.locales?.en?.title?.trim(), `${file}: the English title is missing`);
  });
}

test("video ids are unique", () => {
  const ids = files.map((file) => {
    const video = JSON.parse(readFileSync(join(DIR, file), "utf8"));
    return video.id ?? file.slice(0, -5);
  });
  assert.equal(new Set(ids).size, ids.length);
});
