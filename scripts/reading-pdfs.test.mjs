import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pdfReadings, writeReadingPdf } from "./reading-pdfs.mjs";

const story = { id: "example", locales: { en: { body: "English text." }, tr: { body: "Türkçe metin." }, ar: { body: "نص" } } };

test("PDF downloads contain only published public readings in active languages", () => {
  const stories = [story, { ...story, id: "draft", status: "draft" }, { ...story, id: "private", membersOnly: true },
    { ...story, id: "empty", locales: { en: { body: "  " } } }];
  assert.deepEqual(pdfReadings(stories, ["en", "tr"]).map(x => [x.story.id, x.lang]), [["example", "en"], ["example", "tr"]]);
});

test("invalid PDF paths and an unconfigured writing system stop publication", () => {
  assert.throws(() => pdfReadings([{ ...story, id: "../private" }], ["en"]), /Invalid reading ID/);
  assert.throws(() => pdfReadings([story], ["ar"]), /typography has not been configured/);
});

test("page numbers do not create extra pages in a short downloadable reading", async () => {
  const out = await mkdtemp(join(tmpdir(), "orbis-pdf-"));
  try {
    const file = await writeReadingPdf({
      story: { ...story, theme: "science", date: "2026-10-09", sources: [{ n: 1, label: "Source", url: "https://example.org/source" }],
        locales: { tr: { title: "Türkçe okuma", dek: "İçerik ve kaynakları.", body: "İstanbul'da güneş, gölge, ışık ve yağmur. [1]" } } },
      lang: "tr",
    }, { root: out, out, site: "https://example.org" });
    const pdf = (await readFile(file)).toString("latin1");
    assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, 1);
    assert.ok(pdf.includes("https://example.org/source"));
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
