import { createWriteStream, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import PDFDocument from "pdfkit";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const regular = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSerif.ttf");
const bold = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSerif-Bold.ttf");
const ACCENT = "#9f3b00";
const INK = "#171717";
const MUTED = "#616161";
const LEFT = 48;
const BODY_SIZE = 10.5;
const WORDS = {
  en: { sources: "Sources", updated: "Updated", online: "Read online", generated: "AI-generated image", themes: ["Climate", "Environment", "Politics", "Economy", "Science", "Technology", "Culture", "Health"] },
  tr: { sources: "Kaynaklar", updated: "Güncellendi", online: "Sitede oku", generated: "Yapay zekâ ile üretilmiş görsel", themes: ["İklim", "Çevre", "Politika", "Ekonomi", "Bilim", "Teknoloji", "Kültür", "Sağlık"] },
};
const THEMES = ["climate", "environment", "politics", "economy", "science", "technology", "culture", "health"];

/** Private full text and unpublished drafts must never become public static downloads. */
export function pdfReadings(stories, langs) {
  return stories.flatMap(story => {
    if (story.status === "draft" || story.membersOnly === true) return [];
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(story.id)) throw new Error(`Invalid reading ID: ${story.id}`);
    return langs.flatMap(lang => {
      if (!story.locales?.[lang]?.body?.trim()) return [];
      if (!WORDS[lang]) throw new Error(`PDF typography has not been configured for ${lang}`);
      return [{ story, lang }];
    });
  });
}

const dateText = (iso, lang) => new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
}).format(new Date(`${iso}T00:00:00Z`));

