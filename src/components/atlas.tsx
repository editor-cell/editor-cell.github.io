import { Link } from "@tanstack/react-router";
import { Front, PlaceIndex, Places } from "@/components/front";
import { ListenButton } from "@/components/read-time";
import { Shell } from "@/components/shell";
import { imageSizes } from "@/lib/breakpoints";
import { imageCaption } from "@/lib/editorial";
import { useFrameCopy } from "@/lib/frame-copy";
import { frontOrder } from "@/lib/front-order";
import { imageSet } from "@/lib/image-set";
import { langMeta, useCopy } from "@/lib/i18n";
import { readLink } from "@/lib/lang-path";
import { CARDS } from "@/lib/seed";
import { formatDate, storyTitle } from "@/lib/text";
import type { Lang, StoryCard as Story, Theme } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

/**
 * The front page and the five section pages. The front page is an issue (front.tsx); a
 * section is one part of the atlas: its name large, what it covers in one line, its newest
 * reading with a picture, the others as a list, and the places its readings compare.
 */

const SECTION_LINE: Record<Lang, Record<Theme, string>> = {
  en: {
    "climate-environment": "Climate, water, land and air.",
    "economy-politics": "Economies, governments and public life.",
    "science-technology": "Measurement, research and technology.",
    health: "Bodies, care and public health.",
    culture: "Languages, records and ways of life.",
  },
  tr: {
    "climate-environment": "İklim, su, toprak ve hava.",
    "economy-politics": "Ekonomi, yönetim ve kamusal hayat.",
    "science-technology": "Ölçüm, araştırma ve teknoloji.",
    health: "Beden, bakım ve halk sağlığı.",
    culture: "Diller, kayıtlar ve yaşam biçimleri.",
  },
  ar: {
    "climate-environment": "المناخ والماء والأرض والهواء.",
    "economy-politics": "الاقتصاد والحكم والحياة العامة.",
    "science-technology": "القياس والبحث والتقنية.",
    health: "الجسد والرعاية والصحة العامة.",
    culture: "اللغات والسجلات وأساليب العيش.",
  },
  fr: {
    "climate-environment": "Climat, eau, terres et air.",
    "economy-politics": "Économies, États et vie publique.",
    "science-technology": "Mesure, recherche et technique.",
    health: "Corps, soins et santé publique.",
    culture: "Langues, archives et manières de vivre.",
  },
  es: {
    "climate-environment": "Clima, agua, tierra y aire.",
    "economy-politics": "Economías, gobiernos y vida pública.",
    "science-technology": "Medición, investigación y tecnología.",
    health: "Cuerpos, cuidados y salud pública.",
    culture: "Lenguas, registros y formas de vida.",
  },
};

const WORDS: Record<Lang, { count: (n: number) => string; places: string; placesNote: string }> = {
  en: {
    count: (n) => (n === 1 ? "1 reading" : `${n} readings`),
    places: "Places in this section",
    placesNote: "The places these readings compare.",
  },
  tr: {
    count: (n) => `${n} yazı`,
    places: "Bu bölümdeki yerler",
    placesNote: "Bu yazıların karşılaştırdığı yerler.",
  },
  ar: {
    count: (n) => `${n} قراءات`,
    places: "أماكن هذا القسم",
    placesNote: "الأماكن التي تقارن بينها هذه القراءات.",
  },
  fr: {
    count: (n) => (n === 1 ? "1 lecture" : `${n} lectures`),
    places: "Les lieux de cette rubrique",
    placesNote: "Les lieux que ces lectures comparent.",
  },
  es: {
    count: (n) => (n === 1 ? "1 lectura" : `${n} lecturas`),
    places: "Lugares de esta sección",
    placesNote: "Los lugares que comparan estas lecturas.",
  },
};

function firstSentence(story: Story, lang: Lang): string {
  const text = (story.locales[lang].dek?.trim() || story.locales[lang].lead)
    .replace(/\s+/g, " ")
    .trim();
  return text.match(/^.*?[.!?؟۔](?=\s|$)/)?.[0] || text;
}

