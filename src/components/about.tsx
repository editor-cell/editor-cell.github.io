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
      <main className="px-5 py-10 md:px-12 md:py-14">
        <div className="mx-auto flex max-w-2xl flex-col gap-8">
          <Trail lang={lang} here={about.title} className="-mb-3" />
          <h1 className="text-4xl md:text-5xl">{about.title}</h1>
          <div className="flex flex-col gap-6">
            {paragraphs(about.body).map((para) => (
              <p key={para} className="text-pretty">
                {para}
              </p>
            ))}
          </div>
        </div>
      </main>
    </Shell>
  );
}
