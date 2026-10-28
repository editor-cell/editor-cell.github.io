import { normalizeTheme, type Story } from "./types.ts";

/**
 * Unpublished changes in the panel, kept in this browser so that a reload, a closed tab
 * or a phone clearing the page in the background does not lose them. One draft per
 * editor address: the reading's id, or "new" for a reading not yet published.
 *
 * Along with the draft goes the reading's file as it was in the repository when editing
 * began (`base`), so the check before publishing still works after the draft is restored.
 *
 * Browser storage holds a few megabytes. A newly chosen recording or picture can be larger;
 * then the draft is kept without it and `mediaDropped` says so.
 */

const PREFIX = "orbis-draft:";

export type SavedDraft = {
  story: Story;
  /** Whether `base` was known when the draft was saved. */
  hasBase: boolean;
  base: string | null;
  mediaDropped: boolean;
  savedAt: number;
};

function key(editorId: string): string {
  return `${PREFIX}${editorId}`;
}

export function loadDraft(editorId: string): SavedDraft | null {
  try {
    const raw = localStorage.getItem(key(editorId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedDraft;
    if (!saved?.story?.locales) return null;
    saved.story.theme = normalizeTheme(saved.story.theme);
    return saved;
  } catch {
    return null;
  }
}

/** Media chosen in the panel but not yet published lives in the draft as a data: address. */
function withoutNewMedia(story: Story): { story: Story; dropped: boolean } {
  const copy = structuredClone(story);
  let dropped = false;
  for (const lang of Object.keys(copy.locales) as (keyof Story["locales"])[]) {
    const audio = copy.locales[lang].audio;
    if (audio?.dataUrl.startsWith("data:")) {
      copy.locales[lang] = { ...copy.locales[lang], audio: null };
      dropped = true;
    }
  }
  if (copy.image?.src.startsWith("data:")) {
    delete copy.image;
    dropped = true;
  }
  return { story: copy, dropped };
}

/** Saves the draft; returns false only when the browser would not store anything at all. */
export function saveDraft(
  editorId: string,
  story: Story,
  base: string | null | undefined,
): boolean {
  const entry = (s: Story, mediaDropped: boolean): string =>
    JSON.stringify({
      story: s,
      hasBase: base !== undefined,
      base: base ?? null,
      mediaDropped,
      savedAt: Date.now(),
    } satisfies SavedDraft);
  try {
    localStorage.setItem(key(editorId), entry(story, false));
    return true;
  } catch {
    // Too large with the new recording or picture in it: keep the text at least.
  }
  const light = withoutNewMedia(story);
  try {
    localStorage.setItem(key(editorId), entry(light.story, light.dropped));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(editorId: string) {
  try {
    localStorage.removeItem(key(editorId));
  } catch {
    /* nothing to clear */
  }
}
