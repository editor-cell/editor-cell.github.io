import type { Lang, StoryImage } from "@/lib/types";

/**
 * Publisher and contact address. Both stay empty until they are filled in here; while
 * empty, nothing about them appears on the site.
 */
export const EDITORIAL = {
  publisherName: "Yavuz Sarıkaya",
  contactEmail: "editor@orbisreadingatlas.com",
};

const labels = {
  tr: {
    byline: "Yazan: {name}",
    author: "Yazar",
    updated: "Güncellendi",
    publisher: "Yayıncı",
    contact: "İletişim ve düzeltme bildirimi",
    corrections:
      "Bir yanlışlık bildirmek için yazının bağlantısını ve ilgili kaynağı iletebilirsiniz.",
    otherReadings: "Diğer bölümlerden",
    status: "Yayın durumu",
    draft: "Taslak (sitede görünmez)",
    published: "Yayımlanmış",
    draftMark: "Taslak",
  },
  en: {
    byline: "By {name}",
    author: "Author",
    updated: "Updated",
    publisher: "Publisher",
    contact: "Contact and corrections",
    corrections: "To report an error, include the reading's address and the relevant source.",
    otherReadings: "From other sections",
    status: "Publication status",
    draft: "Draft (hidden from the site)",
    published: "Published",
    draftMark: "Draft",
  },
  ar: {
    byline: "بقلم {name}",
    author: "الكاتب",
    updated: "آخر تحديث",
    publisher: "الناشر",
    contact: "التواصل والإبلاغ عن الأخطاء",
    corrections: "للإبلاغ عن خطأ، يرجى إرفاق رابط القراءة والمصدر ذي الصلة.",
    otherReadings: "من أقسام أخرى",
    status: "حالة النشر",
    draft: "مسودة (غير ظاهرة في الموقع)",
    published: "منشور",
    draftMark: "مسودة",
  },
  fr: {
    byline: "Par {name}",
    author: "Auteur",
    updated: "Mis à jour",
    publisher: "Éditeur",
    contact: "Contact et corrections",
    corrections: "Pour signaler une erreur, indiquez l'adresse du texte et la source concernée.",
    otherReadings: "Dans les autres rubriques",
    status: "Statut de publication",
    draft: "Brouillon (masqué sur le site)",
    published: "Publié",
    draftMark: "Brouillon",
  },
  es: {
    byline: "Por {name}",
    author: "Autor",
    updated: "Actualizado",
    publisher: "Editor",
    contact: "Contacto y correcciones",
    corrections:
      "Para comunicar un error, incluya la dirección del texto y la fuente correspondiente.",
    otherReadings: "De otras secciones",
    status: "Estado de publicación",
    draft: "Borrador (oculto en el sitio)",
    published: "Publicado",
    draftMark: "Borrador",
  },
} satisfies Record<Lang, Record<string, string>>;

export function editorialCopy(lang: Lang) {
  return labels[lang];
}

/** "Yazan: Ad Soyad" / "By Name", or "" when the reading has no author. */
export function byline(author: string | undefined, lang: Lang): string {
  const name = author?.trim();
  return name ? labels[lang].byline.replace("{name}", name) : "";
}

/** The picture's description in this language, falling back to the shared one. */
export function imageCaption(image: StoryImage | undefined, lang: Lang): string {
  return image?.captions?.[lang]?.trim() || image?.credit?.trim() || "";
}

export function contactHref(): string | undefined {
  const email = EDITORIAL.contactEmail.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : undefined;
}
