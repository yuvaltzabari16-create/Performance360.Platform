import { useEffect, useState, type FormEvent } from "react";
import { ErrorBox, Loading, ReadyPill, useAction } from "../../components/ui";
import { fmtDay, isoDate, readinessTone } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { useSession } from "../../lib/session";
import { must, supabase } from "../../lib/supabase";
import { WELLNESS_KEYS, type Checkin, type WellnessKey } from "../../lib/types";
import { useAsync } from "../../lib/useAsync";

type Form = Record<WellnessKey, number | null> & { sleep_hours: string; pain: boolean; pain_area: string; notes: string };
const blank: Form = { sleep: null, energy: null, freshness: null, calm: null, mood: null, sleep_hours: "", pain: false, pain_area: "", notes: "" };

export function Today() {
  const { t, lang } = useI18n();
  const { myPlayer } = useSession();
  const act = useAction();
  const today = isoDate();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<Form>(blank);
  const [busy, setBusy] = useState(false);

  const q = useAsync(async () => {
    if (!myPlayer) return null;
    return must(await supabase.from("wellness_checkins").select("*").eq("player_id", myPlayer.id).eq("entry_date", today).maybeSingle()) as Checkin | null;
  }, [myPlayer?.id, today]);

  useEffect(() => {
    const c = q.data;
    if (c) setF({ sleep: c.sleep, energy: c.energy, freshness: c.freshness, calm: c.calm, mood: c.mood,
      sleep_hours: c.sleep_hours?.toString() ?? "", pain: c.pain, pain_area: c.pain_area ?? "", notes: c.notes ?? "" });
  }, [q.data]);

  if (!myPlayer) return <><h1>{t.today}</h1><div className="panel"><p className="empty">{t.notLinkedAthlete}</p></div></>;
  if (q.loading && q.data === null && !q.error) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;

  const done = !!q.data && !editing;
  const complete = WELLNESS_KEYS.every((k) => f[k] != null);
  const preview = complete ? Math.round(((WELLNESS_KEYS.reduce((s, k) => s + (f[k] as number), 0) / 5 - 1) / 4) * 100) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!complete) return;
    setBusy(true);
    const row = {
      player_id: myPlayer!.id, entry_date: today,
      sleep: f.sleep, energy: f.energy, freshness: f.freshness, calm: f.calm, mood: f.mood,
      sleep_hours: f.sleep_hours === "" ? null : Number(f.sleep_hours),
      pain: f.pain, pain_area: f.pain ? f.pain_area.trim() || null : null, notes: f.notes.trim() || null,
    };
    const ok = await act(async () => {
      must(await supabase.from("wellness_checkins").upsert(row, { onConflict: "player_id,entry_date" }));
    }, t.checkinSaved);
    setBusy(false);
    if (ok) { setEditing(false); q.reload(); }
  }

  return (
    <>
      <div>
        <h1>{t.today}</h1>
        <p className="sub">{myPlayer.full_name} ·{fmtDay(today, lang, { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      {done ? (
        <section className="panel" style={{ alignItems: "flex-start" }}>
          <span className="lbl">{t.doneToday}</span>
          <div className="row" style={{ alignItems: "baseline", gap: 14 }}>
            <span className="big" style={{ color: `var(--${readinessTone(q.data!.readiness)})` }}>{q.data!.readiness}</span>
            <span className="muted">{t.yourReadiness}</span>
          </div>
          <div className="row">
            {WELLNESS_KEYS.map((k) => <span key={k} className="tag">{t[k]} {q.data![k]}/5</span>)}
            {q.data!.pain && <span className="pill bad">{t.pain}{q.data!.pain_area ? `: ${q.data!.pain_area}` : ""}</span>}
          </div>
          <button className="btn ghost sm" onClick={() => setEditing(true)}>{t.editCheckin}</button>
        </section>
      ) : (
        <form className="panel" onSubmit={submit}>
          <div className="spread">
            <div><h2>{t.checkinT}</h2><p className="sub" style={{ margin: 0 }}>{t.checkinSub}</p></div>
            {preview != null && <ReadyPill value={preview} />}
          </div>
          {WELLNESS_KEYS.map((k) => (
            <div key={k} className="scale" role="group" aria-label={t[k]}>
              <span style={{ fontWeight: 600 }}>{t[k]}</span>
              <div className="dots">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button type="button" key={v} aria-pressed={f[k] === v} onClick={() => setF({ ...f, [k]: v })}>{v}</button>
                ))}
              </div>
              <div className="ends"><span>{t.poor}</span><span>{t.great}</span></div>
            </div>
          ))}
          <div className="form">
            <label className="field"><span>{t.sleepHours}</span>
              <input type="number" inputMode="decimal" min={0} max={16} step="0.5" value={f.sleep_hours} onChange={(e) => setF({ ...f, sleep_hours: e.target.value })} />
            </label>
            <div className="field"><span>{t.anyPain}</span>
              <div className="seg" role="group">
                <button type="button" aria-pressed={!f.pain} onClick={() => setF({ ...f, pain: false })}>{t.no}</button>
                <button type="button" aria-pressed={f.pain} onClick={() => setF({ ...f, pain: true })}>{t.yes}</button>
              </div>
            </div>
            {f.pain && <label className="field"><span>{t.painArea}</span>
              <input type="text" maxLength={80} value={f.pain_area} onChange={(e) => setF({ ...f, pain_area: e.target.value })} /></label>}
          </div>
          <label className="field"><span>{t.notesCoach}</span>
            <textarea maxLength={1000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
          <div className="row">
            <button className="btn" disabled={!complete || busy}>{q.data ? t.update : t.submit}</button>
            {editing && <button type="button" className="btn ghost" onClick={() => setEditing(false)}>{t.cancel}</button>}
          </div>
        </form>
      )}
    </>
  );
}