export async function writeReadingPdf({ story, lang }, { root, out, site }) {
  const copy = story.locales[lang];
  const words = WORDS[lang];
  const file = join(out, "assets/pdf", lang, `${story.id}.pdf`);
  const address = `${site}${lang === "en" ? "" : `/${lang}`}/read/${story.id}`;
  mkdirSync(dirname(file), { recursive: true });
  const doc = new PDFDocument({
    size: "A4", margins: { top: 88, bottom: 54, left: LEFT, right: LEFT },
    bufferPages: true, lang, font: regular,
    info: {
      Title: copy.title, Author: story.author || "Orbis", Subject: copy.dek || "",
      Creator: "Orbis", Producer: "Orbis",
      CreationDate: new Date(`${story.date}T00:00:00Z`),
      ModDate: new Date(`${story.updatedAt || story.date}T00:00:00Z`),
    },
  });
  const output = createWriteStream(file);
  const finished = new Promise((accept, reject) => {
    output.on("finish", accept);
    output.on("error", reject);
    doc.on("error", reject);
  });
  doc.pipe(output);
  doc.registerFont("Body", regular).registerFont("Heading", bold);
  const width = doc.page.width - LEFT * 2;
  const room = height => {
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
  };

  doc.font("Body").fontSize(9).fillColor(ACCENT)
    .text((words.themes[THEMES.indexOf(story.theme)] || story.theme).toLocaleUpperCase(lang), { characterSpacing: 1.1 });
  doc.moveDown(0.7);
  doc.font("Heading").fontSize(25).fillColor(INK).text(copy.title, { lineGap: 2 });
  if (copy.dek) {
    doc.moveDown(0.45);
    doc.font("Body").fontSize(12).fillColor(MUTED).text(copy.dek, { lineGap: 3 });
  }
  doc.moveDown(0.8);
  doc.font("Body").fontSize(8.5).fillColor(MUTED).text(
    [story.author, copy.region, dateText(story.date, lang)].filter(Boolean).join(" · "),
  );
  if (story.updatedAt && story.updatedAt !== story.date)
    doc.text(`${words.updated}: ${dateText(story.updatedAt, lang)}`);
  doc.moveDown(1.2);

  if (story.image?.src && !/^(?:https?:|data:)/i.test(story.image.src)) {
    const image = resolve(root, story.image.src.replace(/^\//, ""));
    if (!image.startsWith(resolve(root) + sep)) throw new Error("Reading image is outside the repository");
    const { data, info } = await sharp(image).rotate()
      .resize({ width: 1100, height: 440, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const scale = Math.min(width / info.width, 160 / info.height);
    const height = info.height * scale;
    const imageWidth = info.width * scale;
    const caption = [story.image.captions?.[lang] || story.image.credit, words.generated].filter(Boolean).join(" · ");
    doc.font("Body").fontSize(7.5);
    const captionHeight = doc.heightOfString(caption, { width, lineGap: 1 });
    room(height + captionHeight + 28 + BODY_SIZE * 3);
    const top = doc.y;
    doc.image(data, LEFT + (width - imageWidth) / 2, top, { width: imageWidth, height });
    doc.fillColor(MUTED).text(caption, LEFT, top + height + 5, { width, align: "center", lineGap: 1 });
    doc.moveDown(1.5);
  }

  doc.font("Body").fontSize(BODY_SIZE).fillColor(INK);
  for (const paragraph of copy.body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)) {
    const height = doc.heightOfString(paragraph, { width, lineGap: 4, paragraphGap: 9 });
    room(Math.min(height, doc.page.height - doc.page.margins.top - doc.page.margins.bottom));
    doc.text(paragraph, LEFT, doc.y, { width, lineGap: 4, paragraphGap: 9 });
  }

  const sources = [...(story.sources || [])].sort((a, b) => a.n - b.n);
  if (sources.length) {
    room(82);
    doc.moveDown(0.7);
    doc.moveTo(LEFT, doc.y).lineTo(LEFT + width, doc.y).strokeColor("#d6d6d6").lineWidth(0.5).stroke();
    doc.moveDown(0.6);
    doc.font("Heading").fontSize(11).fillColor(ACCENT).text(words.sources);
    doc.moveDown(0.55);
    for (const source of sources) {
      const url = /^https?:\/\//i.test(source.url || "") ? source.url : "";
      doc.font("Body").fontSize(8.5);
      room(doc.heightOfString(`${source.n}. ${source.label}`, { width, lineGap: 2 })
        + (url ? doc.heightOfString(url, { width, lineGap: 1 }) : 0) + 12);
      doc.fillColor(INK).text(`${source.n}. ${source.label}`, LEFT, doc.y, { width, lineGap: 2 });
      if (url) doc.fillColor(MUTED).text(url, { width, lineGap: 1, link: url });
      doc.moveDown(0.7);
    }
  }
  const pages = doc.bufferedPageRange();
  for (let page = pages.start; page < pages.start + pages.count; page++) {
    doc.switchToPage(page);
    doc.font("Heading").fontSize(22).fillColor(INK).text("ORBIS", LEFT, 34, { lineBreak: false, characterSpacing: 4 });
    doc.font("Body").fontSize(8).fillColor(MUTED).text("the reading atlas", LEFT, 59, { lineBreak: false });
    doc.moveTo(LEFT, 76).lineTo(LEFT + width, 76).strokeColor(ACCENT).lineWidth(0.6).stroke();
    doc.font("Body").fontSize(8).fillColor(MUTED)
      .text(`${words.online}: ${new URL(site).hostname}`, LEFT, doc.page.height - 34, { lineBreak: false, link: address });
    const number = `${page + 1} / ${pages.count}`;
    doc.text(number, LEFT + width - doc.widthOfString(number), doc.page.height - 34, { lineBreak: false });
  }
  doc.end();
  await finished;
  return file;
}

export async function writeReadingPdfs(root = process.cwd(), out = join(root, "dist/client")) {
  const types = readFileSync(join(root, "src/lib/types.ts"), "utf8");
  const langs = [...types.match(/export const LANGS = \[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
  const site = readFileSync(join(root, "src/lib/site.ts"), "utf8").match(/SITE_URL = "([^"]+)"/)[1];
  const stories = readdirSync(join(root, "content/stories")).filter(f => f.endsWith(".json"))
    .map(file => JSON.parse(readFileSync(join(root, "content/stories", file), "utf8")));
  const readings = pdfReadings(stories, langs);
  for (const reading of readings) await writeReadingPdf(reading, { root, out, site });
  console.log(`[pdf] ${readings.length} public readings ready to download`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await writeReadingPdfs();
