"use client";

import { useMemo, useState } from "react";
import { ChipRow } from "@/components/training/chips";
import { cx } from "@/components/ui";
import type { FieldKey } from "@/lib/builder-fields";
import type { SessionSection } from "@/lib/catalog";
import type { SessionExercise } from "@/lib/types";

/**
 * Today's-workout checklist for the athlete: exercises grouped in blocks, prescription chips,
 * a big tick to mark each exercise done, optional "what I actually did" fields, live progress.
 * It renders form fields only; the surrounding <form> and the Save button live in the page.
 */

export interface LogDefaults { done: boolean; actual_sets: number | null; actual_reps: string | null; actual_load_kg: number | null; feedback: string | null }

interface Props {
  exercises: SessionExercise[];
  logs: Record<string, LogDefaults>;
  labels: {
    sections: Record<SessionSection, string>;
    fields: Record<FieldKey, string>;
    progress: string; // contains {d} and {t}
    details: string;
    actualSets: string;
    actualReps: string;
    actualLoad: string;
    notes: string;
    markDone: string;
  };
}

const box = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export function WorkoutChecklist({ exercises, logs, labels }: Props) {
  const [done, setDone] = useState<Record<string, boolean>>(() => Object.fromEntries(exercises.map((e) => [e.id, logs[e.id]?.done ?? false])));
  const total = exercises.length;
  const count = Object.values(done).filter(Boolean).length;
  const pct = total ? Math.round((count / total) * 100) : 0;

  // Blocks follow the planned order.
  const blocks = useMemo(() => {
    const order: SessionSection[] = [];
    exercises.forEach((e) => { if (!order.includes(e.section as SessionSection)) order.push(e.section as SessionSection); });
    return order.map((section) => ({ section, items: exercises.filter((e) => e.section === section) }));
  }, [exercises]);

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-1 rounded-xl border border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-medium text-ink">{labels.progress.replace("{d}", String(count)).replace("{t}", String(total))}</span>
          <span className="num text-muted">{pct}%</span>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={labels.progress.replace("{d}", String(count)).replace("{t}", String(total))} className="h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {blocks.map((blk, bi) => (
        <section key={blk.section} aria-label={labels.sections[blk.section]} className="rounded-2xl border border-line bg-surface">
          <h3 className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold text-ink">
            <span className="grid size-6 place-items-center rounded-full bg-brand-50 text-xs text-brand-700" aria-hidden>{bi + 1}</span>
            {labels.sections[blk.section]}
          </h3>
          <ol className="space-y-2 p-3">
            {blk.items.map((e, i) => {
              const log = logs[e.id];
              const isDone = done[e.id];
              return (
                <li key={e.id} className={cx("rounded-xl border p-3 transition-colors", isDone ? "border-brand-300 bg-brand-50/60" : "border-line bg-canvas/60")}>
                  <input type="hidden" name="se_ids" value={e.id} />
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      name={`done_${e.id}`}
                      checked={isDone}
                      onChange={(ev) => setDone((d) => ({ ...d, [e.id]: ev.target.checked }))}
                      className="mt-0.5 size-6 shrink-0 accent-brand-600"
                      aria-label={`${labels.markDone}: ${e.exercise_name}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-muted" aria-hidden>{String.fromCharCode(65 + (i % 26))}</span>
                        <bdi className={cx("font-medium text-ink", isDone && "line-through decoration-brand-400")}>{e.exercise_name}</bdi>
                      </span>
                      <ChipRow e={e} labels={labels.fields} className="mt-2" />
                      {(e.cues || e.modifications) && <span className="mt-1.5 block text-xs text-muted">{[e.cues, e.modifications].filter(Boolean).join(" · ")}</span>}
                    </span>
                  </label>
                  <details className="mt-2 ps-9">
                    <summary className="cursor-pointer text-xs font-medium text-brand-700">{labels.details}</summary>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <input className={box} name={`sets_${e.id}`} type="number" min={0} placeholder={labels.actualSets} aria-label={labels.actualSets} defaultValue={log?.actual_sets ?? ""} />
                      <input className={box} name={`reps_${e.id}`} placeholder={labels.actualReps} aria-label={labels.actualReps} defaultValue={log?.actual_reps ?? ""} />
                      <input className={box} name={`load_${e.id}`} type="number" step="0.5" min={0} placeholder={labels.actualLoad} aria-label={labels.actualLoad} defaultValue={log?.actual_load_kg ?? ""} />
                      <input className={box} name={`fb_${e.id}`} placeholder={labels.notes} aria-label={labels.notes} defaultValue={log?.feedback ?? ""} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
