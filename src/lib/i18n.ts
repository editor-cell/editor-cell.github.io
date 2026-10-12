import type { Lang, Theme } from "@/lib/types";

export const langMeta: Record<
  Lang,
  { code: string; name: string; html: string; dir: "ltr" | "rtl" }
> = {
  tr: { code: "TR", name: "Türkçe", html: "tr", dir: "ltr" },
  ar: { code: "AR", name: "العربية", html: "ar", dir: "rtl" },
  en: { code: "EN", name: "English", html: "en", dir: "ltr" },
  fr: { code: "FR", name: "Français", html: "fr", dir: "ltr" },
  es: { code: "ES", name: "Español", html: "es", dir: "ltr" },
};

export type Copy = {
  atlas: string;
  home: string;
  sections: string;
  /** Name of the trail above a reading (home › section › title). */
  trail: string;
  /** Name of the sections list inside the opened menu. */
  menuSections: string;
  panel: string;
  language: string;
  /** First line of the home sentence. Read with `hero` as one sentence. */
  heroLead: string;
  hero: string;
  manifesto: string;
  listenRule: string;
  readings: string;
  homeSections: string;
  min: string;
  /** Reading time on a card, as in "4 min read". */
  minRead: string;
  listen: string;
  pause: string;
  speed: string;
  audioError: string;
  retry: string;
  /** The 15-second jumps of the players, read aloud by screen readers. */
  skipBack: string;
  skipAhead: string;
  /** Closes the listening bar at the foot of the screen. */
  closeListen: string;
  textSize: string;
  typeDown: string;
  typeUp: string;
  sources: string;
  sourceWord: string;
  unwritten: string;
  availableIn: string;
  back: string;
  edit: string;
  missing: string;
  loading: string;
  colophon: string;
  themes: Record<Theme, string>;
  newReading: string;
  restore: string;
  emptyAtlas: string;
  emptyPanel: string;
  panelLead: string;
  save: string;
  saved: string;
  needTitle: string;
  remove: string;
  removeStory: string;
  confirmRemove: string;
  cancel: string;
  theme: string;
  date: string;
  title: string;
  dek: string;
  region: string;
  body: string;
  bodyHint: string;
  audio: string;
  audioHint: string;
  upload: string;
  replaceAudio: string;
  removeAudio: string;
  audioTooBig: string;
  audioFail: string;
  sourcesLead: string;
  sourceLabel: string;
  sourceUrl: string;
  addSource: string;
  insert: string;
  urlInvalid: string;
  labelRequired: string;
  openReading: string;
  noSources: string;
  recordingOn: string;
  recordingOff: string;
};

