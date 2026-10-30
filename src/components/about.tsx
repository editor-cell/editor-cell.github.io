import { aboutCopy } from "@/lib/about-copy";
import { Shell } from "@/components/shell";
import { Trail } from "@/components/trail";
import { paragraphs } from "@/lib/text";
import { useLang } from "@/lib/use-lang";

/** About Orbis, in the language of its address. Same column as a reading. The publisher's
 *  name stays on the terms and privacy pages only (the owner, 19 Oct 2026). */
export function AboutPage() {
  const lang = useLang();
  const about = aboutCopy(lang);

  return (
    <Shell>
      <main className="page-plain">
        <div className="flex flex-col gap-8">
          <Trail lang={lang} here={about.title} className="-mb-3" />
          <h1 className="page-title">{about.title}</h1>
          <div className="reading-text reading-flow">
            {paragraphs(about.body).map((para) => (
              <p key={para} className="reading-para">
                {para}
              </p>
            ))}
          </div>
        </div>
      </main>
    </Shell>
  );
}
