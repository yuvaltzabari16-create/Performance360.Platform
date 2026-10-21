import { useState } from "react";
import { ErrorBox, useAction } from "../../components/ui";
import { addDays, fmtDay, isoDate } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { CR10 } from "../../lib/load";
import { useSession } from "../../lib/session";
import { must, supabase } from "../../lib/supabase";
import type { SessionRpe, TrainingSession } from "../../lib/types";
import { useAsync } from "../../lib/useAsync";

/** Sessions from the last 3 days for the athlete's squad, each rated with CR10 RPE + minutes. */
export function RateSessions() {
  const { t, lang } = useI18n();
  const { myPlayer } = useSession();
  const today = isoDate();
  const q = useAsync(async () => {
    if (!myPlayer) return { sessions: [], mine: [] };
    const sessions = (must(await supabase.from("training_sessions").select("*").eq("club_id", myPlayer.club_id)
      .gte("session_date", addDays(today, -3)).lte("session_date", today).order("session_date", { ascending: false })) as TrainingSession[])
      .filter((s) => !s.squad_id || s.squad_id === myPlayer.squad_id);
    const mine = sessions.length
      ? (must(await supabase.from("session_rpe").select("*").eq("player_id", myPlayer.id).in("session_id", sessions.map((s) => s.id))) as SessionRpe[])
      : [];
    return { sessions, mine };
  }, [myPlayer?.id, today]);

  if (!myPlayer) return null;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data) return null;

  return (
    <section className="panel">
      <div>
        <h2>{t.rateSessions}</h2>
        <p className="sub" style={{ margin: 0 }}>{t.rateIntro}</p>
      </div>
      {q.data.sessions.length === 0 ? <p className="empty">{t.noSessionsToRate}</p> : q.data.sessions.map((s) => (
        <SessionCard key={s.id} s={s} mine={q.data!.mine.find((r) => r.session_id === s.id)} playerId={myPlayer.id} lang={lang} onSaved={q.reload} />
      ))}
    </section>
  );
}

export function SessionCard({ s, mine, playerId, lang, onSaved, hideOpen = false }: {
  s: TrainingSession; mine?: SessionRpe; playerId: string; lang: "he" | "en"; onSaved: () => void; hideOpen?: boolean;
}) {
  const { t } = useI18n();
  const act = useAction();
  const [rpe, setRpe] = useState<number | null>(mine?.rpe ?? null);
  const [minutes, setMinutes] = useState(String(mine?.minutes ?? s.duration_min));
  const [editing, setEditing] = useState(!mine);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (rpe == null) return;
    setBusy(true);
    const ok = await act(async () => {
      must(await supabase.from("session_rpe").upsert({ session_id: s.id, player_id: playerId, rpe, minutes: Number(minutes || 0) }, { onConflict: "session_id,player_id" }));
    }, t.rpeSaved);
    setBusy(false);
    if (ok) { setEditing(false); onSaved(); }
  }

  return (
    <div className="note">
      <div className="spread">
        <span className="row">
          <span className={"tag" + (s.type === "match" ? " match" : "")}>{t.sessionType[s.type]}</span>
          <b>{s.title || t.sessionType[s.type]}</b>
          <span className="muted">{fmtDay(s.session_date, lang, { weekday: "short", day: "numeric", month: "short" })} · {s.duration_min}′</span>
        </span>
        {s.workout_snapshot && !hideOpen && <a className="btn sm" href={`#/workout/${s.id}`}>{t.openWorkout}</a>}
        {mine && !editing && (
          <span className="row">
            <span className="pill good">{t.rated} · {mine.rpe}</span>
            <button className="btn sm ghost" onClick={() => setEditing(true)}>{t.edit}</button>
          </span>
        )}
      </div>
      {editing && (
        <>
          <div className="rpe" role="group" aria-label={t.rpe}>
            {CR10[lang].map((lbl, i) => (
              <button key={i} type="button" aria-pressed={rpe === i} title={lbl} onClick={() => setRpe(i)}>{i}</button>
            ))}
          </div>
          {rpe != null && <span className="muted" style={{ fontSize: 12 }}>{rpe} · {CR10[lang][rpe]}</span>}
          <div className="row">
            <label className="field" style={{ width: 160 }}><span>{t.minutesPlayed}</span>
              <input type="number" min={0} max={300} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
            <button className="btn" style={{ alignSelf: "flex-end" }} disabled={rpe == null || busy} onClick={save}>{t.rate}</button>
          </div>
        </>
      )}
    </div>
  );
}
