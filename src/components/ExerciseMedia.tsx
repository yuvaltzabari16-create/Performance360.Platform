import { useState } from "react";
import { DEMO, ytWatch } from "../lib/demo";
import { useI18n } from "../lib/i18n";
import { ytEmbed, type Exercise } from "../lib/workout";
import { animFor } from "../lib/anim/catalog";
import { renderSVG } from "../lib/anim/engine";

/** Thumbnail that turns into the embedded YouTube player on tap (no third-party load until then). */
export function ExerciseVideo({ ex, autoplay = false }: { ex: Pick<Exercise, "video_id" | "video_url" | "name_en">; autoplay?: boolean }) {
  const { t } = useI18n();
  const [play, setPlay] = useState(autoplay);
  // The demo runs where other sites can't be embedded: open the demo on YouTube instead.
  if (DEMO && ex.video_id) {
    return (
      <a className="video linkout" href={ytWatch(ex.video_id)} target="_blank" rel="noreferrer">
        <span className="play" aria-hidden="true">▶</span>
        <span className="linkout-label">{t.watchYoutube} ↗</span>
      </a>
    );
  }
  if (ex.video_id) {
    return play ? (
      <div className="video">
        <iframe src={ytEmbed(ex.video_id) + "&autoplay=1"} title={ex.name_en} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      </div>
    ) : (
      <button className="video thumb" onClick={() => setPlay(true)} aria-label={`${t.video}: ${ex.name_en}`}>
        <img src={ytThumb(ex.video_id)} alt="" loading="lazy" onError={(e) => e.currentTarget.classList.add("broken")} />
        <span className="play" aria-hidden="true">▶</span>
      </button>
    );
  }
  if (ex.video_url) {
    return <a className="btn ghost sm" href={ex.video_url} target="_blank" rel="noreferrer">{t.openExternal} ↗</a>;
  }
  return <div className="video empty">{t.noVideo}</div>;
}

type ExLike = Pick<Exercise, "category" | "name_en" | "equipment">;
const stillCache = new Map<string, string>();

/** Still frame of the exercise's movement illustration (thumbnails and lists; no network needed). */
export function Thumb({ ex, className = "thumbimg anim" }: { ex: ExLike; className?: string }) {
  const key = `${ex.category}|${ex.name_en}|${(ex.equipment ?? []).join()}`;
  let svg = stillCache.get(key);
  if (!svg) { svg = renderSVG(animFor(ex), { animate: false }); stillCache.set(key, svg); }
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}
