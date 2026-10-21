import { useState, type FormEvent } from "react";
import { ExerciseBrowser } from "../../components/ExerciseBrowser";
import { ExerciseVideo } from "../../components/ExerciseMedia";
import { Modal } from "../../components/Modal";
import { ErrorBox, Field, Loading, useAction } from "../../components/ui";
import { CATEGORIES, CATEGORY_REGION, categoryName, loadExercises, useExercises, youtubeId } from "../../lib/exercises";
import { useI18n } from "../../lib/i18n";
import { useSession } from "../../lib/session";
import { must, supabase } from "../../lib/supabase";
import { exName, type Exercise } from "../../lib/workout";

export function Library() {
  const { t, lang } = useI18n();
  const { list, error } = useExercises();
  const [open, setOpen] = useState<Exercise | null>(null);
  const [adding, setAdding] = useState(false);

  if (error) return <ErrorBox message={error} />;
  if (!list) return <Loading />;

  return (
    <>
      <div className="spread">
        <div><h1>{t.library}</h1><p className="sub">{list.length} {t.exercises}</p></div>
        <button className="btn" onClick={() => setAdding(true)}>+ {t.addCustomExercise}</button>
      </div>
      <section className="panel">
        <ExerciseBrowser list={list} onSelect={setOpen} />
      </section>
      {open && (
        <Modal title={exName(open, lang)} onClose={() => setOpen(null)} wide>
          <ExerciseDetail ex={open} onSaved={(e) => setOpen(e)} />
        </Modal>
      )}
      {adding && (
        <Modal title={t.addCustomExercise} onClose={() => setAdding(false)}>
          <ExerciseForm onDone={() => setAdding(false)} />
        </Modal>
      )}
    </>
  );
}

export function ExerciseDetail({ ex, onSaved }: { ex: Exercise; onSaved?: (e: Exercise) => void }) {
  const { t, lang } = useI18n();
  const { role } = useSession();
  const [editing, setEditing] = useState(false);
  const canEdit = !!ex.club_id && (role === "director" || role === "coach");
  return (
    <div className="stack" style={{ gap: 12 }}>
      <ExerciseVideo ex={ex} />
      <div className="row">
        <span className="tag">{t.region[ex.region as keyof typeof t.region] ?? ex.region}</span>
        <span className="tag">{categoryName(ex.category, lang)}</span>
        {ex.equipment.map((k) => <span key={k} className="tag">{t.equipment[k] ?? k}</span>)}
      </div>
      {lang === "he" && ex.name_he && <p className="muted" style={{ margin: 0 }} dir="ltr">{ex.name_en}</p>}
      {editing ? <ExerciseForm ex={ex} onDone={(e) => { setEditing(false); if (e) onSaved?.(e); }} /> : (
        <>
          {ex.cues.length > 0 && (
            <div><span className="lbl">{t.cues}</span><ul style={{ margin: "6px 0 0", paddingInlineStart: 18 }}>{ex.cues.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
          )}
          {ex.notes && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{ex.notes}</p>}
          {canEdit && <div><button className="btn sm ghost" onClick={() => setEditing(true)}>{t.edit}</button></div>}
        </>
      )}
    </div>
  );
}

/** Create a club exercise, or edit one the club owns. */
function ExerciseForm({ ex, onDone }: { ex?: Exercise; onDone: (e?: Exercise) => void }) {
  const { t, lang } = useI18n();
  const { club } = useSession();
  const act = useAction();
  const [name, setName] = useState(ex?.name_en ?? "");
  const [nameHe, setNameHe] = useState(ex?.name_he ?? "");
  const [cat, setCat] = useState(ex?.category ?? "squat");
  const [eq, setEq] = useState<string[]>(ex?.equipment ?? ["bodyweight"]);
  const [yt, setYt] = useState(ex?.video_id ? `https://youtu.be/${ex.video_id}` : "");
  const [cues, setCues] = useState((ex?.cues ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const allEq = Object.keys(t.equipment);
  const vid = yt.trim() ? youtubeId(yt.trim()) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const row = {
      name_en: name.trim(), name_he: nameHe.trim() || null, category: cat, region: CATEGORY_REGION[cat] ?? "other",
      equipment: eq.length ? eq : ["bodyweight"], video_id: vid, cues: cues.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    let saved: Exercise | undefined;
    const ok = await act(async () => {
      saved = ex
        ? must(await supabase.from("exercises").update(row).eq("id", ex.id).select("*").single()) as Exercise
        : must(await supabase.from("exercises").insert({ ...row, club_id: club!.id }).select("*").single()) as Exercise;
      await loadExercises(true);
    }, ex ? t.saved : t.exerciseAdded);
    setBusy(false);
    if (ok) onDone(saved);
  }

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
      <div className="form">
        <Field label={t.exerciseName}><input type="text" required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t.nameHe}><input type="text" maxLength={160} value={nameHe} onChange={(e) => setNameHe(e.target.value)} /></Field>
        <Field label={t.category}>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{lang === "he" ? c.he : c.en}</option>)}
          </select>
        </Field>
        <Field label={t.youtubeUrl}><input type="text" dir="ltr" value={yt} onChange={(e) => setYt(e.target.value)} placeholder="https://youtu.be/…" /></Field>
      </div>
      {yt.trim() && !vid && <span className="err">{t.youtubeUrl}?</span>}
      <div>
        <span className="lbl">{t.equipmentL}</span>
        <div className="row" style={{ marginTop: 6 }}>
          {allEq.map((k) => (
            <label key={k} className="check tag" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={eq.includes(k)} onChange={(e) => setEq(e.target.checked ? [...eq, k] : eq.filter((x) => x !== k))} />{t.equipment[k]}
            </label>
          ))}
        </div>
      </div>
      <Field label={`${t.cues} · ${t.cuesHint}`}><textarea value={cues} onChange={(e) => setCues(e.target.value)} /></Field>
      <div className="row">
        <button className="btn" disabled={busy || !name.trim() || (!!yt.trim() && !vid)}>{t.save}</button>
        <button type="button" className="btn ghost" onClick={() => onDone()}>{t.cancel}</button>
      </div>
    </form>
  );
}
