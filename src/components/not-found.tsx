import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Shell } from "@/components/shell";
import { homeLink } from "@/lib/lang-path";
import { SITE_NAME } from "@/lib/site";
import type { Lang } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

const WORDS: Record<Lang, { title: string; lead: string; home: string }> = {
  en: {
    title: "Page not found",
    lead: "There is no page at this address. It may have moved, or the address may be mistyped.",
    home: "Go to the front page",
  },
  tr: {
    title: "Sayfa bulunamadı",
    lead: "Bu adreste bir sayfa yok. Sayfa taşınmış ya da adres yanlış yazılmış olabilir.",
    home: "Ana sayfaya dön",
  },
  ar: {
    title: "الصفحة غير موجودة",
    lead: "لا توجد صفحة على هذا العنوان. ربما نُقلت أو كُتب العنوان خطأً.",
    home: "العودة إلى الصفحة الرئيسية",
  },
  fr: {
    title: "Page introuvable",
    lead: "Aucune page à cette adresse. Elle a peut-être été déplacée, ou l’adresse est mal saisie.",
    home: "Revenir à la une",
  },
  es: {
    title: "Página no encontrada",
    lead: "No hay ninguna página en esta dirección. Puede que se haya movido o que la dirección esté mal escrita.",
    home: "Volver a la portada",
  },
};

/**
 * Any address the site has no page for. The host already answers it with status 404;
 * the page also tells search engines not to index it and has a title of its own.
 */
export function NotFoundPage() {
  const lang = useLang();
  const words = WORDS[lang];

  useEffect(() => {
    const before = document.title;
    document.title = `${words.title} – ${SITE_NAME}`;
    // Our own tag, removed again when the reader moves on to a real page.
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);
    return () => {
      robots.remove();
      document.title = before;
    };
  }, [words.title]);

  return (
    <Shell>
      <main className="px-5 py-16 md:px-12 md:py-24">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <h1 className="paper-title text-4xl font-bold leading-[1.08] md:text-5xl">
            {words.title}
          </h1>
          <p className="reading-dek">{words.lead}</p>
          <Link
            {...homeLink(lang)}
            className="inline-flex min-h-11 items-center self-start text-pine underline-offset-4 hover:underline"
          >
            {words.home}
          </Link>
        </div>
      </main>
    </Shell>
  );
}