const copy: Record<Lang, Copy> = {
  en: {
    atlas: "Home",
    home: "Home",
    sections: "Sections",
    trail: "You are here",
    menuSections: "Menu sections",
    panel: "Panel",
    language: "Language",
    heroLead: "The reading",
    hero: "atlas.",
    manifesto:
      "Orbis is a reading atlas. Each dispatch is rewritten in five languages and tied to the public documents it rests on. There is no breaking-news desk, and there is no opinion page.",
    listenRule:
      "A listen control appears only after a recording has been filed for the language you are reading.",
    readings: "Readings",
    homeSections: "Home sections",
    min: "min",
    minRead: "{n} min read",
    listen: "Listen",
    pause: "Pause",
    speed: "Speed",
    audioError: "The recording could not be played.",
    retry: "Try again",
    skipBack: "Back 15 seconds",
    skipAhead: "Ahead 15 seconds",
    closeListen: "Close the player",
    textSize: "Type size",
    typeDown: "Smaller type",
    typeUp: "Larger type",
    sources: "Sources",
    sourceWord: "source",
    unwritten: "This reading has not been written in this language yet.",
    availableIn: "Written in",
    back: "← Home",
    edit: "Edit in the panel",
    missing: "This reading could not be found.",
    loading: "Loading",
    colophon: "Orbis files sourced readings. The chain of documents sits at the foot of every text.",
    themes: {
      climate: "Climate",
      environment: "Environment",
      politics: "Politics",
      economy: "Economy",
      science: "Science",
      technology: "Technology",
      culture: "Culture",
      health: "Health",
    },
    newReading: "New reading",
    restore: "Restore the opening readings",
    emptyAtlas: "No readings yet.",
    emptyPanel: "No readings yet.",
    panelLead:
      "Write each language yourself. File one recording per language. Until you do, that language stays silent on the reading page.",
    save: "Save reading",
    saved: "Saved",
    needTitle: "Add a title in at least one language.",
    remove: "Remove",
    removeStory: "Remove this reading",
    confirmRemove: "Remove",
    cancel: "Cancel",
    theme: "Field",
    date: "Date",
    title: "Title",
    dek: "Standfirst",
    region: "Place",
    body: "Text",
    bodyHint: "Where a sentence rests on a document, place its number — [1] — with the button beside that source.",
    audio: "Recording",
    audioHint: "Upload a spoken reading for this language only. The listen button is hidden until a file is saved.",
    upload: "Upload recording",
    replaceAudio: "Replace recording",
    removeAudio: "Remove recording",
    audioTooBig: "Keep the recording under 30 MB.",
    audioFail: "That file could not be read.",
    sourcesLead: "Sources are shared by every language. The number in the sentence jumps to this list. The address opens the document.",
    sourceLabel: "Document title",
    sourceUrl: "Address",
    addSource: "Add source",
    insert: "Place in the sentence",
    urlInvalid: "Use a full http or https address.",
    labelRequired: "Name the document.",
    openReading: "Open reading",
    noSources: "No sources yet.",
    recordingOn: "Recording filed",
    recordingOff: "No recording",
  },
  tr: {
    atlas: "Ana sayfa",
    home: "Ana sayfa",
    sections: "Bölümler",
    trail: "Bulunduğunuz yer",
    menuSections: "Menüdeki bölümler",
    panel: "Panel",
    language: "Dil",
    heroLead: "Okuma",
    hero: "atlası.",
    manifesto:
      "Orbis bir okuma atlasıdır. Her metin beş dilde yeniden yazılır ve dayandığı kamusal belgelere bağlanır. Son dakika masası yoktur, görüş sayfası da yoktur.",
    listenRule:
      "Dinle düğmesi, yalnızca okuduğunuz dil için bir ses kaydı yüklendiyse görünür.",
    readings: "Okumalar",
    homeSections: "Ana bölümler",
    min: "dk",
    minRead: "{n} dk okuma",
    listen: "Dinle",
    pause: "Durdur",
    speed: "Hız",
    audioError: "Ses kaydı açılamadı.",
    retry: "Tekrar dene",
    skipBack: "15 saniye geri",
    skipAhead: "15 saniye ileri",
    closeListen: "Oynatıcıyı kapat",
    textSize: "Metin boyutu",
    typeDown: "Daha küçük yazı",
    typeUp: "Daha büyük yazı",
    sources: "Kaynakça",
    sourceWord: "kaynak",
    unwritten: "Bu okuma bu dilde henüz yazılmadı.",
    availableIn: "Yazıldığı diller",
    back: "← Ana sayfa",
    edit: "Panelde düzenle",
    missing: "Bu yazı bulunamadı.",
    loading: "Yükleniyor",
    colophon: "Orbis, kaynaklara dayanan okuma metinleri sunar. Her yazının kaynakları metnin sonunda yer alır.",
    themes: {
      climate: "İklim",
      environment: "Çevre",
      politics: "Politika",
      economy: "Ekonomi",
      science: "Bilim",
      technology: "Teknoloji",
      culture: "Kültür",
      health: "Sağlık",
    },
    newReading: "Yeni okuma",
    restore: "Açılış okumalarını geri getir",
    emptyAtlas: "Henüz yazı yok.",
    emptyPanel: "Henüz okuma yok.",
    panelLead:
      "Her dili kendiniz yazın. Dil başına bir ses kaydı yükleyin. Yüklemeden o dil, okuma sayfasında sessiz kalır.",
    save: "Okumayı kaydet",
    saved: "Kaydedildi",
    needTitle: "En az bir dilde başlık yazın.",
    remove: "Kaldır",
    removeStory: "Bu okumayı kaldır",
    confirmRemove: "Kaldır",
    cancel: "Vazgeç",
    theme: "Alan",
    date: "Tarih",
    title: "Başlık",
    dek: "Spot",
    region: "Yer",
    body: "Metin",
    bodyHint: "Cümle bir belgeye dayanıyorsa numarasını — [1] — o kaynağın yanındaki düğmeyle yerleştirin.",
    audio: "Sesli okuma",
    audioHint: "Yalnızca bu dil için konuşulmuş bir kayıt yükleyin. Dosya kaydedilmeden dinle düğmesi gizlidir.",
    upload: "Ses yükle",
    replaceAudio: "Sesi değiştir",
    removeAudio: "Sesi kaldır",
    audioTooBig: "Kayıt 30 MB altında olsun.",
    audioFail: "Dosya okunamadı.",
    sourcesLead:
      "Kaynaklar her dilde ortaktır. Cümledeki numara bu listeye gider. Adres, belgeyi açar.",
    sourceLabel: "Belge adı",
    sourceUrl: "Adres",
    addSource: "Kaynak ekle",
    insert: "Cümleye koy",
    urlInvalid: "Tam bir http veya https adresi yazın.",
    labelRequired: "Belgeyi adlandırın.",
    openReading: "Okumayı aç",
    noSources: "Henüz kaynak yok.",
    recordingOn: "Ses yüklü",
    recordingOff: "Ses yok",
  },
  ar: {
    atlas: "الرئيسية",
    home: "الرئيسية",
    sections: "الأقسام",
    trail: "موقعك",
    menuSections: "أقسام القائمة",
    panel: "اللوحة",
    language: "اللغة",
    heroLead: "أطلس",
    hero: "القراءة.",
    manifesto:
      "أوربيس أطلس قراءة. يُعاد كتابة كل نص بخمس لغات ويُربط بالوثائق العامة التي يستند إليها. لا مكتب أخبار عاجلة هنا، ولا صفحة رأي.",
    listenRule: "يظهر زر الاستماع فقط بعد رفع تسجيل للغة التي تقرأ بها.",
    readings: "قراءات",
    homeSections: "أقسام الصفحة",
    min: "د",
    minRead: "وقت القراءة: {n} د",
    listen: "استمع",
    pause: "إيقاف",
    speed: "السرعة",
    audioError: "تعذّر تشغيل التسجيل.",
    retry: "أعد المحاولة",
    skipBack: "رجوع ١٥ ثانية",
    skipAhead: "تقدّم ١٥ ثانية",
    closeListen: "إغلاق المشغّل",
    textSize: "حجم النص",
    typeDown: "تصغير النص",
    typeUp: "تكبير النص",
    sources: "المصادر",
    sourceWord: "مصدر",
    unwritten: "لم تُكتب هذه القراءة بهذه اللغة بعد.",
    availableIn: "كُتبت في",
    back: "→ الرئيسية",
    edit: "تحرير في اللوحة",
    missing: "لم يُعثر على هذه القراءة.",
    loading: "جارٍ التحميل",
    colophon: "أوربيس يحفظ قراءات موثّقة. سلسلة الوثائق في ذيل كل نص.",
    themes: {
      climate: "المناخ",
      environment: "البيئة",
      politics: "السياسة",
      economy: "الاقتصاد",
      science: "العلوم",
      technology: "التقنية",
      culture: "الثقافة",
      health: "الصحة",
    },
    newReading: "قراءة جديدة",
    restore: "استعد قراءات الافتتاح",
    emptyAtlas: "لا توجد قراءات بعد.",
    emptyPanel: "لا قراءات بعد.",
    panelLead:
      "اكتب كل لغة بنفسك. ارفع تسجيلًا واحدًا لكل لغة. قبل ذلك تبقى تلك اللغة صامتة في صفحة القراءة.",
    save: "احفظ القراءة",
    saved: "حُفظ",
    needTitle: "أضف عنوانًا في لغة واحدة على الأقل.",
    remove: "إزالة",
    removeStory: "أزل هذه القراءة",
    confirmRemove: "إزالة",
    cancel: "رجوع",
    theme: "المجال",
    date: "التاريخ",
    title: "العنوان",
    dek: "الموجز",
    region: "المكان",
    body: "النص",
    bodyHint: "حيث تستند الجملة إلى وثيقة، ضع رقمها — [1] — بالزر بجانب ذلك المصدر.",
    audio: "القراءة الصوتية",
    audioHint: "ارفع تسجيلًا منطوقًا لهذه اللغة فقط. زر الاستماع مخفي حتى يُحفظ الملف.",
    upload: "رفع تسجيل",
    replaceAudio: "استبدال التسجيل",
    removeAudio: "إزالة التسجيل",
    audioTooBig: "أبقِ التسجيل تحت ٣٠ ميغابايت.",
    audioFail: "تعذّرت قراءة الملف.",
    sourcesLead:
      "المصادر مشتركة بين كل اللغات. الرقم في الجملة يذهب إلى هذه القائمة. العنوان يفتح الوثيقة.",
    sourceLabel: "اسم الوثيقة",
    sourceUrl: "العنوان",
    addSource: "أضف مصدرًا",
    insert: "ضعه في الجملة",
    urlInvalid: "استخدم عنوان http أو https كاملًا.",
    labelRequired: "سمِّ الوثيقة.",
    openReading: "افتح القراءة",
    noSources: "لا مصادر بعد.",
    recordingOn: "تسجيل مرفوع",
    recordingOff: "بلا تسجيل",
  },
  fr: {
    atlas: "Accueil",
    home: "Accueil",
    sections: "Sections",
    trail: "Vous êtes ici",
    menuSections: "Sections du menu",
    panel: "Panneau",
    language: "Langue",
    heroLead: "L’atlas",
    hero: "de lecture.",
    manifesto:
      "Orbis est un atlas de lecture. Chaque texte est réécrit en cinq langues et relié aux documents publics sur lesquels il repose. Il n’y a pas de desk d’urgence, ni de page d’opinion.",
    listenRule:
      "Le bouton d’écoute n’apparaît qu’une fois un enregistrement déposé pour la langue que vous lisez.",
    readings: "Lectures",
    homeSections: "Sections",
    min: "min",
    minRead: "{n} min de lecture",
    listen: "Écouter",
    pause: "Pause",
    speed: "Vitesse",
    audioError: "L’enregistrement n’a pas pu être lu.",
    retry: "Réessayer",
    skipBack: "Reculer de 15 secondes",
    skipAhead: "Avancer de 15 secondes",
    closeListen: "Fermer le lecteur",
    textSize: "Taille du texte",
    typeDown: "Réduire le texte",
    typeUp: "Agrandir le texte",
    sources: "Sources",
    sourceWord: "source",
    unwritten: "Cette lecture n’a pas encore été écrite dans cette langue.",
    availableIn: "Écrite en",
    back: "← Accueil",
    edit: "Modifier dans le panneau",
    missing: "Cette lecture est introuvable.",
    loading: "Chargement",
    colophon: "Orbis tient des lectures sourcées. La chaîne des documents est au pied de chaque texte.",
    themes: {
      climate: "Climat",
      environment: "Environnement",
      politics: "Politique",
      economy: "Économie",
      science: "Sciences",
      technology: "Technologie",
      culture: "Culture",
      health: "Santé",
    },
    newReading: "Nouvelle lecture",
    restore: "Rétablir les lectures d’ouverture",
    emptyAtlas: "Aucune lecture pour l’instant.",
    emptyPanel: "Aucune lecture pour l’instant.",
    panelLead:
      "Écrivez chaque langue vous-même. Déposez un enregistrement par langue. Sans cela, cette langue reste silencieuse sur la page.",
    save: "Enregistrer",
    saved: "Enregistré",
    needTitle: "Ajoutez un titre dans au moins une langue.",
    remove: "Retirer",
    removeStory: "Retirer cette lecture",
    confirmRemove: "Retirer",
    cancel: "Annuler",
    theme: "Champ",
    date: "Date",
    title: "Titre",
    dek: "Chapô",
    region: "Lieu",
    body: "Texte",
    bodyHint:
      "Là où une phrase s’appuie sur un document, placez son numéro — [1] — avec le bouton à côté de cette source.",
    audio: "Lecture audio",
    audioHint:
      "Déposez un enregistrement parlé pour cette langue seulement. Le bouton d’écoute reste caché tant qu’un fichier n’est pas enregistré.",
    upload: "Déposer un enregistrement",
    replaceAudio: "Remplacer l’enregistrement",
    removeAudio: "Retirer l’enregistrement",
    audioTooBig: "Gardez l’enregistrement sous 30 Mo.",
    audioFail: "Ce fichier n’a pas pu être lu.",
    sourcesLead:
      "Les sources sont communes à toutes les langues. Le numéro dans la phrase rejoint cette liste. L’adresse ouvre le document.",
    sourceLabel: "Titre du document",
    sourceUrl: "Adresse",
    addSource: "Ajouter une source",
    insert: "Placer dans la phrase",
    urlInvalid: "Utilisez une adresse http ou https complète.",
    labelRequired: "Nommez le document.",
    openReading: "Ouvrir la lecture",
    noSources: "Aucune source pour l’instant.",
    recordingOn: "Enregistrement déposé",
    recordingOff: "Pas d’enregistrement",
  },
  es: {
    atlas: "Inicio",
    home: "Inicio",
    sections: "Secciones",
    trail: "Usted está aquí",
    menuSections: "Secciones del menú",
    panel: "Panel",
    language: "Lengua",
    heroLead: "El atlas",
    hero: "de lectura.",
    manifesto:
      "Orbis es un atlas de lectura. Cada texto se reescribe en cinco lenguas y se ata a los documentos públicos en los que se apoya. No hay mesa de última hora, ni página de opinión.",
    listenRule:
      "El botón de escuchar solo aparece cuando hay una grabación cargada para la lengua que estás leyendo.",
    readings: "Lecturas",
    homeSections: "Secciones",
    min: "min",
    minRead: "{n} min de lectura",
    listen: "Escuchar",
    pause: "Pausa",
    speed: "Velocidad",
    audioError: "No se pudo reproducir la grabación.",
    retry: "Reintentar",
    skipBack: "Retroceder 15 segundos",
    skipAhead: "Avanzar 15 segundos",
    closeListen: "Cerrar el reproductor",
    textSize: "Tamaño del texto",
    typeDown: "Reducir el texto",
    typeUp: "Agrandar el texto",
    sources: "Fuentes",
    sourceWord: "fuente",
    unwritten: "Esta lectura aún no está escrita en esta lengua.",
    availableIn: "Escrita en",
    back: "← Inicio",
    edit: "Editar en el panel",
    missing: "No se encontró esta lectura.",
    loading: "Cargando",
    colophon: "Orbis guarda lecturas con fuente. La cadena de documentos queda al pie de cada texto.",
    themes: {
      climate: "Clima",
      environment: "Medio ambiente",
      politics: "Política",
      economy: "Economía",
      science: "Ciencia",
      technology: "Tecnología",
      culture: "Cultura",
      health: "Salud",
    },
    newReading: "Nueva lectura",
    restore: "Restaurar las lecturas de apertura",
    emptyAtlas: "Todavía no hay lecturas.",
    emptyPanel: "Todavía no hay lecturas.",
    panelLead:
      "Escribe cada lengua tú mismo. Carga una grabación por lengua. Hasta entonces, esa lengua permanece en silencio en la página.",
    save: "Guardar lectura",
    saved: "Guardado",
    needTitle: "Añade un título en al menos una lengua.",
    remove: "Quitar",
    removeStory: "Quitar esta lectura",
    confirmRemove: "Quitar",
    cancel: "Cancelar",
    theme: "Campo",
    date: "Fecha",
    title: "Título",
    dek: "Entradilla",
    region: "Lugar",
    body: "Texto",
    bodyHint:
      "Donde una frase se apoya en un documento, coloca su número — [1] — con el botón junto a esa fuente.",
    audio: "Lectura en voz",
    audioHint:
      "Carga una grabación hablada solo para esta lengua. El botón de escuchar sigue oculto hasta que el archivo se guarda.",
    upload: "Cargar grabación",
    replaceAudio: "Sustituir grabación",
    removeAudio: "Quitar grabación",
    audioTooBig: "Mantén la grabación por debajo de 30 MB.",
    audioFail: "No se pudo leer el archivo.",
    sourcesLead:
      "Las fuentes son comunes a todas las lenguas. El número en la frase salta a esta lista. La dirección abre el documento.",
    sourceLabel: "Título del documento",
    sourceUrl: "Dirección",
    addSource: "Añadir fuente",
    insert: "Poner en la frase",
    urlInvalid: "Usa una dirección http o https completa.",
    labelRequired: "Nombra el documento.",
    openReading: "Abrir lectura",
    noSources: "Todavía no hay fuentes.",
    recordingOn: "Grabación cargada",
    recordingOff: "Sin grabación",
  },
};

export function useCopy(lang: Lang): Copy {
  return copy[lang];
}

/** The same copy, for code outside components (page titles, for instance). */
export function copyFor(lang: Lang): Copy {
  return copy[lang];
}
