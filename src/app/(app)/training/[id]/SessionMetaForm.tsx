"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AutosaveStatus } from "@/components/autosave/AutosaveStatus";
import { useAutosave } from "@/lib/autosave/useAutosave";
import { saveSessionMeta } from "../builder-actions";

/** Session details that save themselves a moment after you stop typing. */
interface Props {
  programId: string;
  session: { id: string; title: string; week_number: number; day_number: number; planned_duration_min: number | null; notes: string | null };
  maxWeek: number;
  labels: { title: string; week: string; day: string; minutes: string; notes: string; saving: string; saved: string; failed: string };
}

const box = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export function SessionMetaForm({ programId, session, maxWeek, labels }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(session.title);
  const [week, setWeek] = useState(session.week_number);
  const [day, setDay] = useState(session.day_number);
  const [minutes, setMinutes] = useState(session.planned_duration_min?.toString() ?? "");
  const [notes, setNotes] = useState(session.notes ?? "");

  const value = useMemo(() => ({ title, week, day, minutes, notes }), [title, week, day, minutes, notes]);
  const { status } = useAutosave({
    value,
    enabled: title.trim().length > 0,
    save: async (v) => {
      const r = await saveSessionMeta({ id: session.id, programId, title: v.title, week: v.week, day: v.day, minutes: v.minutes === "" ? null : Number(v.minutes), notes: v.notes });
      if (r.ok && v.week !== session.week_number) router.replace(`/training/${programId}?week=${v.week}&session=${session.id}`);
      return { ok: r.ok };
    },
  });

  return (
    <div className="space-y-2">
      <label className="block text-sm"><span className="mb-1 block text-xs text-muted">{labels.title}</span>
        <input className={box} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block text-sm"><span className="mb-1 block text-xs text-muted">{labels.week}</span>
          <input className={box} type="number" min={1} max={maxWeek} value={week} onChange={(e) => setWeek(Number(e.target.value))} />
        </label>
        <label className="block text-sm"><span className="mb-1 block text-xs text-muted">{labels.day}</span>
          <input className={box} type="number" min={1} max={7} value={day} onChange={(e) => setDay(Number(e.target.value))} />
        </label>
        <label className="block text-sm"><span className="mb-1 block text-xs text-muted">{labels.minutes}</span>
          <input className={box} type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
      </div>
      <label className="block text-sm"><span className="mb-1 block text-xs text-muted">{labels.notes}</span>
        <textarea className={box} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} />
      </label>
      <AutosaveStatus status={status} labels={{ saving: labels.saving, saved: labels.saved, failed: labels.failed }} />
    </div>
  );
}
