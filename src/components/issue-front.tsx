import { Link } from "@tanstack/react-router";
import { ListenButton } from "@/components/read-time";
import { imageSizes } from "@/lib/breakpoints";
import { imageCaption } from "@/lib/editorial";
import { imageSet } from "@/lib/image-set";
import { langMeta, useCopy } from "@/lib/i18n";
import { mediaLink, readLink, videoLink } from "@/lib/lang-path";
import { TRIAL } from "@/lib/site";
import { formatDate, storyTitle } from "@/lib/text";
import type { Lang, StoryCard as Story } from "@/lib/types";
import { formatDuration, videoWords, videosIn } from "@/lib/videos";

/**
 * The front page as a magazine (the owner, 28 Oct 2026): not a newspaper grid but the
 * opening pages of an issue. A cover first (one picture, the issue's first reading), then
 * the contents with large numbers, each reading with its places under the title; then the
 * videos on a dark band, the earlier issues as covers on a shelf, and the other readings.
 * Only the cover carries a picture. Phone and desktop share this markup; their layouts live
 * apart, in issue-front-phone.css and issue-front-desktop.css.
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
    allIssues: string;
    previous: string;
    more: string;
    fromIssue: string;
  }
> = {
  en: {
    issue: "Issue {n}",
    preview: "Preview issue",
    selection: "Reading selection",
    contents: "In this issue",
    count: "{n} readings",
    archive: "From the archive",
    allIssues: "All issues",
    previous: "Previous issue",
    more: "More readings",
    fromIssue: "From Issue {n}",
  },
  tr: {
    issue: "Sayı {n}",
    preview: "Deneme sayısı",
    selection: "Okuma seçkisi",
    contents: "Bu sayıda",
    count: "{n} yazı",
    archive: "Arşivden",
    allIssues: "Bütün sayılar",
    previous: "Önceki sayı",
    more: "Diğer yazılar",
    fromIssue: "Sayı {n}",
  },
  ar: {
    issue: "العدد {n}",
    preview: "عدد تجريبي",
    selection: "مختارات للقراءة",
    contents: "في هذا العدد",
    count: "{n} مقالات",
    archive: "من الأرشيف",
    allIssues: "كل الأعداد",
    previous: "العدد السابق",
    more: "مقالات أخرى",
    fromIssue: "من العدد {n}",
  },
  fr: {
    issue: "Numéro {n}",
    preview: "Numéro d’essai",
    selection: "Sélection de lectures",
    contents: "Dans ce numéro",
    count: "{n} lectures",
    archive: "Dans les archives",
    allIssues: "Tous les numéros",
    previous: "Numéro précédent",
    more: "Autres lectures",
    fromIssue: "Du numéro {n}",
  },
  es: {
    issue: "Número {n}",
    preview: "Número de prueba",
    selection: "Selección de lecturas",
    contents: "En este número",
    count: "{n} lecturas",
    archive: "Del archivo",
    allIssues: "Todos los números",
    previous: "Número anterior",
    more: "Otras lecturas",
    fromIssue: "Del número {n}",
  },
};

/** Without issue numbers yet, the first eight readings stand in for an issue. */
const PREVIEW_SIZE = 8;

function summary(story: Story, lang: Lang): string {
  const text = (story.locales[lang].dek?.trim() || story.locales[lang].lead).replace(/\s+/g, " ").trim();
  return text.match(/^.*?[.!?؟۔](?=\s|$)/)?.[0] || text;
}

function number(n: number): string {
  return String(n).padStart(2, "0");
}

function newestDate(stories: Story[]): string {
  return stories.reduce((max, story) => (story.date > max ? story.date : max), "");
}

/** The places a reading compares, under its title. Nothing when the reading names none. */
function Places({ story, lang }: { story: Story; lang: Lang }) {
  const region = story.locales[lang].region?.trim();
  if (!region) return null;
  return (
    <p className="if-places">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </svg>
      <span>{region}</span>
    </p>
  );
}

function Time({ story, lang }: { story: Story; lang: Lang }) {
  const copy = useCopy(lang);
  const minutes = story.locales[lang].minutes;
  if (!minutes) return null;
  return <span className="if-time">{copy.minRead.replace("{n}", String(minutes))}</span>;
}

function Cover({ story, lang }: { story: Story; lang: Lang }) {
  const copy = useCopy(lang);
  return (
    <article className="if-cover">
      {story.image ? (
        <Link {...readLink(lang, story.id)} className="if-cover-picture" tabIndex={-1} aria-hidden="true">
          <img
            src={story.image.src}
            {...imageSet(story.image.src, imageSizes("58vw", "calc(100vw - 40px)"))}
            alt={imageCaption(story.image, lang)}
            width={1500}
            height={1000}
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </Link>
      ) : null}
      <div className="if-cover-copy">
        <p className="if-kicker">
          <span className="if-num">{number(1)}</span>
          <span className="if-section">{copy.themes[story.theme]}</span>
        </p>
        <h2 className="if-title if-cover-title">
          <Link {...readLink(lang, story.id)}>{storyTitle(story, lang)}</Link>
        </h2>
        <Places story={story} lang={lang} />
        <p className="if-dek">{summary(story, lang)}</p>
        <div className="if-actions">
          <ListenButton story={story} lang={lang} solid />
          <Time story={story} lang={lang} />
        </div>
      </div>
    </article>
  );
}

