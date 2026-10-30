import { Link } from "@tanstack/react-router";
import { Globe } from "@/components/globe";
import { OrbisLockup } from "@/components/orbis-lockup";
import { ListenButton } from "@/components/read-time";
import { FrameRow } from "@/components/shell";
import { imageSizes } from "@/lib/breakpoints";
import { imageCaption, visibleCaption } from "@/lib/editorial";
import { imageSet } from "@/lib/image-set";
import { langMeta, useCopy } from "@/lib/i18n";
import { homeLink, mediaLink, readLink, sectionLink, videoLink } from "@/lib/lang-path";
import { placeIndex, placeLine } from "@/lib/places";
import { TRIAL } from "@/lib/site";
import { formatDate, storyTitle } from "@/lib/text";
import type { Lang, StoryCard as Story } from "@/lib/types";
import { formatDuration, videoWords, videosIn } from "@/lib/videos";

/**
 * The front page as the opening of a bound atlas (30 Oct 2026). The cover first: the
 * cloth, the name in gilt, the issue and its first reading, its photograph tipped in like a
 * plate. Then the contents, numbered in the order of the issue; the videos; earlier issues as
 * small cloth covers; the other readings; and, last, the index of places, as at the back of
 * an atlas: every place the readings compare, with the readings that compare it.
 */

const WORDS: Record<
  Lang,
  {
    issue: string;
    preview: string;
    selection: string;
    contents: string;
    count: string;
    archive: string;
    shelf: string;
    previous: string;
    index: string;
    indexNote: string;
    plate: string;
  }
> = {
  en: {
    issue: "Issue {n}",
    preview: "Preview issue",
    selection: "Selected readings",
    contents: "Contents",
    count: "{n} readings",
    archive: "From the archive",
    shelf: "Earlier issues",
    previous: "Previous issue",
    index: "Index of places",
    indexNote: "Every place the readings compare.",
    plate: "AI-generated image",
  },
  tr: {
    issue: "Sayı {n}",
    preview: "Deneme sayısı",
    selection: "Seçilmiş okumalar",
    contents: "İçindekiler",
    count: "{n} yazı",
    archive: "Arşivden",
    shelf: "Önceki sayılar",
    previous: "Önceki sayı",
    index: "Yer adları dizini",
    indexNote: "Yazıların karşılaştırdığı bütün yerler.",
    plate: "Yapay zekâ ile üretilmiş görsel",
  },
  ar: {
    issue: "العدد {n}",
    preview: "عدد تجريبي",
    selection: "قراءات مختارة",
    contents: "المحتويات",
    count: "{n} مقالات",
    archive: "من الأرشيف",
    shelf: "أعداد سابقة",
    previous: "العدد السابق",
    index: "فهرس الأماكن",
    indexNote: "كل الأماكن التي تقارن بينها القراءات.",
    plate: "صورة مولّدة بالذكاء الاصطناعي",
  },
  fr: {
    issue: "Numéro {n}",
    preview: "Numéro d’essai",
    selection: "Lectures choisies",
    contents: "Sommaire",
    count: "{n} lectures",
    archive: "Dans les archives",
    shelf: "Numéros précédents",
    previous: "Numéro précédent",
    index: "Index des lieux",
    indexNote: "Tous les lieux que les lectures comparent.",
    plate: "Image générée par IA",
  },
  es: {
    issue: "Número {n}",
    preview: "Número de prueba",
    selection: "Lecturas escogidas",
    contents: "Sumario",
    count: "{n} lecturas",
    archive: "Del archivo",
    shelf: "Números anteriores",
    previous: "Número anterior",
    index: "Índice de lugares",
    indexNote: "Todos los lugares que comparan las lecturas.",
    plate: "Imagen generada por IA",
  },
};

/** Without issue numbers yet, the newest eight readings stand in for an issue. */
const PREVIEW_SIZE = 8;

/** The first sentence of the summary (or of the text, when there is no summary). */
function summary(story: Story, lang: Lang): string {
  const text = (story.locales[lang].dek?.trim() || story.locales[lang].lead)
    .replace(/\s+/g, " ")
    .trim();
  return text.match(/^.*?[.!?؟۔](?=\s|$)/)?.[0] || text;
}

function newestDate(stories: Story[]): string {
  return stories.reduce((max, story) => (story.date > max ? story.date : max), "");
}

function Minutes({ story, lang }: { story: Story; lang: Lang }) {
  const copy = useCopy(lang);
  const minutes = story.locales[lang].minutes;
  if (!minutes) return null;
  return (
    <span className="meta-time">
      {minutes} {copy.min}
    </span>
  );
}

/** The places a reading compares, set in italic as on a map. */
export function Places({ story, lang, className = "" }: { story: Story; lang: Lang; className?: string }) {
  const line = placeLine(story.locales[lang].region, lang);
  if (!line) return null;
  return <span className={`meta-places ${className}`}>{line}</span>;
}

