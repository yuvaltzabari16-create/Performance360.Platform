import { useMemo, useState, type FormEvent } from "react";
import { ConfirmButton, ErrorBox, Field, Loading, useAction } from "../../components/ui";
import { editablePlayerIds, loadClub, loadRpe, loadSessions } from "../../lib/data";
import { addDays, fmtDay, isoDate, weekStart } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { CR10 } from "../../lib/load";
import { useSession } from "../../lib/session";
import { must, supabase } from "../../lib/supabase";
import type { SessionRpe, SessionType, TrainingSession } from "../../lib/types";
import { useAsync } from "../../lib/useAsync";
import { LoadTable } from "./Load";

const TYPES: SessionType[] = ["pitch", "match", "gym", "recovery"];

export function Training() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"sessions" | "load">("sessions");
  return (
    <>
      <div className="spread">
        <h1>{t.training}</h1>
        <div className="seg" role="group">
          <button aria-pressed={tab === "sessions"} onClick={() => setTab("sessions")}>{t.training}</button>
          <button aria-pressed={tab === "load"} onClick={() => setTab("load")}>{t.load}</button>
        </div>
      </div>
      {tab === "sessions" ? <Sessions /> : <LoadTable />}
    </>
  );
}

function Sessions() {
  const { t, lang } = useI18n();
  const { club, role, userId } = useSession();
  const act = useAction();
  const today = isoDate();
  const [week, setWeek] = useState(weekStart(today));
  const [squad, setSquad] = useState("all");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const end = addDays(week, 6);

  const q = useAsync(async () => {
    const [c, sessions, rpe] = await Promise.all([loadClub(club!.id), loadSessions(club!.id, week, end), loadRpe(club!.id, week, end)]);
    return { ...c, sessions, rpe };
  }, [club?.id, week]);

  const manageable = useMemo(() => {
    if (!q.data) return [];
    if (role === "director") return q.data.squads;
    const mine = new Set(q.data.squadStaff.filter((s) => s.user_id === userId).map((s) => s.squad_id));
    return q.data.squads.filter((s) => mine.has(s.id));
  }, [q.data, role, userId]);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data) return null;
  const d = q.data;
  const squadName = (id: string | null) => (id ? d.squads.find((s) => s.id === id)?.name ?? "" : t.wholeClub);
  const visible = d.sessions.filter((s) => squad === "all" || s.squad_id === squad || s.squad_id === null);
  const canManage = (s: TrainingSession) => role === "director" || (!!s.squad_id && manageable.some((m) => m.id === s.squad_id));
  const expected = (s: TrainingSession) => d.players.filter((p) => !s.squad_id || p.squad_id === s.squad_id).length;

  return (
    <>
      <div className="row">
        <button className="btn sm ghost" onClick={() => setWeek(addDays(week, -7))}>{lang === "he" ? "→" : "←"} {t.prevWeek}</button>
        <button className="btn sm ghost" onClick={() => setWeek(weekStart(today))}>{t.thisWeek}</button>
        <button className="btn sm ghost" onClick={() => setWeek(addDays(week, 7))}>{t.nextWeek} {lang === "he" ? "←" : "→"}</button>
        <span className="muted">{fmtDay(week, lang)} – {fmtDay(end, lang)}</span>
        <span style={{ flex: 1 }} />
        {d.squads.length > 0 && (
          <select value={squad} onChange={(e) => setSquad(e.target.value)} style={{ width: "auto" }} aria-label={t.squad}>
            <option value="all">{t.allSquads}</option>
            {d.squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {(manageable.length > 0 || role === "director") && !adding && <button className="btn" onClick={() => setAdding(true)}>+ {t.addSession}</button>}
      </div>

      {adding && (
        <NewSession
          squads={manageable}
          allowClubWide={role === "director"}
          defaultDate={today >= week && today <= end ? today : week}
          defaultSquad={squad !== "all" && manageable.some((m) => m.id === squad) ? squad : manageable[0]?.id ?? ""}
          onCancel={() => setAdding(false)}
          onSave={async (v) => {
            const ok = await act(async () => { must(await supabase.from("training_sessions").insert({ ...v, club_id: club!.id })); }, t.sessionAdded);
            if (ok) { setAdding(false); if (v.session_date < week || v.session_date > end) setWeek(weekStart(v.session_date)); else q.reload(); }
          }}
        />
      )}

      <section className="panel">
        {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((day) => {
          const list = visible.filter((s) => s.session_date === day);
          return (
            <div key={day} className="day-row" style={{ borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
              <div className="spread">
                <b style={{ fontFamily: "var(--display)", fontSize: 17, color: day === today ? "var(--accent)" : undefined }}>
                  {fmtDay(day, lang, { weekday: "short", day: "numeric", month: "short" })}
                </b>
                {list.length === 0 && <span className="muted" style={{ fontSize: 12 }}>{t.noSessions}</span>}
              </div>
              {list.map((s) => {
                const replies = d.rpe.filter((r) => r.session_id === s.id);
                const avg = replies.length ? replies.reduce((a, r) => a + r.rpe, 0) / replies.length : null;
                const isOpen = open === s.id;
                return (
                  <div key={s.id} className="note" style={{ marginTop: 8 }}>
                    <button className="spread" style={{ all: "unset", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}
                      onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
                      <span className="row">
                        <span className={"tag" + (s.type === "match" ? " match" : "")}>{t.sessionType[s.type]}</span>
                        <b>{s.title || t.sessionType[s.type]}</b>
                        <span className="muted">{squadName(s.squad_id)} · {s.duration_min}′</span>
                      </span>
                      <span className="row muted" style={{ fontSize: 12 }}>
                        <span>{t.responses} {replies.length}/{expected(s)}</span>
                        {avg != null && <span>{t.avgRpe} {avg.toFixed(1)}</span>}
                      </span>
                    </button>
                    {isOpen && (
                      <RpeEditor session={s} players={d.players.filter((p) => !s.squad_id || p.squad_id === s.squad_id)}
                        rpe={replies} editable={editablePlayerIds(d, role, userId)} onSaved={q.reload}
                        onDelete={canManage(s) ? async () => {
                          const ok = await act(async () => { must(await supabase.from("training_sessions").delete().eq("id", s.id)); }, t.sessionDeleted);
                          if (ok) q.reload();
                        } : undefined} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>
    </>
  );
}

function NewSession({ squads, allowClubWide, defaultDate, defaultSquad, onSave, onCancel }: {
  squads: { id: string; name: string }[]; allowClubWide: boolean; defaultDate: string; defaultSquad: string;
  onSave: (v: { session_date: string; squad_id: string | null; type: SessionType; duration_min: number; title: string | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState(defaultDate);
  const [sq, setSq] = useState(defaultSquad);
  const [type, setType] = useState<SessionType>("pitch");
  const [dur, setDur] = useState("90");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSave({ session_date: date, squad_id: sq || null, type, duration_min: Number(dur), title: title.trim() || null });
    setBusy(false);
  }
  return (
    <form className="panel" onSubmit={submit}>
      <h2>{t.addSession}</h2>
      <div className="form">
        <Field label={t.date}><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={t.squad}>
          <select value={sq} onChange={(e) => setSq(e.target.value)} required={!allowClubWide}>
            {allowClubWide && <option value="">{t.wholeClub}</option>}
            {squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label={t.type}>
          <select value={type} onChange={(e) => setType(e.target.value as SessionType)}>
            {TYPES.map((x) => <option key={x} value={x}>{t.sessionType[x]}</option>)}
          </select>
        </Field>
        <Field label={t.minutes}><input type="number" required min={5} max={300} value={dur} onChange={(e) => setDur(e.target.value)} /></Field>
        <Field label={t.title}><input type="text" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      </div>
      <div className="row">
        <button className="btn" disabled={busy || !date || !dur}>{t.save}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>{t.cancel}</button>
      </div>
    </form>
  );
}

/** Staff can see every reply and enter RPE on behalf of players they manage. */
function RpeEditor({ session, players, rpe, editable, onSaved, onDelete }: {
  session: TrainingSession; players: { id: string; full_name: string }[]; rpe: SessionRpe[];
  editable: Set<string>; onSaved: () => void; onDelete?: () => void;
}) {
  const { t, lang } = useI18n();
  const act = useAction();
  const [draft, setDraft] = useState<Record<string, { rpe: string; minutes: string }>>({});
  const [busy, setBusy] = useState(false);
  const byPlayer = new Map(rpe.map((r) => [r.player_id, r]));
  const changed = Object.entries(draft).filter(([, v]) => v.rpe !== "");

  async function saveAll() {
    setBusy(true);
    const rows = changed.map(([player_id, v]) => ({
      session_id: session.id, player_id, rpe: Number(v.rpe), minutes: Number(v.minutes || session.duration_min),
    }));
    const ok = await act(async () => {
      must(await supabase.from("session_rpe").upsert(rows, { onConflict: "session_id,player_id" }));
    }, t.rpeSaved);
    setBusy(false);
    if (ok) { setDraft({}); onSaved(); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>{t.name}</th><th>{t.rpe}</th><th>{t.minutes}</th><th>{t.load}</th></tr></thead>
          <tbody>
            {players.map((p) => {
              const r = byPlayer.get(p.id);
              const dv = draft[p.id];
              const can = editable.has(p.id);
              return (
                <tr key={p.id}>
                  <td>{p.full_name}</td>
                  <td>{can ? (
                    <select value={dv?.rpe ?? r?.rpe?.toString() ?? ""} style={{ width: "auto" }} aria-label={`${t.rpe} ${p.full_name}`}
                      onChange={(e) => setDraft({ ...draft, [p.id]: { rpe: e.target.value, minutes: dv?.minutes ?? r?.minutes?.toString() ?? "" } })}>
                      <option value="">{t.notRated}</option>
                      {CR10[lang].map((lbl, i) => <option key={i} value={i}>{i} · {lbl}</option>)}
                    </select>
                  ) : r ? r.rpe : <span className="muted">{t.notRated}</span>}</td>
                  <td>{can ? (
                    <input type="number" min={0} max={300} style={{ width: 80 }} placeholder={String(session.duration_min)}
                      value={dv?.minutes ?? r?.minutes?.toString() ?? ""} aria-label={`${t.minutes} ${p.full_name}`}
                      onChange={(e) => setDraft({ ...draft, [p.id]: { rpe: dv?.rpe ?? r?.rpe?.toString() ?? "", minutes: e.target.value } })} />
                  ) : r?.minutes ?? ""}</td>
                  <td className="num">{r?.load ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="spread">
        <button className="btn sm" disabled={busy || changed.length === 0} onClick={saveAll}>{t.save} ({changed.length})</button>
        {onDelete && <ConfirmButton label={t.delete} confirmLabel={t.confirmRemove} onConfirm={onDelete} />}
      </div>
    </div>
  );
}
