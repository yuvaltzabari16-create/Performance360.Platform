import { useMemo, useState } from "react";
import { InjuryDetail, InjuryForm, InjuryTiming, injuryTitle, SeverityPill } from "../../components/InjuryPanels";
import { Modal } from "../../components/Modal";
import { Avatar, ErrorBox, Loading, useAction } from "../../components/ui";
import { editablePlayerIds, loadClub } from "../../lib/data";
import { addDays, fmtDay, isoDate } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { daysOut, daysToReturn, loadInjuries, setStage, STAGES, stageTone } from "../../lib/injuries";
import { useSession } from "../../lib/session";
import type { Injury } from "../../lib/types";
import { useAsync } from "../../lib/useAsync";

/** Return-to-play board: one column per stage, cards move forward/back; plus KPIs and recent history. */
export function Injuries() {
  const { t, lang, dir } = useI18n();
  const { club, role, userId } = useSession();
  const act = useAction();
  const today = isoDate();
  const [squad, setSquad] = useState("all");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useAsync(async () => {
    const [c, injuries] = await Promise.all([loadClub(club!.id), loadInjuries(club!.id)]);
    return { ...c, injuries };
  }, [club?.id]);

  const view = useMemo(() => {
    if (!q.data) return null;
    const players = new Map(q.data.players.map((p) => [p.id, p]));
    const inSquad = (i: Injury) => squad === "all" || players.get(i.player_id)?.squad_id === squad;
    const list = q.data.injuries.filter((i) => players.has(i.player_id) && inSquad(i));
    const open = list.filter((i) => !i.closed_at);
    const cleared = list.filter((i) => i.closed_at && i.closed_at.slice(0, 10) >= addDays(today, -30));
    const history = list.filter((i) => i.closed_at).slice(0, 12);
    const unavailable = new Set(open.filter((i) => i.stage <= 3).map((i) => i.player_id)).size;
    const back7 = open.filter((i) => { const d = daysToReturn(i, today); return d != null && d <= 7; }).length;
    const avg = open.length ? Math.round(open.reduce((s, i) => s + daysOut(i, today), 0) / open.length) : null;
    return { players, open, cleared, history, unavailable, back7, avg };
  }, [q.data, squad, today]);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data || !view) return null;
  const editable = editablePlayerIds(q.data, role, userId);
  const editablePlayers = q.data.players.filter((p) => editable.has(p.id));
  const opened = openId ? q.data.injuries.find((i) => i.id === openId) ?? null : null;
  const fwd = dir === "rtl" ? "←" : "→", bwd = dir === "rtl" ? "→" : "←";

  const column = (stage: number) => (stage === 5 ? view.cleared : view.open.filter((i) => i.stage === stage))
    .sort((a, b) => (daysToReturn(a) ?? 999) - (daysToReturn(b) ?? 999));

  return (
    <>
      <div className="spread">
        <div><h1>{t.injuries}</h1><p className="sub">{t.rtpBoard}</p></div>
        <div className="row">
          {q.data.squads.length > 0 && (
            <select value={squad} onChange={(e) => setSquad(e.target.value)} style={{ width: "auto" }} aria-label={t.squad}>
              <option value="all">{t.allSquads}</option>
              {q.data.squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {editablePlayers.length > 0 && <button className="btn" onClick={() => setAdding(true)}>+ {t.logInjury}</button>}
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><span className="lbl">{t.openInjuries}</span><b>{view.open.length}</b></div>
        <div className="kpi"><span className="lbl">{t.unavailableK}</span><b>{view.unavailable}</b></div>
        <div className="kpi"><span className="lbl">{t.backThisWeek}</span><b>{view.back7}</b></div>
        <div className="kpi"><span className="lbl">{t.avgDaysOut}</span><b>{view.avg ?? t.none}</b></div>
      </div>

      <div className="rtpboard" role="list">
        {STAGES.map((s) => {
          const cards = column(s);
          return (
            <section key={s} className={"rtpcol tone-" + stageTone(s)} role="listitem" aria-label={t.rtpStages[s]}>
              <header>
                <span className="colnum">{s + 1}</span>
                <span><b>{t.rtpStages[s]}</b><br /><small className="muted">{s === 5 ? t.recentlyCleared : t.rtpStageHints[s]}</small></span>
                <span className="count">{cards.length}</span>
              </header>
              {cards.map((i) => {
                const p = view.players.get(i.player_id)!;
                const can = editable.has(i.player_id);
                return (
                  <article key={i.id} className="rtpcard">
                    <button className="rtpcard-main" onClick={() => setOpenId(i.id)}>
                      <span className="who"><Avatar name={p.full_name} /><span className="nm">{p.full_name}</span></span>
                      <span style={{ fontSize: 13 }}>{injuryTitle(i, t)}</span>
                      <span className="row" style={{ gap: 6 }}><SeverityPill severity={i.severity} /></span>
                      <InjuryTiming injury={i} />
                    </button>
                    {can && s < 5 && (
                      <div className="rtpcard-acts">
                        <button className="btn icon" disabled={s === 0} title={`${t.prevStage}: ${s > 0 ? t.rtpStages[s - 1] : ""}`} aria-label={t.prevStage}
                          onClick={() => act(async () => { await setStage(i, s - 1, ""); q.reload(); }, t.stageUpdated)}>{bwd}</button>
                        <button className="btn icon" title={`${t.nextStage}: ${t.rtpStages[s + 1]}`} aria-label={t.nextStage}
                          onClick={() => act(async () => { await setStage(i, s + 1, ""); q.reload(); }, t.stageUpdated)}>{fwd}</button>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
      {view.open.length === 0 && <p className="empty">{t.noInjuries}</p>}

      {view.history.length > 0 && (
        <section className="panel">
          <h2>{t.injuryHistory}</h2>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>{t.name}</th><th>{t.bodyArea}</th><th>{t.reportedOn}</th><th>{t.daysLost}</th><th className="hide-sm">{t.severity}</th></tr></thead>
              <tbody>
                {view.history.map((i) => (
                  <tr key={i.id} className="click" onClick={() => setOpenId(i.id)}>
                    <td>{view.players.get(i.player_id)?.full_name}</td>
                    <td>{injuryTitle(i, t)}</td>
                    <td className="muted">{fmtDay(i.reported_on, lang, { day: "numeric", month: "short" })}</td>
                    <td className="num">{daysOut(i)}</td>
                    <td className="hide-sm"><SeverityPill severity={i.severity} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {adding && (
        <Modal title={t.logInjury} onClose={() => setAdding(false)}>
          <InjuryForm players={editablePlayers} onDone={(s) => { setAdding(false); if (s) q.reload(); }} />
        </Modal>
      )}
      {opened && (
        <Modal title={view.players.get(opened.player_id)?.full_name ?? ""} onClose={() => setOpenId(null)}>
          <InjuryDetail injury={opened} playerName={view.players.get(opened.player_id)?.full_name ?? ""}
            canEdit={editable.has(opened.player_id)} profiles={q.data.profiles} onChanged={() => q.reload()} />
        </Modal>
      )}
    </>
  );
}