function Cover({ story, lang, name, date }: { story: Story; lang: Lang; name: string; date: string }) {
  const copy = useCopy(lang);
  const words = WORDS[lang];
  const caption = imageCaption(story.image, lang);
  const printed = visibleCaption(story.image, lang);
  return (
    <section className="cover on-cloth" aria-labelledby="cover-title">
      <Globe className="cover-globe" />
      <div className="cover-frame" dir="ltr">
        <FrameRow brand={false} />
      </div>
      <div className="cover-inner page-width gutter">
        <h1 className="cover-name">
          <Link {...homeLink(lang)} dir="ltr" aria-label="Orbis, the reading atlas">
            <OrbisLockup className="cover-logo" mottoClassName="cover-motto" />
          </Link>
        </h1>
        <p className="cover-issue">
          <span>{name}</span>
          <span>{date}</span>
        </p>
        <article className="cover-lead">
          {story.image ? (
            <figure className="cover-plate">
              <Link {...readLink(lang, story.id)} tabIndex={-1} aria-hidden="true" className="cover-plate-picture">
                <img
                  src={story.image.src}
                  {...imageSet(story.image.src, imageSizes("54vw", "calc(100vw - 54px)"))}
                  alt={caption}
                  width={1500}
                  height={1000}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </Link>
              <figcaption className="cover-caption">
                {printed ? `${printed} ${words.plate}.` : `${words.plate}.`}
              </figcaption>
            </figure>
          ) : null}
          <div className="cover-copy">
            <p className="cover-kicker">
              <span className="cover-num" aria-hidden="true">
                1
              </span>
              <Link {...sectionLink(lang, story.theme)} className="cover-section">
                {copy.themes[story.theme]}
              </Link>
            </p>
            <h2 id="cover-title" className="cover-title">
              <Link {...readLink(lang, story.id)}>{storyTitle(story, lang)}</Link>
            </h2>
            <p className="cover-places">
              <Places story={story} lang={lang} />
            </p>
            <p className="cover-dek">{summary(story, lang)}</p>
            <div className="cover-actions">
              <ListenButton story={story} lang={lang} solid />
              <Link {...readLink(lang, story.id)} className="cover-read">
                {copy.minRead.replace("{n}", String(story.locales[lang].minutes || 1))}
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function Entry({ story, lang, n }: { story: Story; lang: Lang; n: number }) {
  const copy = useCopy(lang);
  return (
    <li className="toc-entry">
      <span className="toc-num" aria-hidden="true">
        {n}
      </span>
      <div className="toc-body">
        <h3 className="toc-title">
          <Link {...readLink(lang, story.id)}>{storyTitle(story, lang)}</Link>
        </h3>
        <p className="toc-dek">{summary(story, lang)}</p>
        <p className="meta">
          <Places story={story} lang={lang} />
          <Link {...sectionLink(lang, story.theme)} className="meta-section">
            {copy.themes[story.theme]}
          </Link>
          <Minutes story={story} lang={lang} />
          <ListenButton story={story} lang={lang} />
        </p>
      </div>
    </li>
  );
}

function Contents({ stories, lang, first }: { stories: Story[]; lang: Lang; first: number }) {
  const words = WORDS[lang];
  if (stories.length === 0) return null;
  return (
    <section className="toc front-block page-width gutter" aria-labelledby="toc-title">
      <div className="block-head">
        <h2 id="toc-title" className="block-title">
          {words.contents}
        </h2>
        <p className="block-note">{words.count.replace("{n}", String(stories.length + first - 1))}</p>
      </div>
      <ol className="toc-list">
        {stories.map((story, index) => (
          <Entry key={story.id} story={story} lang={lang} n={index + first} />
        ))}
      </ol>
    </section>
  );
}

/** The videos, newest first; swiped sideways on a phone. */
function Videos({ lang }: { lang: Lang }) {
  const videos = videosIn(lang);
  if (videos.length === 0) return null;
  const words = videoWords(lang);
  return (
    <section className="front-videos" data-media-strip aria-labelledby="front-videos-title">
      <div className="front-block page-width gutter">
        <div className="block-head">
          <h2 id="front-videos-title" className="block-title">
            {words.videos}
          </h2>
          <Link {...mediaLink(lang)} className="block-link">
            {words.showAll}
          </Link>
        </div>
        <ol className="video-row" data-count={videos.length}>
          {videos.map((video) => (
            <li key={video.id}>
              <Link {...videoLink(lang, video.id)} className="video-card group">
                <span className="video-still">
                  {video.poster ? (
                    <img
                      src={video.poster}
                      {...imageSet(video.poster, imageSizes("40vw", "80vw"))}
                      alt=""
                      width={1600}
                      height={900}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                  <span className="video-play" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M8.5 6v12l10-6z" />
                    </svg>
                  </span>
                </span>
                <span className="video-card-copy">
                  <span className="video-card-title">{video.locales[lang]?.title}</span>
                  {video.locales[lang]?.dek ? (
                    <span className="video-card-dek">{video.locales[lang]?.dek}</span>
                  ) : null}
                  {video.duration ? (
                    <span className="video-card-time figures" dir="ltr">
                      {formatDuration(video.duration)}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Earlier issues as small cloth covers: the number, the first reading's title, the date. */
function Shelf({ issues, lang }: { issues: Story[][]; lang: Lang }) {
  if (issues.length === 0) return null;
  const words = WORDS[lang];
  return (
    <section className="shelf front-block page-width gutter" aria-labelledby="shelf-title">
      <div className="block-head">
        <h2 id="shelf-title" className="block-title">
          {words.shelf}
        </h2>
      </div>
      <ol className="shelf-row">
        {issues.map((issue, index) => {
          const first = issue[0];
          const n = first.issue ?? 0;
          return (
            <li key={n}>
              <Link {...readLink(lang, first.id)} className="shelf-item">
                <span className="shelf-cover on-cloth">
                  <span className="shelf-name" dir="ltr">
                    ORBIS
                  </span>
                  <span className="shelf-no">{words.issue.replace("{n}", String(n))}</span>
                  <span className="shelf-question">{storyTitle(first, lang)}</span>
                  <span className="shelf-date">{formatDate(newestDate(issue), lang)}</span>
                </span>
                <span className="shelf-label">{index === 0 ? words.previous : formatDate(newestDate(issue), lang)}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Archive({ stories, lang }: { stories: Story[]; lang: Lang }) {
  const copy = useCopy(lang);
  const words = WORDS[lang];
  if (stories.length === 0) return null;
  return (
    <section className="archive front-block page-width gutter" aria-labelledby="archive-title">
      <div className="block-head">
        <h2 id="archive-title" className="block-title">
          {words.archive}
        </h2>
      </div>
      <ol className="archive-list">
        {stories.map((story) => (
          <li key={story.id} className="archive-item">
            <h3 className="archive-title">
              <Link {...readLink(lang, story.id)}>{storyTitle(story, lang)}</Link>
            </h3>
            <p className="meta">
              <Places story={story} lang={lang} />
              <Link {...sectionLink(lang, story.theme)} className="meta-section">
                {copy.themes[story.theme]}
              </Link>
              <span className="meta-time">
                {story.issue !== undefined
                  ? words.issue.replace("{n}", String(story.issue))
                  : formatDate(story.date, lang)}
              </span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Every named place, in the language's alphabetical order, with its readings. */
export function PlaceIndex({
  stories,
  lang,
  title,
  note,
}: {
  stories: Story[];
  lang: Lang;
  title?: string;
  note?: string;
}) {
  const words = WORDS[lang];
  const entries = placeIndex(stories, (story) => story.locales[lang].region, lang);
  if (entries.length === 0) return null;
  return (
    <section className="place-index front-block page-width gutter" aria-labelledby="place-index-title">
      <div className="block-head">
        <h2 id="place-index-title" className="block-title">
          {title ?? words.index}
        </h2>
        <p className="block-note">{note ?? words.indexNote}</p>
      </div>
      <ul className="index-list">
        {entries.map((entry) => (
          <li key={entry.place} className="index-entry">
            <span className="index-place">{entry.place}</span>
            <span className="index-refs">
              {entry.items.map((story) => (
                <Link key={story.id} {...readLink(lang, story.id)} className="index-ref">
                  {storyTitle(story, lang)}
                </Link>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** `stories` arrive in front-page order: the newest issue by rank, then older issues. */
export function Front({ stories, lang }: { stories: Story[]; lang: Lang }) {
  const [lead] = stories;
  if (!lead) return null;
  const words = WORDS[lang];
  const current =
    lead.issue === undefined
      ? stories.slice(0, PREVIEW_SIZE)
      : stories.filter((story) => story.issue === lead.issue);
  const shown = new Set(current.map((story) => story.id));
  const rest = stories.filter((story) => !shown.has(story.id));

  // Earlier issues, newest first, each with its readings by rank.
  const issues: Story[][] = [];
  for (const story of rest) {
    if (story.issue === undefined) continue;
    const last = issues[issues.length - 1];
    if (last && last[0].issue === story.issue) last.push(story);
    else issues.push([story]);
  }
  const onShelf = new Set(issues.map((issue) => issue[0].id));
  const archive = rest.filter((story) => !onShelf.has(story.id));

  const name =
    lead.issue === undefined
      ? TRIAL
        ? words.preview
        : words.selection
      : words.issue.replace("{n}", String(lead.issue));

  return (
    <div className="front" dir={langMeta[lang].dir}>
      <Cover story={lead} lang={lang} name={name} date={formatDate(newestDate(current), lang)} />
      <Contents stories={current.slice(1)} lang={lang} first={2} />
      <Videos lang={lang} />
      <Shelf issues={issues} lang={lang} />
      <Archive stories={archive} lang={lang} />
      <PlaceIndex stories={stories} lang={lang} />
    </div>
  );
}
