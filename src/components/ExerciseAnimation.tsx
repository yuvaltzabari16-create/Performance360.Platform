import { useEffect, useMemo, useRef, useState } from "react";
import { animFor, MUSCLE_LABEL } from "../lib/anim/catalog";
import { renderSVG } from "../lib/anim/engine";
import { useI18n } from "../lib/i18n";
import type { Exercise } from "../lib/workout";
import { ExerciseVideo } from "./ExerciseMedia";

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Looping illustrated demo with the working muscles highlighted, plus the real video below when there is one. */
export function ExerciseDemo({ ex }: { ex: Exercise }) {
  const { t, lang } = useI18n();
  const anim = useMemo(() => animFor(ex), [ex.category, ex.name_en, ex.equipment?.join()]);
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const svg = useMemo(() => renderSVG(anim, { animate: true, title: ex.name_en }), [anim, ex.name_en]);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current?.querySelector("svg") as SVGSVGElement | null;
    if (!el) return;
    if (playing) el.unpauseAnimations?.(); else el.pauseAnimations?.();
  }, [playing, svg]);
  const hasVideo = !!(ex.video_id || ex.video_url);
  return (
    <div className="exdemo">
      <div className="exdemo-stage">
        <div ref={box} className="exdemo-svg" role="img" aria-label={`${t.movementDemo}: ${ex.name_en}`} dangerouslySetInnerHTML={{ __html: svg }} />
        <button className="btn icon sm exdemo-toggle" onClick={() => setPlaying(!playing)} aria-label={playing ? t.pause : t.play} aria-pressed={!playing}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{playing ? <path d="M7 5h4v14H7zm6 0h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}</svg>
        </button>
      </div>
      <div className="exdemo-muscles">
        <span className="muted">{t.workingMuscles}</span>
        {anim.muscles.map((m) => <span key={m} className="muscle-chip"><i aria-hidden="true" />{MUSCLE_LABEL[m][lang === "he" ? "he" : "en"]}</span>)}
      </div>
      {hasVideo && (
        <details className="exdemo-video">
          <summary>{t.realVideo}</summary>
          <ExerciseVideo ex={ex} />
        </details>
      )}
    </div>
  );
}
