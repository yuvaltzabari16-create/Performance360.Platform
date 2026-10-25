"use client";

import { useRef, useState } from "react";

interface Labels { speed: string; normal: string; restart: string; speedHelp: string }

const SPEEDS = [0.25, 0.5, 0.75, 1] as const;

/**
 * Exercise video for learning: a looping embed with captions where the video has them, and speed buttons so the
 * movement can be watched in slow motion. The buttons talk to the YouTube player with its documented
 * postMessage commands; the video keeps playing normally if they are ignored (other hosts).
 */
export function ExercisePlayer({ src, title, vertical, labels, speedControl }: { src: string; title: string; vertical?: boolean; labels: Labels; speedControl: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [rate, setRate] = useState<number>(1);

  function command(func: string, args: unknown[] = []) {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "https://www.youtube-nocookie.com");
  }

  return (
    <div>
      <div className={vertical ? "mx-auto aspect-[9/16] max-h-[70vh] overflow-hidden rounded-2xl bg-black shadow-[var(--shadow-card)]" : "aspect-video overflow-hidden rounded-2xl bg-black shadow-[var(--shadow-card)]"}>
        <iframe ref={frame} src={src} title={title} className="size-full" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
      </div>
      {speedControl && (
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={labels.speed} data-testid="player-speed">
          <span className="text-xs font-medium text-muted">{labels.speed}</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={rate === s}
              onClick={() => { setRate(s); command("setPlaybackRate", [s]); }}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition-colors ${rate === s ? "bg-brand-600 text-white ring-brand-600" : "bg-surface text-ink-soft ring-line hover:bg-brand-50"}`}
            >
              {s === 1 ? labels.normal : `${s}×`}
            </button>
          ))}
          <button type="button" onClick={() => command("seekTo", [0, true])} className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink-soft ring-1 ring-inset ring-line hover:bg-brand-50">↺ {labels.restart}</button>
          <span className="basis-full text-[11px] text-muted">{labels.speedHelp}</span>
        </div>
      )}
    </div>
  );
}