function SectionLead({ story, lang }: { story: Story; lang: Lang }) {
  const copy = useCopy(lang);
  return (
    <article className="section-lead page-width gutter">
      {story.image ? (
        <Link {...readLink(lang, story.id)} tabIndex={-1} aria-hidden="true" className="section-lead-picture">
          <img
            src={story.image.src}
            {...imageSet(story.image.src, imageSizes("50vw", "100vw"))}
            alt={imageCaption(story.image, lang)}
            width={1500}
            height={1000}
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </Link>
      ) : null}
      <div className="section-lead-copy">
        <h2 className="section-lead-title">
          <Link {...readLink(lang, story.id)}>{storyTitle(story, lang)}</Link>
        </h2>
        <p className="section-lead-dek">{firstSentence(story, lang)}</p>
        <p className="meta">
          <Places story={story} lang={lang} />
          <span className="meta-time">{formatDate(story.date, lang)}</span>
          {story.locales[lang].minutes ? (
            <span className="meta-time">
              {story.locales[lang].minutes} {copy.min}
            </span>
          ) : null}
          <ListenButton story={story} lang={lang} />
        </p>
      </div>
    </article>
  );
}

function SectionList({ stories, lang }: { stories: Story[]; lang: Lang }) {
  const copy = useCopy(lang);
  if (stories.length === 0) return null;
  return (
    <ol className="section-list page-width gutter">
      {stories.map((story) => (
        <li key={story.id} className="section-item">
          <h3 className="section-item-title">
            <Link {...readLink(lang, story.id)}>{storyTitle(story, lang)}</Link>
          </h3>
          <p className="section-item-dek">{firstSentence(story, lang)}</p>
          <p className="meta">
            <Places story={story} lang={lang} />
            <span className="meta-time">{formatDate(story.date, lang)}</span>
            {story.locales[lang].minutes ? (
              <span className="meta-time">
                {story.locales[lang].minutes} {copy.min}
              </span>
            ) : null}
            <ListenButton story={story} lang={lang} />
          </p>
        </li>
      ))}
    </ol>
  );
}

function Section({ theme }: { theme: Theme }) {
  const lang = useLang();
  const copy = useCopy(lang);
  const frame = useFrameCopy(lang);
  const words = WORDS[lang];
  const stories = CARDS.filter((story) => story.locales[lang].written && story.theme === theme).sort(
    (a, b) => b.date.localeCompare(a.date),
  );
  const [lead, ...rest] = stories;
  return (
    <main className="section-page" dir={langMeta[lang].dir}>
      <header className="section-head page-width gutter">
        <h1 className="section-name">{copy.themes[theme]}</h1>
        <p className="section-line">{SECTION_LINE[lang][theme]}</p>
        {stories.length ? <p className="block-note">{words.count(stories.length)}</p> : null}
      </header>
      {lead ? (
        <>
          <SectionLead story={lead} lang={lang} />
          <SectionList stories={rest} lang={lang} />
          <PlaceIndex stories={stories} lang={lang} title={words.places} note={words.placesNote} />
        </>
      ) : (
        <p className="section-empty page-width gutter">{frame.emptySection}</p>
      )}
    </main>
  );
}

function Home() {
  const lang = useLang();
  const copy = useCopy(lang);
  const stories = frontOrder(CARDS.filter((story) => story.locales[lang].written));
  if (stories.length === 0) {
    return (
      <main className="page-width gutter py-16">
        <p>{copy.emptyAtlas}</p>
      </main>
    );
  }
  return (
    <main>
      <Front stories={stories} lang={lang} />
    </main>
  );
}

export function HomePage() {
  return (
    <Shell section="all">
      <Home />
    </Shell>
  );
}

export function SectionPage({ theme }: { theme: Theme }) {
  return (
    <Shell section={theme}>
      <Section theme={theme} />
    </Shell>
  );
}
