import { useState } from "react";
import { useI18n } from "../lib/i18n";
import {
  codes, FIELD_KEYS, newItem, uid,
  type BlockKind, type Exercise, type FieldKey, type WorkoutBlock, type WorkoutContent, type WorkoutItem,
} from "../lib/workout";
import { ExerciseBrowser } from "./ExerciseBrowser";
import { Thumb } from "./ExerciseMedia";
import { Modal } from "./Modal";
import { ExerciseDetail } from "../pages/coach/Library";

type Target = { section: string; block?: string };

/** Fully editable workout document: sections → blocks (single / superset / circuit) → exercises → sets × fields. */
export function WorkoutEditor({ value, onChange, exercises }: {
  value: WorkoutContent; onChange: (v: WorkoutContent) => void; exercises: Exercise[];
}) {
  const { t, lang } = useI18n();
  const [picker, setPicker] = useState<Target | null>(null);
  const [video, setVideo] = useState<Exercise | null>(null);
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const code = codes(value);

  // Every edit goes through a deep copy so React sees a new value.
  const edit = (fn: (c: WorkoutContent) => void) => { const c = structuredClone(value); fn(c); onChange(c); };
  const findBlock = (c: WorkoutContent, sid: string, bid: string) => c.sections.find((s) => s.id === sid)!.blocks.find((b) => b.id === bid)!;
  const move = <T,>(arr: T[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

  function addExercise(ex: Exercise) {
    const name = (lang === "he" && ex.name_he) || ex.name_en;
    edit((c) => {
      const s = c.sections.find((x) => x.id === picker!.section)!;
      if (picker!.block) {
        const b = s.blocks.find((x) => x.id === picker!.block)!;
        const sets = b.items[0]?.sets.length ?? 3;
        b.items.push({ ...newItem({ id: ex.id, name }), sets: Array.from({ length: sets }, () => ({})) });
        if (b.kind === "single") b.kind = "superset";
      } else {
        s.blocks.push({ id: uid(), kind: "single", items: [newItem({ id: ex.id, name })] });
      }
    });
    setPicker(null);
  }

  return (
    <div className="weditor">
      {value.sections.map((s, si) => (
        <section key={s.id} className="wsection">
          <div className="wsection-head">
            <input className="wsection-title" value={s.title} placeholder={t.sectionTitle} aria-label={t.sectionTitle}
              onChange={(e) => edit((c) => { c.sections[si].title = e.target.value; })} />
            <span className="iacts">
              <button className="btn icon" title={t.moveUp} onClick={() => edit((c) => move(c.sections, si, -1))}>↑</button>
              <button className="btn icon" title={t.moveDown} onClick={() => edit((c) => move(c.sections, si, 1))}>↓</button>
              <button className="btn icon" title={t.delete} onClick={() => edit((c) => { c.sections.splice(si, 1); })}>✕</button>
            </span>
          </div>

          {s.blocks.map((b, bi) => (
            <BlockView key={b.id} block={b} code={code} byId={byId}
              onKind={(k, rounds) => edit((c) => { const x = findBlock(c, s.id, b.id); x.kind = k; if (k === "single") delete x.rounds; else x.rounds = rounds ?? x.rounds ?? x.items[0]?.sets.length ?? 3; })}
              onItem={(ii, it) => edit((c) => { findBlock(c, s.id, b.id).items[ii] = it; })}
              onRemoveItem={(ii) => edit((c) => { const x = findBlock(c, s.id, b.id); x.items.splice(ii, 1); if (!x.items.length) c.sections[si].blocks.splice(bi, 1); else if (x.items.length === 1) { x.kind = "single"; delete x.rounds; } })}
              onMoveItem={(ii, d) => edit((c) => move(findBlock(c, s.id, b.id).items, ii, d))}
              onMoveBlock={(d) => edit((c) => move(c.sections[si].blocks, bi, d))}
              onAddToBlock={() => setPicker({ section: s.id, block: b.id })}
              onVideo={(ex) => setVideo(ex)}
            />
          ))}

          <div className="row">
            <button className="btn sm ghost" onClick={() => setPicker({ section: s.id })}>+ {t.addExercise}</button>
          </div>
        </section>
      ))}

      {value.sections.length === 0 && <p className="empty">{t.emptyWorkout}</p>}
      <div><button className="btn ghost" onClick={() => edit((c) => { c.sections.push({ id: uid(), title: "", blocks: [] }); })}>+ {t.addSection}</button></div>

      {picker && (
        <Modal title={t.pickExercise} onClose={() => setPicker(null)} wide>
          <ExerciseBrowser list={exercises} onSelect={addExercise} compact />
        </Modal>
      )}
      {video && (
        <Modal title={(lang === "he" && video.name_he) || video.name_en} onClose={() => setVideo(null)} wide>
          <ExerciseDetail ex={video} />
        </Modal>
      )}
    </div>
  );
}

function BlockView({ block, code, byId, onKind, onItem, onRemoveItem, onMoveItem, onMoveBlock, onAddToBlock, onVideo }: {
  block: WorkoutBlock; code: Map<string, string>; byId: Map<string, Exercise>;
  onKind: (k: BlockKind, rounds?: number) => void; onItem: (i: number, it: WorkoutItem) => void; onRemoveItem: (i: number) => void;
  onMoveItem: (i: number, d: number) => void; onMoveBlock: (d: number) => void; onAddToBlock: () => void; onVideo: (e: Exercise) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={"wblock " + block.kind}>
      <div className="wblock-head">
        <select value={block.kind} onChange={(e) => onKind(e.target.value as BlockKind)} aria-label={t.type} style={{ width: "auto" }}>
          <option value="single">{t.single}</option>
          <option value="superset">{t.superset}</option>
          <option value="circuit">{t.circuit}</option>
        </select>
        {block.kind !== "single" && (
          <label className="row" style={{ gap: 4 }}>
            <input type="number" min={1} max={20} value={block.rounds ?? ""} style={{ width: 64 }} aria-label={t.rounds}
              onChange={(e) => onKind(block.kind, Number(e.target.value) || 1)} />
            <span className="muted" style={{ fontSize: 12 }}>{t.rounds}</span>
          </label>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn sm ghost" onClick={onAddToBlock}>+ {t.addToBlock}</button>
        <button className="btn icon" title={t.moveUp} onClick={() => onMoveBlock(-1)}>↑</button>
        <button className="btn icon" title={t.moveDown} onClick={() => onMoveBlock(1)}>↓</button>
      </div>
      {block.items.map((it, i) => (
        <ItemView key={it.id} item={it} code={code.get(it.id) ?? ""} ex={it.exercise_id ? byId.get(it.exercise_id) : undefined}
          onChange={(v) => onItem(i, v)} onRemove={() => onRemoveItem(i)} onMove={(d) => onMoveItem(i, d)} onVideo={onVideo} />
      ))}
    </div>
  );
}

function ItemView({ item, code, ex, onChange, onRemove, onMove, onVideo }: {
  item: WorkoutItem; code: string; ex?: Exercise; onChange: (v: WorkoutItem) => void; onRemove: () => void; onMove: (d: number) => void; onVideo: (e: Exercise) => void;
}) {
  const { t } = useI18n();
  const set = (patch: Partial<WorkoutItem>) => onChange({ ...item, ...patch });
  const unused = FIELD_KEYS.filter((f) => !item.fields.includes(f));
  const setCell = (row: number, f: FieldKey, v: string) => set({ sets: item.sets.map((r, i) => (i === row ? { ...r, [f]: v } : r)) });

  return (
    <div className="witem">
      <div className="witem-head">
        <span className="code">{code}</span>
        {ex ? <button className="thumbbtn" onClick={() => onVideo(ex)} aria-label={t.video}><Thumb ex={ex} /></button> : <span className="thumbimg empty" aria-hidden="true">•</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          {ex ? <button className="exn" onClick={() => onVideo(ex)}>{item.name}</button> : <input value={item.name} onChange={(e) => set({ name: e.target.value })} aria-label={t.exerciseName} />}
          <input className="inote" placeholder={t.note} value={item.note ?? ""} onChange={(e) => set({ note: e.target.value })} aria-label={t.note} />
        </div>
        <span className="iacts">
          <button className="btn icon" title={t.moveUp} onClick={() => onMove(-1)}>↑</button>
          <button className="btn icon" title={t.moveDown} onClick={() => onMove(1)}>↓</button>
          <button className="btn icon" title={t.delete} onClick={onRemove}>✕</button>
        </span>
      </div>
      <div className="tbl-wrap">
        <table className="sets">
          <thead>
            <tr>
              <th>{t.set}</th>
              {item.fields.map((f) => (
                <th key={f}>
                  {t.fields[f]}
                  <button className="fx" title={t.delete} onClick={() => set({ fields: item.fields.filter((x) => x !== f) })}>×</button>
                </th>
              ))}
              <th>
                {unused.length > 0 && (
                  <select value="" onChange={(e) => e.target.value && set({ fields: [...item.fields, e.target.value as FieldKey] })} aria-label={t.addField} className="addfield">
                    <option value="">{t.addField}</option>
                    {unused.map((f) => <option key={f} value={f}>{t.fields[f]}</option>)}
                  </select>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {item.sets.map((row, ri) => (
              <tr key={ri}>
                <td className="num muted">{ri + 1}</td>
                {item.fields.map((f) => (
                  <td key={f}><input className="cell" value={row[f] ?? ""} onChange={(e) => setCell(ri, f, e.target.value)} aria-label={`${t.set} ${ri + 1} ${t.fields[f]}`} /></td>
                ))}
                <td><button className="btn icon" title={t.removeSet} onClick={() => set({ sets: item.sets.filter((_, i) => i !== ri) })}>−</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <button className="btn sm ghost" onClick={() => set({ sets: [...item.sets, {}] })}>+ {t.addSet}</button>
        {item.sets.length > 0 && <button className="btn sm ghost" onClick={() => set({ sets: [...item.sets, { ...item.sets[item.sets.length - 1] }] })}>⧉ {t.copySet}</button>}
      </div>
    </div>
  );
}
