import {
  commit,
  dataUrlBase64,
  PublishError,
  readRepoFile,
  textToBase64,
  type Change,
} from "@/lib/github";
import { mediaPath, mediaUrl } from "@/lib/seed";
import { ALL_LANGS as LANGS, type Story } from "@/lib/types";

/**
 * Turns a saved reading into repository changes:
 * - content/stories/<id>.json holds the text, sources and media paths;
 * - a newly chosen recording goes to audio/ (the build copies it to audio/);
 * - a newly chosen picture goes to images/ at the site root, served as it is;
 * - media the reading no longer uses is deleted.
 * New media gets a fresh name each time, so a replaced file is never served from cache.
 */

const AUDIO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
};

function audioExt(mime: string, name: string): string {
  const fromName = /\.([a-z0-9]{2,4})$/i.exec(name)?.[1]?.toLowerCase();
  return AUDIO_EXT[mime] ?? fromName ?? "mp3";
}

function stamp(): string {
  return Date.now().toString(36);
}

/** Where a stored media path lives in the repository. */
export function repoPathOf(stored: string): string | null {
  if (/^(audio|images|videos)\//.test(stored)) return stored;
  return null;
}

function mediaOf(story: Story | undefined): Set<string> {
  const out = new Set<string>();
  if (!story) return out;
  for (const lang of LANGS) {
    const audio = story.locales[lang].audio;
    if (audio && !audio.dataUrl.startsWith("data:")) out.add(mediaPath(audio.dataUrl));
  }
  if (story.image && !story.image.src.startsWith("data:")) out.add(mediaPath(story.image.src));
  return out;
}

/** Where a reading's file lives in the repository. */
export function storyFile(id: string): string {
  return `content/stories/${id}.json`;
}

/** The reading in a file's text, or undefined when there is no file or it cannot be read. */
export function parseStoryFile(text: string | null | undefined): Story | undefined {
  if (!text) return undefined;
  try {
    const story = JSON.parse(text) as Story;
    return story && typeof story === "object" && story.locales ? story : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Publishes the draft as one commit.
 *
 * `base` is the reading's file as it was in the repository when editing began (null: it
 * did not exist yet). If the file is different now, someone saved the reading from another
 * tab or device in the meantime: nothing is written, and a "stale" error is raised, so the
 * newer text is never overwritten silently. Without a `base`, the check is skipped.
 *
 * Returns the reading as the site will show it, and the file text that was written.
 */
export async function publishStory(
  token: string,
  draft: Story,
  before: Story | undefined,
  base?: string | null,
): Promise<{ shown: Story; text: string }> {
  const path = storyFile(draft.id);
  if (base !== undefined) {
    const now = await readRepoFile(token, path);
    if (now !== base) throw new PublishError("stale", "changed elsewhere");
  }
  // Media to clean up is judged against the file being replaced, when it is known.
  const previous = parseStoryFile(base) ?? before;
  const changes: Change[] = [];
  const file = structuredClone(draft);
  // Only a draft carries a status: a file without one is published, as every older file is.
  if (file.status !== "draft") delete file.status;
  if (file.author?.trim()) file.author = file.author.trim();
  else delete file.author;
  if (!file.updatedAt?.trim()) delete file.updatedAt;
  const when = stamp();

  for (const lang of LANGS) {
    const audio = file.locales[lang].audio;
    if (!audio) continue;
    if (audio.dataUrl.startsWith("data:")) {
      const stored = `audio/${file.id}-${lang}-${when}.${audioExt(audio.mime, audio.name)}`;
      changes.push({ path: stored, base64: dataUrlBase64(audio.dataUrl) });
      audio.dataUrl = stored;
    } else {
      audio.dataUrl = mediaPath(audio.dataUrl);
    }
  }

  if (file.image) {
    if (file.image.src.startsWith("data:")) {
      const stored = `images/${file.id}-${when}.jpg`;
      changes.push({ path: stored, base64: dataUrlBase64(file.image.src) });
      file.image.src = stored;
    } else {
      file.image.src = mediaPath(file.image.src);
    }
    file.image.credit = file.image.credit.trim();
    const captions = Object.fromEntries(
      Object.entries(file.image.captions ?? {})
        .map(([lang, line]) => [lang, (line ?? "").trim()])
        .filter(([, line]) => line),
    );
    if (Object.keys(captions).length) file.image.captions = captions;
    else delete file.image.captions;
  } else {
    delete file.image;
  }

  // A video is placed in videos/ by hand; the panel only keeps its paths as stored.
  if (file.video) {
    file.video.src = mediaPath(file.video.src);
    if (file.video.poster) file.video.poster = mediaPath(file.video.poster);
    else delete file.video.poster;
  }

  const keep = mediaOf(file);
  for (const old of mediaOf(previous)) {
    const path = repoPathOf(old);
    if (path && !keep.has(old)) changes.push({ path, base64: null });
  }

  const text = `${JSON.stringify(file, null, 2)}\n`;
  changes.push({ path, base64: textToBase64(text) });
  const title = LANGS.map((lang) => file.locales[lang].title.trim()).find(Boolean) ?? file.id;
  await commit(token, `Panel: ${title}`, changes);

  // What the site will show once rebuilt, with media addressed as the pages serve it.
  const shown = structuredClone(file);
  for (const lang of LANGS) {
    const audio = shown.locales[lang].audio;
    if (audio) audio.dataUrl = mediaUrl(audio.dataUrl);
  }
  if (shown.image) shown.image.src = mediaUrl(shown.image.src);
  if (shown.video) {
    shown.video.src = mediaUrl(shown.video.src);
    if (shown.video.poster) shown.video.poster = mediaUrl(shown.video.poster);
  }
  return { shown, text };
}

export async function unpublishStory(token: string, story: Story): Promise<void> {
  const changes: Change[] = [{ path: storyFile(story.id), base64: null }];
  for (const old of mediaOf(story)) {
    const path = repoPathOf(old);
    if (path) changes.push({ path, base64: null });
  }
  const title = LANGS.map((lang) => story.locales[lang].title.trim()).find(Boolean) ?? story.id;
  await commit(token, `Panel: remove ${title}`, changes);
}

/** A picture from the phone or computer, scaled to at most 2000 px on its long side as JPEG. */
export async function prepareImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image"));
      el.src = url;
    });
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = long > 2000 ? 2000 / long : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
