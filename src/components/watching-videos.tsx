import { Link } from "@tanstack/react-router";
import { imageSet } from "@/lib/image-set";
import { videoLink } from "@/lib/lang-path";
import { formatDuration, videoWords } from "@/lib/videos";
import type { Lang, VideoCard } from "@/lib/types";

/** Existing published covers, uncropped and unaltered, in one editorial list. */
export function WatchingVideos({ videos, lang, selected, onPlay }: {
  videos: VideoCard[]; lang: Lang; selected?: string; onPlay?: () => void;
}) {
  const words=videoWords(lang);
  return <ol className="watching-videos">{videos.map(video => {
    const title=video.locales[lang]?.title;
    const content=<>
      <span className="watching-video-cover">{video.poster ? <img src={video.poster}
        {...imageSet(video.poster,"(min-width: 768px) 180px, 110px")}
        width={1600} height={900} alt="" loading="lazy" decoding="async" /> : null}</span>
      <span className="watching-video-copy"><span className="paper-title watching-video-title">{title}</span>
        <span className="watching-video-duration" dir="ltr">{formatDuration(video.duration)}</span></span>
    </>;
    return <li key={video.id} data-selected={selected===video.id}>
      {selected===video.id && onPlay ? <button type="button" onClick={onPlay} className="watching-video-link" aria-label={`${words.play}: ${title}`}>{content}</button>
        : <Link {...videoLink(lang,video.id)} className="watching-video-link" aria-label={`${words.play}: ${title}`}>{content}</Link>}
    </li>;
  })}</ol>;
}
