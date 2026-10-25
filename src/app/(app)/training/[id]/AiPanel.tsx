"use client";

import { useEffect, useState, useTransition } from "react";
import { FIELD_KEYS, FIELD_TONES } from "@/lib/builder-fields";
import type { WorkoutPreview } from "@/lib/ai/workout";
import type { Dictionary } from "@/lib/i18n";
import { cx } from "@/components/ui";
import { applyWorkoutPreview, generateWorkoutPreview } from "../ai-actions";

/**
 * "Build with AI" drawer: describe a session, review the generated preview (only exercises from
 * the coach's library), then add it to the current session. Nothing is saved until "Add".
 */
interface Props {
  programId: string;
  sessionId: string;
  tt: Dictionary["training"];
  onClose: () => void;
  onApplied: () => void;
}

export function AiPanel({ programId, sessionId, tt, onClose, onApplied }: Props) {
  const ai = tt.builder.ai;
  const [pending, startTransition] = useTransition();
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<WorkoutPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const generate = () =>
    startTransition(async () => {
      setError(null);
      setPreview(null);
      const r = await generateWorkoutPreview({ prompt });
      if (r.ok) setPreview(r.preview);
      else setError(r.error);
    });

  const apply = () =>
    startTransition(async () => {
      if (!preview) return;
      const r = await applyWorkoutPreview({ sessionId, programId, blocks: preview.blocks.map((b) => ({ section: b.section, items: b.items })) });
      if (r.ok) onApplied();
      else setError(r.error);
    });

  return (
    <div className="no-print fixed inset-y-0 end-0 z-40 flex w-full max-w-md flex-col border-s border-line bg-surface shadow-2xl" role="dialog" aria-label={ai.title}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><span aria-hidden className="text-brand-600">✦</span>{ai.title}</h2>
        <button type="button" onClick={onClose} aria-label={tt.builder.closeLibrary} className="rounded-lg px-2 py-1 text-lg text-muted hover:bg-canvas">×</button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <label className="block text-sm font-medium text-ink">
          <span className="mb-1.5 block">{ai.describe}</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            maxLength={800}
            placeholder={ai.placeholder}
            className="w-full rounded-xl border border-line px-3 py-2 text-sm font-normal outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <span className="num mt-1 block text-end text-xs font-normal text-muted">{prompt.length}/800</span>
        </label>
        <ul className="space-y-1.5">
          {ai.examples.map((ex) => (
            <li key={ex}><button type="button" onClick={() => setPrompt(ex)} className="w-full rounded-lg border border-line px-3 py-2 text-start text-xs text-ink-soft hover:border-brand-300 hover:bg-brand-50/50">{ex}</button></li>
          ))}
        </ul>

        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
        {pending && !preview && <p role="status" className="text-sm text-muted">{ai.generating}</p>}

        {preview && (
          <section aria-label={ai.previewTitle} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{ai.previewTitle}</h3>
            {preview.title && <p className="text-sm font-semibold text-ink"><bdi>{preview.title}</bdi></p>}
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900">{ai.matched.replace("{m}", String(preview.matched)).replace("{t}", String(preview.suggested))}</p>
            {preview.blocks.map((b, i) => (
              <div key={`${b.section}-${i}`} className="rounded-xl border border-line">
                <div className="border-b border-line px-3 py-2 text-sm font-medium text-ink">{i + 1}. {tt.sections[b.section]}</div>
                <ul className="divide-y divide-line">
                  {b.items.map((it) => (
                    <li key={`${it.exerciseId}-${it.name}`} className="px-3 py-2">
                      <div className="text-sm text-ink"><bdi>{it.name}</bdi></div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {FIELD_KEYS.filter((k) => it.values[k]).map((k) => (
                          <span key={k} className={cx("num rounded-md border px-1.5 py-0.5 text-[11px]", FIELD_TONES[k])}>
                            <span className="opacity-70">{tt.builder.fields[k]}</span> <b>{it.values[k]}</b>
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-xs text-muted">{ai.disclaimer}</p>
          </section>
        )}
      </div>

      <div className="flex gap-2 border-t border-line p-3">
        <button type="button" onClick={generate} disabled={pending || prompt.trim().length < 3} className="flex-1 rounded-lg border border-brand-600 bg-surface px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50">
          {pending && !preview ? ai.generating : ai.generate}
        </button>
        {preview && (
          <button type="button" onClick={apply} disabled={pending} className="flex-1 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{ai.apply}</button>
        )}
      </div>
    </div>
  );
}
