import type { Lang } from "@/lib/types";

/**
 * The About page, in one place. `title` is the heading and the links that open it.
 * `body` is the page text: a blank line starts a new paragraph. Replace it per language
 * when the full text is ready. For now it is the sentence under the wordmark in the footer.
 */
export const ABOUT: Record<Lang, { title: string; body: string }> = {
  tr: {
    title: "Hakkında",
    body: "Orbis kaynaklı okumalar tutar. Belge zinciri her metnin dibindedir.",
  },
  ar: {
    title: "عن أوربيس",
    body: "أوربيس يحفظ قراءات موثّقة. سلسلة الوثائق في ذيل كل نص.",
  },
  en: {
    title: "About Orbis",
    body: "Orbis files sourced readings. The chain of documents sits at the foot of every text.",
  },
  fr: {
    title: "À propos d’Orbis",
    body: "Orbis tient des lectures sourcées. La chaîne des documents est au pied de chaque texte.",
  },
  es: {
    title: "Sobre Orbis",
    body: "Orbis guarda lecturas con fuente. La cadena de documentos queda al pie de cada texto.",
  },
};

export function aboutCopy(lang: Lang) {
  return ABOUT[lang];
}