function Entry({ story, lang, n }: { story: Story; lang: Lang; n: number }) {
  const copy = useCopy(lang);
  return (
    <li className="if-entry">
      <span className="if-num" aria-hidden="true">
        {number(n)}
      </span>
      <div className="if-entry-copy">
        <p className="if-section">{copy.themes[story.theme]}</p>
        <h3 className="if-title if-entry-title">
          <Link {...readLink(lang, story.id)}>{storyTitle(story, lang)}</Link>
        </h3>
        <Places story={story} lang={lang} />
        <p className="if-dek">{summary(story, lang)}</p>
        <div className="if-actions">
          <ListenButton story={story} lang={lang} />
          <Time story={story} lang={lang} />
        </div>
      </div>
    </li>
  );
}

/** The videos on a dark band, newest first, swiped sideways on a phone. */
function VideoBand({ lang }: { lang: Lang }) {
  const videos = videosIn(lang);
  if (videos.length === 0) return null;
  const words = videoWords(lang);
  const arrow = langMeta[lang].dir === "rtl" ? "←" : "→";
  return (
    <section className="if-band" data-media-strip aria-labelledby="if-videos">
      <div className="if-head">
        <h2 id="if-videos" className="if-head-title">
          {words.videos}
        </h2>
        <Link {...mediaLink(lang)} className="if-head-link">
          {words.showAll} <span aria-hidden="true">{arrow}</span>
        </Link>
      </div>
      <ol className="if-videos">
        {videos.map((video) => (
          <li key={video.id}>
            <Link {...videoLink(lang, video.id)} className="if-video group">
              <span className="if-video-still">
                {video.poster ? (
                  <img
                    src={video.poster}
                    {...imageSet(video.poster, imageSizes("24vw", "70vw"))}
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
              </span>
              <span className="if-video-title">{video.locales[lang]?.title}</span>
              {video.duration ? (
                <span className="if-video-time" dir="ltr">
                  {formatDuration(video.duration)}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Earlier issues as covers: the issue's number, its first reading's title and its date. */
function Shelf({ issues, lang }: { issues: Story[][]; lang: Lang }) {
  if (issues.length === 0) return null;
  const words = WORDS[lang];
  return (
    <section className="if-shelf" aria-labelledby="if-archive">
      <div className="if-head">
        <h2 id="if-archive" className="if-head-title">
          {words.archive}
        </h2>
      </div>
      <ol className="if-covers">
        {issues.map((issue, index) => {
          const first = issue[0];
          const n = first.issue ?? 0;
          return (
            <li key={n}>
              <Link {...readLink(lang, first.id)} className="if-shelf-item">
                <span className="if-shelf-cover">
                  <span className="if-shelf-top">
                    <span className="if-shelf-name">ORBIS</span>
                    <span>No. {number(n)}</span>
                  </span>
                  <span className="if-shelf-question">{storyTitle(first, lang)}</span>
                  <span className="if-shelf-date">{formatDate(newestDate(issue), lang)}</span>
                </span>
                <span className="if-shelf-label">
                  {index === 0 ? words.previous : words.issue.replace("{n}", String(n))}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function More({ stories, lang, title }: { stories: Story[]; lang: Lang; title: string }) {
  const copy = useCopy(lang);
  const words = WORDS[lang];
  if (stories.length === 0) return null;
  return (
    <section className="if-more" aria-labelledby="if-more">
      <h2 id="if-more" className="if-head-title">
        {title}
      </h2>
      <ol className="if-more-list">
        {stories.map((story) => (
          <li key={story.id}>
            <Link {...readLink(lang, story.id)} className="if-more-item group">
              <span className="if-section">{copy.themes[story.theme]}</span>
              <span className="if-more-title">{storyTitle(story, lang)}</span>
              <span className="if-more-note">
                {story.issue !== undefined
                  ? words.fromIssue.replace("{n}", String(story.issue))
                  : formatDate(story.date, lang)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** `stories` arrive in front-page order: the newest issue by rank, then older issues. */
export function IssueFront({ stories, lang }: { stories: Story[]; lang: Lang }) {
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
  const more = rest.filter((story) => !onShelf.has(story.id));

  const name =
    lead.issue === undefined
      ? TRIAL
        ? words.preview
        : words.selection
      : words.issue.replace("{n}", String(lead.issue));

  return (
    <div className="issue-front" dir={langMeta[lang].dir}>
      <p className="if-issue-line">
        <span>{name}</span>
        <span>{formatDate(newestDate(current), lang)}</span>
      </p>
      <Cover story={lead} lang={lang} />
      {current.length > 1 ? (
        <section className="if-contents" aria-labelledby="if-contents">
          <div className="if-head">
            <h2 id="if-contents" className="if-head-title">
              {words.contents}
            </h2>
            <span className="if-count">{words.count.replace("{n}", String(current.length))}</span>
          </div>
          <ol className="if-list">
            {current.slice(1).map((story, index) => (
              <Entry key={story.id} story={story} lang={lang} n={index + 2} />
            ))}
          </ol>
        </section>
      ) : null}
      <VideoBand lang={lang} />
      <Shelf issues={issues} lang={lang} />
      <More stories={more} lang={lang} title={words.more} />
    </div>
  );
}
