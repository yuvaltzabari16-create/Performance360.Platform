import { useState } from "react";
import { useI18n } from "../lib/i18n";
import { ytEmbed, ytThumb, type Exercise } from "../lib/workout";

/** Thumbnail that turns into the embedded YouTube player on tap (no third-party load until then). */
export function ExerciseVideo({ ex, autoplay = false }: { ex: Pick<Exercise, "video_id" | "video_url" | "name_en">; autoplay?: boolean }) {
  const { t } = useI18n();
  const [play, setPlay] = useState(autoplay);
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

export function Thumb({ ex }: { ex: Pick<Exercise, "video_id"> }) {
  return ex.video_id
    ? <img className="thumbimg" src={ytThumb(ex.video_id)} alt="" loading="lazy" onError={(e) => e.currentTarget.classList.add("broken")} />
    : <span className="thumbimg empty" aria-hidden="true">▶</span>;
}
