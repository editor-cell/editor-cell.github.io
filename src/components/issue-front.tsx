import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ListenButton } from "@/components/read-time";
import { imageSizes } from "@/lib/breakpoints";
import { imageCaption } from "@/lib/editorial";
import { imageSet } from "@/lib/image-set";
import { langMeta, useCopy } from "@/lib/i18n";
import { mediaLink, readLink, videoLink } from "@/lib/lang-path";
import { formatDate, storyTitle } from "@/lib/text";
import {
  THEMES,
  type Lang,
  type StoryCard as Story,
  type StoryImage,
  type Theme,
} from "@/lib/types";
import { formatDuration, videoWords, videosIn } from "@/lib/videos";

/** Homepage-only composition. Phone and desktop layouts remain in separate sheets.
 * The shell, reader, membership, typography and language navigation are untouched.
 * Published cards and videos remain the source of every title, summary and link. */
const EN = {
  weekly: "The weekly edition",
  motto: "Good questions. Lasting perspectives.",
  selection: "Editor’s selection",
  explore: "Follow your curiosity.",
  exploreNote: "Make time for a good read",
  all: "All stories",
  read: "Read the story",
  note: "Less noise. More perspective. Something to take with you.",
  film: "Orbis in motion",
  filmTitle: "A different way to see.",
  archive: "From the archive",
  archiveNote: "More ideas to spend time with.",
  generated: "AI-generated illustration",
};
const TR: typeof EN = {
  weekly: "Haftalık sayı",
  motto: "İyi sorular. Kalıcı bakış açıları.",
  selection: "Editörün seçkisi",
  explore: "Merakınızın peşinden gidin.",
  exploreNote: "İyi bir yazıya zaman ayırın",
  all: "Bütün yazılar",
  read: "Yazıyı oku",
  note: "Daha az gürültü. Daha geniş bir bakış. Yanınızda götüreceğiniz bir düşünce.",
  film: "Hareketli Orbis",
  filmTitle: "Görmenin başka bir yolu.",
  archive: "Arşivden",
  archiveNote: "Üzerinde düşünmeye değer başka fikirler.",
  generated: "Yapay zekâ ile üretilmiş görsel",
};
const wordsFor = (lang: Lang) => (lang === "tr" ? TR : EN);

/** These original generated pictures belong only to the homepage, never to the reader. */
const HOME_IMAGES: Record<string, StoryImage> = {
  "climate-struggle": {
    src: "/images/home-climate-energy.jpg",
    credit: "Wind turbines above green fields beneath a clouded sky. AI-generated illustration.",
    captions: {
      tr: "Bulutlu bir gökyüzünün altında, yeşil tarlaların üzerindeki rüzgâr türbinleri. Yapay zekâ ile üretilmiş görsel.",
    },
  },
  "bread-and-diabetes": {
    src: "/images/home-bread.jpg",
    credit: "Wholegrain bread and wheat on a linen-covered table. AI-generated illustration.",
    captions: {
      tr: "Keten örtülü masada tam tahıllı ekmek ve buğday. Yapay zekâ ile üretilmiş görsel.",
    },
  },
  "consumption-and-wellbeing": {
    src: "/images/home-market.jpg",
    credit:
      "Seasonal produce and a reusable bag at a quiet market stall. AI-generated illustration.",
    captions: {
      tr: "Sakin bir pazar tezgâhında mevsimlik ürünler ve bez alışveriş çantası. Yapay zekâ ile üretilmiş görsel.",
    },
  },
};

function summary(story: Story, lang: Lang) {
  const text = (story.locales[lang].dek?.trim() || story.locales[lang].lead)
    .replace(/\s+/g, " ")
    .trim();
  return text.match(/^.*?[.!?؟۔](?=\s|$)/)?.[0] || text;
}

function Picture({ story, lang, eager = false }: { story: Story; lang: Lang; eager?: boolean }) {
  const picture = HOME_IMAGES[story.id] ?? story.image;
  if (!picture) return null;
  return (
    <img
      src={picture.src}
      {...imageSet(picture.src, imageSizes(eager ? "55vw" : "24vw", "calc(100vw - 40px)"))}
      alt={imageCaption(picture, lang)}
      width={1500}
      height={1000}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
    />
  );
}

