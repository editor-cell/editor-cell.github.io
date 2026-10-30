import { Link } from "@tanstack/react-router";
import { OrbisLockup } from "@/components/orbis-lockup";
import { CardListen } from "@/components/read-time";
import { imageSizes } from "@/lib/breakpoints";
import { imageSet } from "@/lib/image-set";
import { imageCaption } from "@/lib/editorial";
import { langMeta, useCopy } from "@/lib/i18n";
import { readLink, videoLink, mediaLink } from "@/lib/lang-path";
import { storyTitle, formatDateRange } from "@/lib/text";
import { TRIAL } from "@/lib/site";
import { videosIn, videoWords, formatDuration } from "@/lib/videos";
import type { Lang, StoryCard } from "@/lib/types";

const WORDS: Record<Lang, { latest: string; current: string; selection: string; issue: string; contents: string; read: string; count: string }> = {
  tr: { latest: "Son yazılar", current: "Güncel sayı", selection: "Okuma seçkisi", issue: "Sayı {n}", contents: "Yazıları keşfet", read: "Yazının tamamı", count: "{n} yazı" },
  en: { latest: "Latest articles", current: "Current issue", selection: "Reading selection", issue: "Issue {n}", contents: "Explore the readings", read: "Read the story", count: "{n} readings" },
  ar: { latest: "أحدث المقالات", current: "العدد الحالي", selection: "مختارات للقراءة", issue: "العدد {n}", contents: "تصفح المقالات", read: "اقرأ المقال", count: "{n} مقالات" },
  fr: { latest: "Derniers articles", current: "Numéro actuel", selection: "Sélection de lectures", issue: "Numéro {n}", contents: "Découvrir les articles", read: "Lire l’article", count: "{n} articles" },
  es: { latest: "Últimos artículos", current: "Número actual", selection: "Selección de lecturas", issue: "Número {n}", contents: "Explorar los artículos", read: "Leer el artículo", count: "{n} artículos" },
};

const PREVIEW: Record<Lang, string> = {
  en: "Preview issue", tr: "Deneme sayısı", ar: "عدد تجريبي",
  fr: "Numéro d’essai", es: "Número de prueba",
};

function summary(story: StoryCard, lang: Lang) {
  const text = (story.locales[lang].dek?.trim() || story.locales[lang].lead).replace(/\s+/g, " ").trim();
  return text.match(/^.*?[.!?؟۔](?=\s|$)/)?.[0] || text;
}

function FrontPicture({ story, lang, sizes, eager = false }: { story: StoryCard; lang: Lang; sizes: string; eager?: boolean }) {
  if (!story.image) return null;
  return <img src={story.image.src} {...imageSet(story.image.src, sizes)} alt={imageCaption(story.image, lang)} width={1500} height={1000} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} decoding="async" />;
}

function FrontCategory({ story, lang }: { story: StoryCard; lang: Lang }) {
  const copy = useCopy(lang);
  return <p className="front-category">{copy.themes[story.theme]}</p>;
}

function FrontAction({ story, lang }: { story: StoryCard; lang: Lang }) {
  const copy = useCopy(lang);
  const minutes = story.locales[lang].minutes;
  return (
    <span className="front-action">
      <span>{WORDS[lang].read} <span aria-hidden="true">{langMeta[lang].dir === "rtl" ? "←" : "→"}</span></span>
      {minutes ? <span className="front-time">{copy.minRead.replace("{n}", String(minutes))}<CardListen story={story} lang={lang} /></span> : null}
    </span>
  );
}

function FrontStory({ story, lang, kind }: { story: StoryCard; lang: Lang; kind: "side" | "latest" | "feature" }) {
  return (
    <Link {...readLink(lang, story.id)} className={`front-story front-story-${kind} group`}>
      {story.image ? <div className="front-story-picture"><FrontPicture story={story} lang={lang} sizes={imageSizes(kind === "feature" ? "34vw" : "9vw", kind === "feature" ? "calc(100vw - 40px)" : "25vw")} /></div> : null}
      <div className="front-story-copy">
        <FrontCategory story={story} lang={lang} />
        <h3 className="paper-title group-hover:underline underline-offset-4">{storyTitle(story, lang)}</h3>
        <p className="front-summary">{summary(story, lang)}</p>
        <FrontAction story={story} lang={lang} />
      </div>
    </Link>
  );
}

