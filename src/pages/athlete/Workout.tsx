import { useEffect, useRef, useState } from "react";
import { ExerciseVideo } from "../../components/ExerciseMedia";
import { ErrorBox, Loading, useAction } from "../../components/ui";
import { fmtDay } from "../../lib/dates";
import { useExercises } from "../../lib/exercises";
import { useI18n } from "../../lib/i18n";
import { useSession } from "../../lib/session";
import { must, supabase } from "../../lib/supabase";
import type { SessionRpe, TrainingSession } from "../../lib/types";
import { useAsync } from "../../lib/useAsync";
import { codes, type WorkoutItem } from "../../lib/workout";
import { SessionCard } from "./RateSessions";

type SetLog = { done?: boolean; reps?: string; load?: string };
type Log = Record<string, SetLog[]>;

/** Athlete runs an assigned workout: video per exercise, tick sets, log reps/load, finish → RPE. */
export function AthleteWorkout({ sessionId }: { sessionId: string }) {
  const { t, lang } = useI18n();
  const { myPlayer } = useSession();
  const act = useAction();
  const ex = useExercises();
  const [log, setLog] = useState<Log>({});
  const [notes, setNotes] = useState("");
  const [completed, setCompleted] = useState<string | null>(null);
  const [openVideo, setOpenVideo] = useState<string | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  const q = useAsync(async () => {
    const s = must(await supabase.from("training_sessions").select("*").eq("id", sessionId).maybeSingle()) as TrainingSession | null;
    const l = myPlayer ? must(await supabase.from("workout_logs").select("*").eq("session_id", sessionId).eq("player_id", myPlayer.id).maybeSingle()) as { log: Log; notes: string | null; completed_at: string | null } | null : null;
    const rpe = myPlayer ? must(await supabase.from("session_rpe").select("*").eq("session_id", sessionId).eq("player_id", myPlayer.id).maybeSingle()) as SessionRpe | null : null;
    return { s, l, rpe };
  }, [sessionId, myPlayer?.id]);

  useEffect(() => {
    if (q.data?.l) { setLog(q.data.l.log ?? {}); setNotes(q.data.l.notes ?? ""); setCompleted(q.data.l.completed_at); }
  }, [q.data]);

  if (!myPlayer) return <p className="empty">{t.notLinkedAthlete}</p>;
  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  const s = q.data?.s;
  if (!s?.workout_snapshot) return <><a className="back" href="#/today">← {t.back}</a><p className="empty">{t.noSessions}</p></>;
  const w = s.workout_snapshot;
  const code = codes(w.content);

  const persist = (next: Log, extra: { notes?: string; completed_at?: string | null } = {}) =>
    supabase.from("workout_logs").upsert(
      { session_id: s.id, player_id: myPlayer.id, log: next, notes: (extra.notes ?? notes) || null, completed_at: extra.completed_at ?? completed },
      { onConflict: "session_id,player_id" }).then(({ error }) => { if (error) throw new Error(error.message); });

  // Debounced autosave so ticking sets never loses progress.
  const change = (next: Log) => {
    setLog(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { persist(next).catch(() => {}); }, 600);
  };
  const setSet = (it: WorkoutItem, i: number, patch: SetLog) => {
    const arr = [...(log[it.id] ?? it.sets.map(() => ({})))];
    arr[i] = { ...arr[i], ...patch };
    change({ ...log, [it.id]: arr });
  };
  const total = w.content.sections.reduce((n, sec) => n + sec.blocks.reduce((m, b) => m + b.items.reduce((k, it) => k + it.sets.length, 0), 0), 0);
  const doneCount = Object.values(log).reduce((n, arr) => n + arr.filter((x) => x?.done).length, 0);

  return (
    <>
      <a className="back" href="#/today">{lang === "he" ? "→" : "←"} {t.back}</a>
      <div className="spread">
        <div>
          <span className="lbl">{t.yourWorkout} · {fmtDay(s.session_date, lang, { weekday: "long", day: "numeric", month: "short" })}</span>
          <h1>{w.title}</h1>
        </div>
        <span className="pill na" dir="ltr">{doneCount}/{total}</span>
      </div>
      <div className="progress"><span style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} /></div>

      {w.content.sections.map((sec) => (
        <section key={sec.id} className="panel">
          {sec.title && <h2>{sec.title}</h2>}
          {sec.blocks.map((b) => (
            <div key={b.id} className={"wblock " + b.kind}>
              {b.kind !== "single" && <span className="lbl">{t[b.kind]}{b.rounds ? ` · ${b.rounds} ${t.rounds}` : ""}</span>}
              {b.items.map((it) => {
                const e = it.exercise_id ? ex.byId.get(it.exercise_id) : undefined;
                const name = (e && ((lang === "he" && e.name_he) || e.name_en)) || it.name;
                const showVideo = openVideo === it.id;
                return (
                  <div key={it.id} className="witem">
                    <div className="witem-head">
                      <span className="code">{code.get(it.id)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <button className="exn" onClick={() => setOpenVideo(showVideo ? null : it.id)} aria-expanded={showVideo}>{name}</button>
                        {it.note && <div className="muted" style={{ fontSize: 13 }}>{it.note}</div>}
                        {e && !showVideo && (e.video_id || e.video_url) && <div className="muted" style={{ fontSize: 11 }}>▶ {t.tapVideo}</div>}
                      </div>
                    </div>
                    {showVideo && e && <ExerciseVideo ex={e} autoplay />}
                    <div className="tbl-wrap">
                      <table className="sets">
                        <thead><tr><th>{t.set}</th>{it.fields.map((f) => <th key={f}>{t.fields[f]}</th>)}<th>{t.fields.reps}</th><th>{t.fields.load}</th><th>{t.actual}</th></tr></thead>
                        <tbody>
                          {it.sets.map((row, i) => {
                            const lg = (log[it.id] ?? [])[i] ?? {};
                            return (
                              <tr key={i} className={lg.done ? "done" : ""}>
                                <td className="num muted">{i + 1}</td>
                                {it.fields.map((f) => <td key={f} className="num">{row[f] ?? ""}</td>)}
                                <td><input className="cell" inputMode="numeric" value={lg.reps ?? ""} placeholder={row.reps ?? ""} onChange={(ev) => setSet(it, i, { reps: ev.target.value })} aria-label={`${t.fields.reps} ${i + 1}`} /></td>
                                <td><input className="cell" inputMode="decimal" value={lg.load ?? ""} placeholder={row.load ?? ""} onChange={(ev) => setSet(it, i, { load: ev.target.value })} aria-label={`${t.fields.load} ${i + 1}`} /></td>
                                <td><input type="checkbox" className="tick" checked={!!lg.done} onChange={(ev) => setSet(it, i, { done: ev.target.checked })} aria-label={`${t.done} ${i + 1}`} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      ))}

      <section className="panel">
        <label className="field"><span>{t.notesCoach}</span>
          <textarea value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} /></label>
        {completed ? (
          <>
            <p className="info" style={{ margin: 0 }}>{t.workoutDone}</p>
            <h3>{t.howHard}</h3>
            <SessionCard s={s} mine={q.data?.rpe ?? undefined} playerId={myPlayer.id} lang={lang} onSaved={q.reload} hideOpen />
          </>
        ) : (
          <button className="btn" onClick={() => act(async () => {
            const at = new Date().toISOString();
            window.clearTimeout(saveTimer.current);
            await persist(log, { notes, completed_at: at });
            setCompleted(at);
          }, t.workoutDone)}>{t.finishWorkout}</button>
        )}
      </section>
    </>
  );
}
