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
  const [mode, setMode] = useState<"week" | "month">("week");
  const end = addDays(week, 6);

  const q = useAsync(async () => {
    const [c, sessions, rpe] = await Promise.all([loadClub(club!.id), loadSessions(club!.id, week, end), loadRpe(club!.id, week, end)]);
    const withWorkout = sessions.filter((s) => s.workout_snapshot).map((s) => s.id);
    const logs = withWorkout.length
      ? must(await supabase.from("workout_logs").select("session_id, completed_at").in("session_id", withWorkout)) as { session_id: string; completed_at: string | null }[]
      : [];
    return { ...c, sessions, rpe, logs };
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
  const squadName = (id: string | null, playerId?: string | null) =>
    playerId ? d.players.find((p) => p.id === playerId)?.full_name ?? "" : id ? d.squads.find((s) => s.id === id)?.name ?? "" : t.wholeClub;
  const squadOf = (s: TrainingSession) => (s.player_id ? d.players.find((p) => p.id === s.player_id)?.squad_id ?? null : s.squad_id);
  const visible = d.sessions.filter((s) => squad === "all" || squadOf(s) === squad || (s.squad_id === null && !s.player_id));
  const canManage = (s: TrainingSession) => role === "director" || (!!s.squad_id && manageable.some((m) => m.id === s.squad_id));
  const expected = (s: TrainingSession) => s.player_id ? 1 : d.players.filter((p) => !s.squad_id || p.squad_id === s.squad_id).length;
  const sessionPlayers = (s: TrainingSession) => d.players.filter((p) => (s.player_id ? p.id === s.player_id : !s.squad_id || p.squad_id === s.squad_id));

  return (
    <>
      <div className="row">
        <div className="seg" role="group" aria-label={t.week + " / " + t.month}>
          <button aria-pressed={mode === "week"} onClick={() => setMode("week")}>{t.week}</button>
          <button aria-pressed={mode === "month"} onClick={() => setMode("month")}>{t.month}</button>
        </div>
        {mode === "week" && <>
          <button className="btn sm ghost" onClick={() => setWeek(addDays(week, -7))}>{lang === "he" ? "→" : "←"} {t.prevWeek}</button>
          <button className="btn sm ghost" onClick={() => setWeek(weekStart(today))}>{t.thisWeek}</button>
          <button className="btn sm ghost" onClick={() => setWeek(addDays(week, 7))}>{t.nextWeek} {lang === "he" ? "←" : "→"}</button>
          <span className="muted">{fmtDay(week, lang)} – {fmtDay(end, lang)}</span>
        </>}
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

      {mode === "month" ? (
        <MonthView anchor={week} squad={squad} players={d.players} onPickDay={(day) => { setWeek(weekStart(day)); setMode("week"); }} />
      ) : <section className="panel">
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
                        <span className="muted">{squadName(s.squad_id, s.player_id)} · {s.duration_min}′</span>
                        {s.workout_snapshot && <span className="tag">▤ {s.workout_snapshot.title}</span>}
                      </span>
                      <span className="row muted" style={{ fontSize: 12 }}>
                        <span>{t.responses} {replies.length}/{expected(s)}</span>
                        {s.workout_snapshot && <span>✓ {d.logs.filter((l) => l.session_id === s.id && l.completed_at).length}/{expected(s)} {t.completedBy}</span>}
                        {avg != null && <span>{t.avgRpe} {avg.toFixed(1)}</span>}
                      </span>
                    </button>
                    {isOpen && (
                      <RpeEditor session={s} players={sessionPlayers(s)}
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
      </section>}
    </>
  );
}

/** Month grid (Sunday-first). Each day lists its sessions as coloured chips; tap a day to open that week. */
function MonthView({ anchor, squad, players, onPickDay }: {
  anchor: string; squad: string; players: { id: string; squad_id: string | null }[]; onPickDay: (day: string) => void;
}) {
  const { t, lang } = useI18n();
  const { club } = useSession();
  const today = isoDate();
  const [month, setMonth] = useState(anchor.slice(0, 7) + "-01");
  const [y, m] = month.split("-").map(Number);
  const first = month;
  const last = isoDate(new Date(y, m, 0));
  const gridStart = weekStart(first);
  const weeks = Math.ceil((Number(last.slice(8)) + new Date(y, m - 1, 1).getDay()) / 7);
  const q = useAsync(() => loadSessions(club!.id, gridStart, addDays(gridStart, weeks * 7 - 1)), [club?.id, month]);
  const shift = (n: number) => setMonth(isoDate(new Date(y, m - 1 + n, 1)));
  const squadOf = (s: TrainingSession) => (s.player_id ? players.find((p) => p.id === s.player_id)?.squad_id ?? null : s.squad_id);
  const list = (q.data ?? []).filter((s) => squad === "all" || squadOf(s) === squad || (s.squad_id === null && !s.player_id));
  const weekdays = Array.from({ length: 7 }, (_, i) => fmtDay(addDays(gridStart, i), lang, { weekday: "short" }));

  return (
    <section className="panel">
      <div className="spread">
        <button className="btn sm ghost" onClick={() => shift(-1)} aria-label={t.prevWeek}>{lang === "he" ? "→" : "←"}</button>
        <h2>{new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1))}</h2>
        <button className="btn sm ghost" onClick={() => shift(1)} aria-label={t.nextWeek}>{lang === "he" ? "←" : "→"}</button>
      </div>
      {q.error && <ErrorBox message={q.error} onRetry={q.reload} />}
      <div className="month" role="grid">
        {weekdays.map((w) => <div key={w} className="mhead" role="columnheader">{w}</div>)}
        {Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i)).map((day) => {
          const items = list.filter((s) => s.session_date === day);
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          return (
            <button key={day} role="gridcell" className={"mday" + (inMonth ? "" : " out") + (day === today ? " today" : "")} onClick={() => onPickDay(day)}
              aria-label={`${fmtDay(day, lang, { weekday: "long", day: "numeric", month: "long" })}: ${items.length} ${t.sessionsCount}`}>
              <span className="mnum">{Number(day.slice(8))}</span>
              {items.slice(0, 3).map((s) => (
                <span key={s.id} className={"mchip " + s.type}>{s.workout_snapshot?.title ?? s.title ?? t.sessionType[s.type]}</span>
              ))}
              {items.length > 3 && <span className="mmore">+{items.length - 3}</span>}
            </button>
          );
        })}
      </div>
      <div className="row muted" style={{ fontSize: 12, gap: 12 }}>
        {(["pitch", "match", "gym", "recovery"] as const).map((k) => <span key={k} className="row" style={{ gap: 4 }}><span className={"mchip-dot " + k} />{t.sessionType[k]}</span>)}
      </div>
    </section>
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
