import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Prose } from "@/components/prose";
import { langMeta } from "@/lib/i18n";
import { readLink, rememberLang } from "@/lib/lang-path";
import { hasCopy, paragraphs } from "@/lib/text";
import { LANGS, type Lang, type Story } from "@/lib/types";

/**
 * Twin reading: the reading in two languages at once, for comparing them or learning one.
 * The reader picks the main text first and the twin second. The main text is the page's own
 * language: its title, its audio and its sources lead. The twin is text only, beside the
 * main text on a wide screen, under each of its paragraphs on a phone, paragraph by
 * paragraph. The choice is kept in this browser, so the next reading opens the same way.
 */

const TWIN_KEY = "orbis-twin";

type TwinWords = {
  button: string;
  title: string;
  main: string;
  twin: string;
  off: string;
  note: string;
};

const WORDS: Record<Lang, TwinWords> = {
  tr: {
    button: "İkiz okuma",
    title: "İkiz okuma",
    main: "Asıl metin",
    twin: "İkiz metin",
    off: "Kapalı",
    note: "Ses asıl metnin dilinde çalar; ikiz metin yalnız yazı olarak görünür.",
  },
  en: {
    button: "Twin reading",
    title: "Twin reading",
    main: "Main text",
    twin: "Twin text",
    off: "Off",
    note: "The audio plays in the main text's language; the twin shows as text only.",
  },
  ar: {
    button: "قراءة مزدوجة",
    title: "قراءة مزدوجة",
    main: "النص الأساسي",
    twin: "النص المرافق",
    off: "إيقاف",
    note: "يُشغَّل الصوت بلغة النص الأساسي؛ ويظهر النص المرافق مكتوبًا فقط.",
  },
  fr: {
    button: "Lecture jumelée",
    title: "Lecture jumelée",
    main: "Texte principal",
    twin: "Texte jumeau",
    off: "Désactivée",
    note: "L’audio suit la langue du texte principal ; le jumeau s’affiche en texte seul.",
  },
  es: {
    button: "Lectura gemela",
    title: "Lectura gemela",
    main: "Texto principal",
    twin: "Texto gemelo",
    off: "Desactivada",
    note: "El audio sigue el idioma del texto principal; el gemelo se muestra solo como texto.",
  },
};

export function twinWords(lang: Lang): TwinWords {
  return WORDS[lang];
}

/** The languages this reading is written in, in menu order. */
export function writtenLangs(story: Story): Lang[] {
  return LANGS.filter((code) => hasCopy(story, code));
}

function readTwin(): Lang | null {
  try {
    const saved = localStorage.getItem(TWIN_KEY);
    return saved && (LANGS as readonly string[]).includes(saved) ? (saved as Lang) : null;
  } catch {
    return null;
  }
}

function writeTwin(value: Lang | null) {
  try {
    if (value) localStorage.setItem(TWIN_KEY, value);
    else localStorage.removeItem(TWIN_KEY);
  } catch {
    /* private window: the choice lasts until the page closes */
  }
}

/**
 * The twin language in use on this reading, or null. A saved twin that is the page's own
 * language, or that this reading is not written in, is simply not shown; nor is any twin
 * while `allowed` is false (a members-only reading for a reader without its full text).
 */
export function useTwin(
  story: Story | null,
  lang: Lang,
  allowed: boolean,
): [Lang | null, (next: Lang | null) => void] {
  const [saved, setSaved] = useState<Lang | null>(null);
  useEffect(() => setSaved(readTwin()), []);
  const choose = (next: Lang | null) => {
    setSaved(next);
    writeTwin(next);
  };
  const usable =
    allowed && story && saved && saved !== lang && hasCopy(story, saved) ? saved : null;
  return [usable, choose];
}