function CurrentIssue({ stories, lang }: { stories: StoryCard[]; lang: Lang }) {
  const lead = stories[0];
  const words = WORDS[lang];
  const issue = lead.issue;
  const selection = issue === undefined ? stories.slice(0, 9) : stories.filter(story => story.issue === issue);
  const dates = selection.map(story => story.date).sort();
  return (
    <section className="front-issue" aria-labelledby="front-current-issue">
      <h2 id="front-current-issue" className="front-section-heading">{words.current}</h2>
      <div className="front-issue-body">
        <div className="front-issue-cover" aria-hidden="true">
          <div className="front-cover-brand"><OrbisLockup className="w-full" mottoClassName="mt-1.5 text-[0.45rem]" /></div>
          <FrontPicture story={lead} lang={lang} sizes={imageSizes("13vw", "32vw")} />
        </div>
        <div className="front-issue-copy">
          <h3 className="paper-title">{issue === undefined ? (TRIAL ? PREVIEW[lang] : words.selection) : words.issue.replace("{n}", String(issue))}</h3>
          <p className="front-issue-date">{formatDateRange(dates[0], dates[dates.length - 1], lang)}</p>
          <p>{words.count.replace("{n}", String(selection.length))}</p>
          <Link {...readLink(lang, lead.id)} className="front-issue-featured">{storyTitle(lead, lang)}</Link>
        </div>
        {selection.length > 1 ? (
          <details className="front-issue-contents">
            <summary>{words.contents}<span aria-hidden="true">↓</span></summary>
            <ol>
              {selection.map(story => <li key={story.id}><Link {...readLink(lang, story.id)}>{storyTitle(story, lang)}</Link></li>)}
            </ol>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function FrontVideo({ lang }: { lang: Lang }) {
  const video = videosIn(lang)[0];
  if (!video) return null;
  const words = videoWords(lang);
  return (
    <section className="front-video" aria-labelledby="front-videos">
      <h2 id="front-videos" className="front-section-heading"><Link {...mediaLink(lang)}>{words.videos}</Link></h2>
      <Link {...videoLink(lang, video.id)} className="front-video-card group">
        <div className="front-video-picture">
          {video.poster ? <img src={video.poster} {...imageSet(video.poster, imageSizes("14vw", "36vw"))} alt="" width={1600} height={900} loading="lazy" decoding="async" /> : null}
          <span className="front-video-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" /></svg></span>
        </div>
        <div>
          <h3 className="paper-title group-hover:underline underline-offset-4">{video.locales[lang]?.title}</h3>
          <p className="front-summary">{video.locales[lang]?.dek}</p>
          <span className="front-action">{words.play} <span dir="ltr">{formatDuration(video.duration)}</span><span aria-hidden="true">{langMeta[lang].dir === "rtl" ? "←" : "→"}</span></span>
        </div>
      </Link>
    </section>
  );
}

/** Shared content for the owner's desktop and phone magazine references. */
export function DesktopFront({ stories, lang }: { stories: StoryCard[]; lang: Lang }) {
  const [lead] = stories;
  if (!lead) return null;
  const feature = stories[6];
  return (
    <div className="desktop-front">
      <div className="front-opening">
        <Link {...readLink(lang, lead.id)} className="front-lead group">
          <div className="front-lead-copy">
            <FrontCategory story={lead} lang={lang} />
            <h2 className="paper-title group-hover:underline underline-offset-4">{storyTitle(lead, lang)}</h2>
            <p className="front-summary">{summary(lead, lang)}</p>
            <FrontAction story={lead} lang={lang} />
          </div>
          {lead.image ? <div className="front-lead-picture"><FrontPicture story={lead} lang={lang} sizes={imageSizes("49vw", "calc(100vw - 40px)")} eager /></div> : null}
        </Link>
        <div className="front-side">
          {stories.slice(1, 3).map(story => <FrontStory key={story.id} story={story} lang={lang} kind="side" />)}
        </div>
      </div>
      <div className="front-lower">
        <section className="front-latest" aria-labelledby="front-latest-title">
          <h2 id="front-latest-title" className="front-section-heading">{WORDS[lang].latest}</h2>
          {stories.slice(3, 6).map(story => <FrontStory key={story.id} story={story} lang={lang} kind="latest" />)}
        </section>
        <div className="front-feature">
          {feature ? <FrontStory story={feature} lang={lang} kind="feature" /> : null}
        </div>
        <div className="front-edition">
          <CurrentIssue stories={stories} lang={lang} />
          <FrontVideo lang={lang} />
        </div>
      </div>
    </div>
  );
}
