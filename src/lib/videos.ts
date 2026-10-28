import INDEX from "virtual:orbis-videos";
import { mediaUrl } from "@/lib/seed";
import type { Lang, Video, VideoCard } from "@/lib/types";

/**
 * Videos stand on their own: each is a file in content/videos/<id>.json, with no reading
 * or issue behind it. The front page's media strip and the list of videos work from
 * VIDEOS (no transcripts); a video's page loads its own file, transcript included.
 */
const files = import.meta.glob<Video>("/content/videos/*.json", { import: "default" });

export const VIDEOS: VideoCard[] = INDEX.map((card) => ({
  ...card,
  src: mediaUrl(card.src),
  poster: card.poster ? mediaUrl(card.poster) : undefined,
}));

/** The videos with a title in this language, newest first. */
export function videosIn(lang: Lang): VideoCard[] {
  return VIDEOS.filter((video) => Boolean(video.locales[lang]?.title));
}

export function findVideo(id: string): VideoCard | undefined {
  return VIDEOS.find((video) => video.id === id);
}

/** The full video, or null when no published file has this id. */
export async function loadVideo(id: string): Promise<Video | null> {
  const card = findVideo(id);
  const load = card ? files[`/content/videos/${card.file}`] : undefined;
  if (!load) return null;
  const video = structuredClone(await load());
  return {
    ...video,
    id: card!.id,
    src: mediaUrl(video.src),
    poster: video.poster ? mediaUrl(video.poster) : undefined,
    locales: Object.fromEntries(
      Object.entries(video.locales).map(([lang, copy]) => [
        lang,
        copy?.src ? { ...copy, src: mediaUrl(copy.src) } : copy,
      ]),
    ),
    captions: video.captions
      ? Object.fromEntries(
          Object.entries(video.captions).map(([lang, path]) => [lang, mediaUrl(path)]),
        )
      : undefined,
  };
}

/** 95 seconds → "1:35". */
export function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export type VideoWords = {
  /** The strip's label and the list page's title. */
  videos: string;
  /** The link at the strip's top right. */
  showAll: string;
  /** The small label on a video, where a reading shows its section. */
  video: string;
  readTranscript: string;
  hideTranscript: string;
  /** A timed transcript: the key beside a chosen line, and the key that makes the words
   * follow the film again after the reader has scrolled them. */
  playFrom: string;
  followFilm: string;
  /** Under the list's title. */
  listNote: string;
  missing: string;
  /** The list page while there is no video yet. */
  empty: string;
  back: string;
  /** The player's own buttons (read out by screen readers) and its one message. */
  play: string;
  pause: string;
  seek: string;
  mute: string;
  unmute: string;
  fullscreen: string;
  exitFullscreen: string;
  failed: string;
  /** After the number of a jump made by double taps: "10 seconds". */
  seconds: string;
  /** The listening panel at the foot of the page. */
  foldPanel: string;
  openPanel: string;
  /** The cross on the cinema screen. */
  closeFilm: string;
  /** The film's own menus: subtitles (off, or a language) and the playing speed. */
  subtitles: string;
  subtitlesOff: string;
  speed: string;
  /** The gear that holds the film's settings, and the panel's own lines. */
  settings: string;
  /** The sound bar beside the speaker. */
  volume: string;
  related: string;
  more: string;
  watchLater: string;
  saved: string;
  savedVideos: string;
  savedEmpty: string;
  share: string;
  copied: string;
  copyLink: string;
};

