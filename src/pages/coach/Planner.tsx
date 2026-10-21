import { useEffect, useMemo, useState } from "react";
import { AiPanel } from "../../components/AiPanel";
import { AssignDialog } from "../../components/AssignDialog";
import { ConfirmButton, ErrorBox, Field, Loading, useAction } from "../../components/ui";
import { WorkoutEditor } from "../../components/WorkoutEditor";
import { loadClub } from "../../lib/data";
import { useExercises } from "../../lib/exercises";
import { useI18n } from "../../lib/i18n";
import { navigate } from "../../lib/router";
import { useSession } from "../../lib/session";
import { must, supabase } from "../../lib/supabase";
import { useAsync } from "../../lib/useAsync";
import { countExercises, emptyContent, FOCI, type Workout, type WorkoutContent } from "../../lib/workout";

interface Draft { id: string | null; title: string; focus: string | null; est_minutes: number | null; description: string; content: WorkoutContent }
const blank = (): Draft => ({ id: null, title: "", focus: null, est_minutes: null, description: "", content: emptyContent() });
const fromWorkout = (w: Workout): Draft => ({ id: w.id, title: w.title, focus: w.focus, est_minutes: w.est_minutes, description: w.description ?? "", content: w.content });

export function Planner({ id }: { id: string | null }) {
  const { t } = useI18n();
  const { club, userId, role } = useSession();
  const act = useAction();
  const ex = useExercises();
  const [term, setTerm] = useState("");
  const [draft, setDraft] = useState<Draft>(blank);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [pane, setPane] = useState<"list" | "editor" | "ai">(id ? "editor" : "list");

  const q = useAsync(async () => {
    const [c, w] = await Promise.all([
      loadClub(club!.id),
      supabase.from("workouts").select("*").eq("club_id", club!.id).is("archived_at", null).order("updated_at", { ascending: false }),
    ]);
    return { club: c, workouts: must(w) as Workout[] };
  }, [club?.id]);

  // Load the selected workout into the editor (unless we're holding unsaved AI output for a new one).
  useEffect(() => {
    if (!q.data) return;
    if (id && id !== "new") {
      const w = q.data.workouts.find((x) => x.id === id);
      if (w && draft.id !== w.id) { setDraft(fromWorkout(w)); setDirty(false); }
    } else if (id === "new" && draft.id) { setDraft(blank()); setDirty(false); }
  }, [id, q.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    const n = term.trim().toLowerCase();
    return (q.data?.workouts ?? []).filter((w) => !n || w.title.toLowerCase().includes(n));
  }, [q.data, term]);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (ex.error) return <ErrorBox message={ex.error} />;
  if (!q.data || !ex.list) return <Loading />;

  const update = (patch: Partial<Draft>) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); };
  const editing = id !== null;

  async function save(): Promise<string | null> {
    setBusy(true);
    let savedId: string | null = draft.id;
    const row = {
      title: draft.title.trim() || t.untitled, focus: draft.focus, est_minutes: draft.est_minutes,
      description: draft.description.trim() || null, content: draft.content,
    };
    const ok = await act(async () => {
      if (draft.id) must(await supabase.from("workouts").update(row).eq("id", draft.id));
      else savedId = (must(await supabase.from("workouts").insert({ ...row, club_id: club!.id }).select("id").single()) as { id: string }).id;
    }, t.workoutSaved);
    setBusy(false);
    if (!ok) return null;
    setDirty(false);
    setDraft((d) => ({ ...d, id: savedId, title: row.title }));
    await q.reload();
    if (savedId && savedId !== id) navigate(`/planner/${savedId}`);
    return savedId;
  }

  async function duplicate() {
    await act(async () => {
      const r = must(await supabase.from("workouts").insert({
        club_id: club!.id, title: `${draft.title} (2)`, focus: draft.focus, est_minutes: draft.est_minutes,
        description: draft.description || null, content: draft.content,
      }).select("id").single()) as { id: string };
      await q.reload();
      navigate(`/planner/${r.id}`);
    });
  }

  const canDelete = !!draft.id && (role === "director" || q.data.workouts.find((w) => w.id === draft.id)?.created_by === userId);

  return (
    <>
      <div className="spread">
        <h1>{t.planner}</h1>
        <div className="seg mobile-only" role="group">
          <button aria-pressed={pane === "list"} onClick={() => setPane("list")}>{t.workouts}</button>
          <button aria-pressed={pane === "editor"} disabled={!editing} onClick={() => setPane("editor")}>{t.edit}</button>
          <button aria-pressed={pane === "ai"} onClick={() => setPane("ai")}>AI</button>
        </div>
      </div>

      <div className="planner" data-pane={pane}>
        {/* Workouts list */}
        <div className="panel pane-list">
          <button className="btn" onClick={() => { setDraft(blank()); setDirty(false); navigate("/planner/new"); setPane("editor"); }}>+ {t.newWorkout}</button>
          <input type="search" placeholder={t.searchWorkouts} value={term} onChange={(e) => setTerm(e.target.value)} aria-label={t.searchWorkouts} />
          <div className="wlist">
            {list.length === 0 && <p className="empty">{t.noWorkouts}</p>}
            {list.map((w) => (
              <a key={w.id} href={`#/planner/${w.id}`} aria-current={w.id === id ? "true" : undefined} onClick={() => setPane("editor")}>
                <span className="exname">{w.title}</span>
                <small className="muted">{[w.focus && t.focusN[w.focus], `${countExercises(w.content)} ${t.exercises}`, w.est_minutes && `${w.est_minutes}′`].filter(Boolean).join(" · ")}</small>
              </a>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="panel pane-editor">
          {!editing ? <p className="empty">{t.noWorkouts}</p> : (
            <>
              <div className="spread" style={{ flexWrap: "wrap" }}>
                <input className="wtitle" value={draft.title} placeholder={t.untitled} onChange={(e) => update({ title: e.target.value })} aria-label={t.title} />
                <span className="row">
                  <span className={"muted" + (dirty ? " unsaved" : "")} style={{ fontSize: 12 }}>{dirty ? t.unsaved : draft.id ? t.savedJustNow : ""}</span>
                  <button className="btn" disabled={busy || (!dirty && !!draft.id)} onClick={save}>{t.saveWorkout}</button>
                  <button className="btn ghost" disabled={busy || countExercises(draft.content) === 0}
                    onClick={async () => { const sid = dirty || !draft.id ? await save() : draft.id; if (sid) setAssigning(true); }}>{t.assign}</button>
                </span>
              </div>
              <div className="form">
                <Field label={t.focus}>
                  <select value={draft.focus ?? ""} onChange={(e) => update({ focus: e.target.value || null })}>
                    <option value="">—</option>
                    {FOCI.map((f) => <option key={f} value={f}>{t.focusN[f]}</option>)}
                  </select>
                </Field>
                <Field label={t.estMinutes}>
                  <input type="number" min={5} max={300} value={draft.est_minutes ?? ""} onChange={(e) => update({ est_minutes: e.target.value ? Number(e.target.value) : null })} />
                </Field>
              </div>
              <Field label={t.description}><textarea value={draft.description} rows={2} onChange={(e) => update({ description: e.target.value })} /></Field>
              <WorkoutEditor value={draft.content} exercises={ex.list} onChange={(content) => update({ content })} />
              {draft.id && (
                <div className="row" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  <button className="btn sm ghost" onClick={duplicate}>{t.duplicate}</button>
                  {canDelete && <ConfirmButton label={t.delete} confirmLabel={t.confirmRemove} onConfirm={() => act(async () => {
                    must(await supabase.from("workouts").update({ archived_at: new Date().toISOString() }).eq("id", draft.id!));
                    setDraft(blank()); setDirty(false); await q.reload(); navigate("/planner");
                  }, t.workoutDeleted)} />}
                </div>
              )}
            </>
          )}
        </div>

        {/* AI assistant */}
        <div className="pane-ai">
          <AiPanel
            current={editing ? { title: draft.title, content: draft.content } : null}
            hasContent={editing && countExercises(draft.content) > 0}
            squads={q.data.club.squads}
            onResult={(r, mode) => {
              const next = { title: r.title, focus: r.focus, est_minutes: r.est_minutes, content: r.content };
              if (mode === "create") { setDraft({ ...blank(), ...next }); navigate("/planner/new"); }
              else setDraft((d) => ({ ...d, ...next }));
              setDirty(true);
              setPane("editor");
            }}
          />
        </div>
      </div>

      {assigning && draft.id && (
        <AssignDialog
          workout={{ id: draft.id, title: draft.title || t.untitled, focus: draft.focus, est_minutes: draft.est_minutes, content: draft.content }}
          club={q.data.club} onClose={() => setAssigning(false)} />
      )}
    </>
  );
}