/** The pill in the reading tools that opens the twin panel. */
export function TwinButton({
  lang,
  on,
  open,
  onToggle,
}: {
  lang: Lang;
  on: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const words = WORDS[lang];
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls="twin-panel"
      onClick={onToggle}
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs md:h-8 ${
        on ? "border-ink bg-ink text-paper" : "border-line text-ink"
      }`}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        aria-hidden="true"
        className="size-[14px]"
      >
        <rect x="2.5" y="3.5" width="7" height="13" rx="0.5" />
        <rect x="10.5" y="3.5" width="7" height="13" rx="0.5" />
        <path d="M4.5 7h3M4.5 9.5h3M4.5 12h3M12.5 7h3M12.5 9.5h3M12.5 12h3" />
      </svg>
      {words.button}
    </button>
  );
}

/**
 * The two choices, in the order the reader makes them: first the main text, then its twin.
 * Choosing another main language opens the same reading in that language; the twin moves
 * aside if it was that language.
 */
export function TwinPanel({
  story,
  lang,
  twin,
  choose,
}: {
  story: Story;
  lang: Lang;
  twin: Lang | null;
  choose: (next: Lang | null) => void;
}) {
  const words = WORDS[lang];
  const navigate = useNavigate();
  const langs = writtenLangs(story);
  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center border px-3 text-sm ${
      active ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink"
    }`;
  const label =
    lang === "ar" ? "text-sm text-pine" : "text-xs uppercase tracking-[0.14em] text-pine";

  const pickMain = (code: Lang) => {
    if (code === lang) return;
    // The page's language was the main text; when the reader swaps, it becomes the twin.
    const nextTwin = twin === code || twin === null ? lang : twin;
    choose(nextTwin);
    rememberLang(code);
    void navigate(readLink(code, story.id));
  };

  return (
    <section
      id="twin-panel"
      aria-label={words.title}
      className="no-print flex flex-col gap-3 border-b border-line pb-4"
    >
      <div className="flex flex-col gap-1.5">
        <p className={label}>1 · {words.main}</p>
        <div className="flex flex-wrap gap-2">
          {langs.map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={code === lang}
              onClick={() => pickMain(code)}
              lang={langMeta[code].html}
              className={chip(code === lang)}
            >
              {langMeta[code].name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className={label}>2 · {words.twin}</p>
        <div className="flex flex-wrap gap-2">
          {langs
            .filter((code) => code !== lang)
            .map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={twin === code}
                onClick={() => choose(code)}
                lang={langMeta[code].html}
                className={chip(twin === code)}
              >
                {langMeta[code].name}
              </button>
            ))}
          <button
            type="button"
            aria-pressed={twin === null}
            onClick={() => choose(null)}
            className={chip(twin === null)}
          >
            {words.off}
          </button>
        </div>
      </div>
      <p className="text-xs leading-snug text-muted">{words.note}</p>
    </section>
  );
}

/**
 * The twin's title and summary under the main ones, in a quieter ink.
 */
export function TwinHeading({ story, twin }: { story: Story; twin: Lang }) {
  const copy = story.locales[twin];
  const meta = langMeta[twin];
  return (
    <div
      lang={meta.html}
      dir={meta.dir}
      className="twin-heading flex flex-col gap-1 border-s-2 border-line ps-3"
    >
      <p className="text-[0.7rem] uppercase tracking-[0.14em] text-muted">{meta.name}</p>
      <p className="paper-title text-xl leading-tight text-ink/75 md:text-2xl">{copy.title}</p>
      {copy.dek ? <p className="text-[0.95rem] leading-snug text-muted">{copy.dek}</p> : null}
    </div>
  );
}

/**
 * The text in pairs: each paragraph of the main text with the same paragraph of the twin.
 * On a wide screen the pair sits side by side, on a phone the twin follows under its
 * paragraph. When one text has more paragraphs, the extra ones close the list on their side.
 */
export function TwinProse({
  main,
  twin,
  mainLang,
  twinLang,
  sourceNums,
  sourceWord,
}: {
  main: string;
  twin: string;
  mainLang: Lang;
  twinLang: Lang;
  sourceNums: Set<number>;
  sourceWord: string;
}) {
  const left = paragraphs(main);
  const right = paragraphs(twin);
  const rows = Math.max(left.length, right.length);
  const mainMeta = langMeta[mainLang];
  const twinMeta = langMeta[twinLang];
  return (
    <div className="twin-prose">
      <div className="twin-heads" aria-hidden="true">
        <p lang={mainMeta.html}>{mainMeta.name}</p>
        <p lang={twinMeta.html}>{twinMeta.name}</p>
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="twin-row">
          <div lang={mainMeta.html} dir={mainMeta.dir} className="twin-main">
            {left[i] ? (
              <Prose
                body={left[i]}
                sourceNums={sourceNums}
                sourceWord={sourceWord}
                first={i === 0}
              />
            ) : null}
          </div>
          <div lang={twinMeta.html} dir={twinMeta.dir} className="twin-side">
            {right[i] ? (
              <Prose
                body={right[i]}
                sourceNums={sourceNums}
                sourceWord={sourceWord}
                first={false}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