const WORDS: Record<Lang, VideoWords> = {
  tr: {
    videos: "Videolar",
    showAll: "Tümünü göster",
    video: "Video",
    readTranscript: "Transkripti oku",
    hideTranscript: "Transkripti gizle",
    playFrom: "Buradan izle",
    followFilm: "Videoyu takip et",
    listNote: "Orbis'in bütün videoları, en yeniden en eskiye.",
    missing: "Bu video bulunamadı.",
    empty: "Henüz video yok.",
    back: "Bütün videolar",
    play: "Oynat",
    pause: "Duraklat",
    seek: "Videoda ilerle",
    mute: "Sesi kapat",
    unmute: "Sesi aç",
    fullscreen: "Tam ekran",
    exitFullscreen: "Tam ekrandan çık",
    failed: "Video oynatılamadı. Bağlantınızı kontrol edip yeniden deneyin.",
    seconds: "saniye",
    foldPanel: "Paneli küçült",
    openPanel: "Paneli aç",
    closeFilm: "Videoyu kapat",
    subtitles: "Altyazı",
    subtitlesOff: "Kapalı",
    speed: "Oynatma hızı",
    settings: "Ayarlar",
    volume: "Ses düzeyi",
    related: "İlgili videolar",
    more: "Orbis’ten daha fazlası",
    watchLater: "Daha sonra izle",
    saved: "Kaydedildi",
    savedVideos: "Kaydedilenler",
    savedEmpty: "Henüz kaydedilmiş video yok.",
    share: "Paylaş",
    copied: "Bağlantı kopyalandı",
    copyLink: "Bağlantıyı kopyala",
  },
  en: {
    videos: "Videos",
    showAll: "Show all",
    video: "Video",
    readTranscript: "Read the transcript",
    hideTranscript: "Hide the transcript",
    playFrom: "Play from here",
    followFilm: "Follow the video",
    listNote: "Every Orbis video, newest first.",
    missing: "This video could not be found.",
    empty: "No videos yet.",
    back: "All videos",
    play: "Play",
    pause: "Pause",
    seek: "Seek in the video",
    mute: "Mute",
    unmute: "Unmute",
    fullscreen: "Full screen",
    exitFullscreen: "Exit full screen",
    failed: "The video could not be played. Check your connection and try again.",
    seconds: "seconds",
    foldPanel: "Fold the panel",
    openPanel: "Open the panel",
    closeFilm: "Close the video",
    subtitles: "Subtitles",
    subtitlesOff: "Off",
    speed: "Playback speed",
    settings: "Settings",
    volume: "Volume",
    related: "Related videos",
    more: "More from Orbis",
    watchLater: "Watch later",
    saved: "Saved",
    savedVideos: "Saved videos",
    savedEmpty: "No saved videos yet.",
    share: "Share",
    copied: "Link copied",
    copyLink: "Copy the link",
  },
  ar: {
    videos: "الفيديوهات",
    showAll: "عرض الكل",
    video: "فيديو",
    readTranscript: "اقرأ النص",
    hideTranscript: "إخفاء النص",
    playFrom: "شاهد من هنا",
    followFilm: "تابع الفيديو",
    listNote: "كل فيديوهات أوربيس، من الأحدث إلى الأقدم.",
    missing: "تعذّر العثور على هذا الفيديو.",
    empty: "لا توجد فيديوهات بعد.",
    back: "كل الفيديوهات",
    play: "تشغيل",
    pause: "إيقاف مؤقت",
    seek: "التنقل في الفيديو",
    mute: "كتم الصوت",
    unmute: "تشغيل الصوت",
    fullscreen: "ملء الشاشة",
    exitFullscreen: "الخروج من ملء الشاشة",
    failed: "تعذّر تشغيل الفيديو. تحقّق من الاتصال وحاول مرة أخرى.",
    seconds: "ثانية",
    foldPanel: "تصغير اللوحة",
    openPanel: "فتح اللوحة",
    closeFilm: "إغلاق الفيديو",
    subtitles: "الترجمة",
    subtitlesOff: "إيقاف",
    speed: "سرعة التشغيل",
    settings: "الإعدادات",
    volume: "مستوى الصوت",
    related: "فيديوهات ذات صلة",
    more: "المزيد من أوربيس",
    watchLater: "شاهد لاحقًا",
    saved: "تم الحفظ",
    savedVideos: "الفيديوهات المحفوظة",
    savedEmpty: "لا توجد فيديوهات محفوظة بعد.",
    share: "مشاركة",
    copied: "نُسخ الرابط",
    copyLink: "انسخ الرابط",
  },
  fr: {
    videos: "Vidéos",
    showAll: "Tout afficher",
    video: "Vidéo",
    readTranscript: "Lire la transcription",
    hideTranscript: "Masquer la transcription",
    playFrom: "Lire à partir d’ici",
    followFilm: "Suivre la vidéo",
    listNote: "Toutes les vidéos d’Orbis, des plus récentes aux plus anciennes.",
    missing: "Cette vidéo est introuvable.",
    empty: "Pas encore de vidéo.",
    back: "Toutes les vidéos",
    play: "Lire",
    pause: "Pause",
    seek: "Avancer dans la vidéo",
    mute: "Couper le son",
    unmute: "Activer le son",
    fullscreen: "Plein écran",
    exitFullscreen: "Quitter le plein écran",
    failed: "La vidéo n’a pas pu être lue. Vérifiez votre connexion et réessayez.",
    seconds: "secondes",
    foldPanel: "Réduire le panneau",
    openPanel: "Ouvrir le panneau",
    closeFilm: "Fermer la vidéo",
    subtitles: "Sous-titres",
    subtitlesOff: "Désactivés",
    speed: "Vitesse de lecture",
    settings: "Réglages",
    volume: "Volume",
    related: "Vidéos similaires",
    more: "Plus d’Orbis",
    watchLater: "À regarder plus tard",
    saved: "Enregistré",
    savedVideos: "Vidéos enregistrées",
    savedEmpty: "Aucune vidéo enregistrée.",
    share: "Partager",
    copied: "Lien copié",
    copyLink: "Copier le lien",
  },
  es: {
    videos: "Vídeos",
    showAll: "Ver todos",
    video: "Vídeo",
    readTranscript: "Leer la transcripción",
    hideTranscript: "Ocultar la transcripción",
    playFrom: "Reproducir desde aquí",
    followFilm: "Seguir el vídeo",
    listNote: "Todos los vídeos de Orbis, del más reciente al más antiguo.",
    missing: "No se encontró este vídeo.",
    empty: "Todavía no hay vídeos.",
    back: "Todos los vídeos",
    play: "Reproducir",
    pause: "Pausa",
    seek: "Avanzar en el vídeo",
    mute: "Silenciar",
    unmute: "Activar sonido",
    fullscreen: "Pantalla completa",
    exitFullscreen: "Salir de pantalla completa",
    failed: "No se pudo reproducir el vídeo. Compruebe su conexión e inténtelo de nuevo.",
    seconds: "segundos",
    foldPanel: "Plegar el panel",
    openPanel: "Abrir el panel",
    closeFilm: "Cerrar el vídeo",
    subtitles: "Subtítulos",
    subtitlesOff: "Desactivados",
    speed: "Velocidad",
    settings: "Ajustes",
    volume: "Volumen",
    related: "Vídeos relacionados",
    more: "Más de Orbis",
    watchLater: "Ver más tarde",
    saved: "Guardado",
    savedVideos: "Vídeos guardados",
    savedEmpty: "Todavía no hay vídeos guardados.",
    share: "Compartir",
    copied: "Enlace copiado",
    copyLink: "Copiar el enlace",
  },
};

export function videoWords(lang: Lang): VideoWords {
  return WORDS[lang];
}