function Time({ story, lang }: { story: Story; lang: Lang }) {
  const copy = useCopy(lang);
  const minutes = story.locales[lang].minutes;
  return minutes ? (
    <span className="if-time">{copy.minRead.replace("{n}", String(minutes))}</span>
  ) : null;
}

function Actions({ story, lang, lead = false }: { story: Story; lang: Lang; lead?: boolean }) {
  return (
    <div className="if-actions">
      <Time story={story} lang={lang} />
      <div className="if-action-links">
        {lead ? (
          <Link {...readLink(lang, story.id)} className="if-read-link">
            {wordsFor(lang).read}{" "}
            <ArrowUpRight
              size={15}
              aria-hidden="true"
              style={{ display: "inline", verticalAlign: "middle" }}
            />
          </Link>
        ) : null}
        <ListenButton story={story} lang={lang} solid={lead} />
      </div>
    </div>
  );
}

function Cover({ story, lang }: { story: Story; lang: Lang }) {
  const copy = useCopy(lang);
  return (
    <article className="if-cover">
      {(HOME_IMAGES[story.id] ?? story.image) ? (
        <Link
          {...readLink(lang, story.id)}
          className="if-cover-picture"
          tabIndex={-1}
          aria-hidden="true"
        >
          <Picture story={story} lang={lang} eager />
        </Link>
      ) : null}
      <div className="if-cover-copy">
        <p className="if-section">{copy.themes[story.theme]}</p>
        <h2 className="if-title if-cover-title">
          <Link {...readLink(lang, story.id)}>{storyTitle(story, lang)}</Link>
        </h2>
        <p className="if-dek">{summary(story, lang)}</p>
        <Actions story={story} lang={lang} lead />
      </div>
    </article>
  );
}

function Entry({ story, lang, n }: { story: Story; lang: Lang; n: number }) {
  const copy = useCopy(lang);
  return (
    <li className="if-entry">
      <div className="if-entry-kicker">
        <span className="if-num" aria-hidden="true">
          {String(n).padStart(2, "0")}
        </span>
        <span className="if-section">{copy.themes[story.theme]}</span>
      </div>
      <h3 className="if-title if-entry-title">
        <Link {...readLink(lang, story.id)}>{storyTitle(story, lang)}</Link>
      </h3>
      <p className="if-dek">{summary(story, lang)}</p>
      <Actions story={story} lang={lang} />
    </li>
  );
}

function Card({ story, lang }: { story: Story; lang: Lang }) {
  const copy = useCopy(lang);
  return (
    <article className="if-card">
      {(HOME_IMAGES[story.id] ?? story.image) ? (
        <Link
          {...readLink(lang, story.id)}
          className="if-card-picture"
          tabIndex={-1}
          aria-hidden="true"
        >
          <Picture story={story} lang={lang} />
        </Link>
      ) : null}
      <p className="if-section">{copy.themes[story.theme]}</p>
      <h3 className="if-title if-card-title">
        <Link {...readLink(lang, story.id)}>{storyTitle(story, lang)}</Link>
      </h3>
      <p className="if-dek">{summary(story, lang)}</p>
      <Actions story={story} lang={lang} />
    </article>
  );
}

