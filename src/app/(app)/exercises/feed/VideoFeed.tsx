"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { embedUrl, youtubeThumbnail } from "@/lib/catalog";
import { setFavorite } from "../actions";

export interface FeedItem {
  id: string;
  name: string;
  categoryLabel: string;
  pattern: string | null;
  cues: string[];
  equipment: string[];
  video_url: string;
  thumbnail_url: string | null;
  favorite: boolean;
}

interface Labels {
  tapToPlay: string;
  details: string;
  openOnYouTube: string;
  favorite: string;
  unfavorite: string;
  empty: string;
}

/**
 * Vertical, snap-scrolling exercise video feed. Only thumbnails load up front;
 * a video iframe is created when the viewer taps, and removed once it scrolls away,
 * so at most one player runs at a time.
 */
export function VideoFeed({ items, labels }: { items: FeedItem[]; labels: Labels }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [favs, setFavs] = useState(() => new Set(items.filter((i) => i.favorite).map((i) => i.id)));
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-id="${playing}"]`);
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio < 0.5) setPlaying((p) => (p === playing ? null : p));
    }, { root: containerRef.current, threshold: [0.5] });
    obs.observe(el);
    return () => obs.disconnect();
  }, [playing]);

  if (items.length === 0) return <p className="py-12 text-center text-sm text-muted">{labels.empty}</p>;

  return (
    <div ref={containerRef} className="h-[calc(100dvh-12rem)] snap-y snap-mandatory overflow-y-auto rounded-2xl bg-black lg:h-[calc(100dvh-11rem)]">
      {items.map((item) => {
        const active = playing === item.id;
        const media = active ? embedUrl(item.video_url, { autoplay: true, learn: true }) : null;
        const thumb = item.thumbnail_url ?? youtubeThumbnail(item.video_url);
        const isFav = favs.has(item.id);
        return (
          <section key={item.id} data-id={item.id} className="relative flex h-full snap-start snap-always items-center justify-center">
            {media?.kind === "iframe" ? (
              <iframe
                src={media.src}
                title={item.name}
                className={media.vertical ? "aspect-[9/16] h-full max-w-full" : "aspect-video w-full max-h-full"}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <button type="button" onClick={() => setPlaying(item.id)} className="group relative size-full" aria-label={`${labels.tapToPlay}: ${item.name}`}>
                {thumb && (
                  // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
                  <img src={thumb} alt="" loading="lazy" className="absolute inset-0 size-full object-contain opacity-80" />
                )}
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid size-16 place-items-center rounded-full bg-white/90 text-2xl text-brand-700 shadow-lg transition-transform group-hover:scale-105">▶</span>
                </span>
              </button>
            )}

            {/* Info overlay; pointer-events only on its controls so the video stays usable. */}
            <div className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-4 pt-16 text-white transition-opacity sm:p-6 ${active ? "opacity-0 hover:opacity-100" : ""}`}>
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full bg-brand-500/90 px-2 py-0.5 font-medium">{item.categoryLabel}</span>
                    {item.pattern && <span className="rounded-full bg-white/15 px-2 py-0.5"><bdi>{item.pattern}</bdi></span>}
                    {item.equipment.filter((e) => e !== "bodyweight").slice(0, 3).map((e) => <span key={e} className="rounded-full bg-white/15 px-2 py-0.5"><bdi>{e}</bdi></span>)}
                  </div>
                  <h2 className="text-lg font-semibold sm:text-xl"><bdi>{item.name}</bdi></h2>
                  {item.cues.length > 0 && <p className="mt-1 line-clamp-2 text-sm text-white/80"><bdi>{item.cues.join(" · ")}</bdi></p>}
                </div>
                <div className="pointer-events-auto flex shrink-0 flex-col items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isFav;
                      setFavs((s) => { const n = new Set(s); if (next) n.add(item.id); else n.delete(item.id); return n; });
                      startTransition(async () => {
                        const saved = await setFavorite(item.id, next);
                        if (saved !== next) setFavs((s) => { const n = new Set(s); if (saved) n.add(item.id); else n.delete(item.id); return n; });
                      });
                    }}
                    aria-pressed={isFav}
                    aria-label={isFav ? labels.unfavorite : labels.favorite}
                    className="grid size-11 place-items-center rounded-full bg-white/15 text-xl hover:bg-white/25"
                  >
                    {isFav ? "★" : "☆"}
                  </button>
                  <Link href={`/exercises/${item.id}`} className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label={labels.details}>ⓘ</Link>
                  <a href={item.video_url} target="_blank" rel="noopener noreferrer" className="grid size-11 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label={labels.openOnYouTube}>↗</a>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