function VideoPanel({ lang }: { lang: Lang }) {
  const [video, ...more] = videosIn(lang);
  if (!video) return null;
  const words = videoWords(lang);
  const front = wordsFor(lang);
  const locale = video.locales[lang];
  return (
    <section className="if-band" data-media-strip aria-labelledby="if-videos">
      <div className="if-head">
        <div>
          <p className="if-overline">{front.film}</p>
          <h2 id="if-videos" className="if-head-title">
            {front.filmTitle}
          </h2>
        </div>
        <Link {...mediaLink(lang)} className="if-head-link">
          {words.showAll}{" "}
          <ArrowUpRight
            size={15}
            aria-hidden="true"
            style={{ display: "inline", verticalAlign: "middle" }}
          />
        </Link>
      </div>
      <div className="if-film-grid">
        <Link
          {...videoLink(lang, video.id)}
          className="if-video-still"
          aria-label={`${words.play}: ${locale?.title}`}
        >
          {video.poster ? (
            <img
              src={video.poster}
              {...imageSet(video.poster, imageSizes("50vw", "calc(100vw - 40px)"))}
              alt=""
              width={1600}
              height={900}
              loading="lazy"
              decoding="async"
            />
          ) : null}
          <span className="if-video-play" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
          {video.duration ? (
            <span className="if-video-time" dir="ltr">
              {formatDuration(video.duration)}
            </span>
          ) : null}
        </Link>
        <div className="if-film-copy">
          <p className="if-overline">{words.video}</p>
          <h3 className="if-film-title">
            <Link {...videoLink(lang, video.id)}>{locale?.title}</Link>
          </h3>
          <p>{locale?.dek}</p>
          <Link {...videoLink(lang, video.id)} className="if-film-link">
            {words.play}{" "}
            <ArrowUpRight
              size={15}
              aria-hidden="true"
              style={{ display: "inline", verticalAlign: "middle" }}
            />
          </Link>
        </div>
      </div>
      {more.length ? (
        <ul className="if-film-more">
          {more.map((v) => (
            <li key={v.id}>
              <Link {...videoLink(lang, v.id)}>
                {v.locales[lang]?.title} <span dir="ltr">{formatDuration(v.duration)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function IssueFront({ stories, lang }: { stories: Story[]; lang: Lang }) {
  const [selected, setSelected] = useState<Theme | "all">("all");
  const [lead] = stories;
  const copy = useCopy(lang);
  if (!lead) return null;
  const words = wordsFor(lang);
  const editors = stories.slice(1, 4);
  const cards =
    selected === "all" ? stories.slice(4, 8) : stories.filter((story) => story.theme === selected);
  const archive = stories.slice(8);
  const themes = THEMES.filter((theme) => stories.some((story) => story.theme === theme));
  return (
    <div className="issue-front" dir={langMeta[lang].dir}>
      <div className="if-issue-line">
        <span>
          {words.weekly}
          {lead.issue !== undefined ? ` · ${lang === "tr" ? "Sayı" : "Issue"} ${lead.issue}` : ""}
        </span>
        <span>{formatDate(lead.date, lang)}</span>
      </div>
      <div className="if-opening">
        <Cover story={lead} lang={lang} />
        {editors.length ? (
          <aside className="if-editors" aria-labelledby="if-selection">
            <h2 id="if-selection" className="if-selection-title">
              {words.selection} <ArrowDownRight size={18} aria-hidden="true" />
            </h2>
            <ol className="if-list">
              {editors.map((story, i) => (
                <Entry key={story.id} story={story} lang={lang} n={i + 1} />
              ))}
            </ol>
            <p className="if-editor-note">{words.note}</p>
          </aside>
        ) : null}
      </div>
      {stories.length > 4 ? (
        <section className="if-explore" aria-labelledby="if-explore-title">
          <div className="if-head">
            <div>
              <p className="if-overline">{words.exploreNote}</p>
              <h2 id="if-explore-title" className="if-head-title">
                {words.explore}
              </h2>
            </div>
          </div>
          <div className="if-filters" aria-label={words.explore}>
            <button
              type="button"
              aria-pressed={selected === "all"}
              onClick={() => setSelected("all")}
            >
              {words.all}
            </button>
            {themes.map((theme) => (
              <button
                key={theme}
                type="button"
                aria-pressed={selected === theme}
                onClick={() => setSelected(theme)}
              >
                {copy.themes[theme]}
              </button>
            ))}
          </div>
          <div className="if-grid" aria-live="polite">
            {cards.map((story) => (
              <Card key={story.id} story={story} lang={lang} />
            ))}
          </div>
        </section>
      ) : null}
      <VideoPanel lang={lang} />
      {archive.length ? (
        <section className="if-archive" aria-labelledby="if-archive-title">
          <div className="if-head">
            <h2 id="if-archive-title" className="if-head-title">
              {words.archive}
            </h2>
            <p className="if-archive-note">{words.archiveNote}</p>
          </div>
          <div className="if-grid">
            {archive.map((story) => (
              <Card key={story.id} story={story} lang={lang} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
