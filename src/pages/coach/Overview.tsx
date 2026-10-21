import { useMemo, useState } from "react";
import { Avatar, ErrorBox, Loading, ReadyPill, StatusPill } from "../../components/ui";
import { loadCheckins, loadClub } from "../../lib/data";
import { fmtDay, isoDate } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { navigate } from "../../lib/router";
import { useSession } from "../../lib/session";
import { useAsync } from "../../lib/useAsync";

export function Overview() {
  const { t, lang } = useI18n();
  const { club } = useSession();
  const today = isoDate();
  const [squad, setSquad] = useState<string>("all");

  const q = useAsync(async () => {
    const c = await loadClub(club!.id);
    const checkins = await loadCheckins(club!.id, today, today);
    return { ...c, checkins };
  }, [club?.id, today]);

  const view = useMemo(() => {
    if (!q.data) return null;
    const players = q.data.players.filter((p) => squad === "all" || p.squad_id === squad);
    const byPlayer = new Map(q.data.checkins.map((c) => [c.player_id, c]));
    const rows = players.map((p) => ({ p, c: byPlayer.get(p.id) ?? null }));
    const checked = rows.filter((r) => r.c);
    const avg = checked.length ? Math.round(checked.reduce((s, r) => s + r.c!.readiness, 0) / checked.length) : null;
    const flags = rows
      .map((r) => {
        const reasons: string[] = [];
        if (r.p.status !== "available") reasons.push(t.status[r.p.status]);
        if (r.c && r.c.readiness < 50) reasons.push(t.lowReady);
        if (r.c?.pain) reasons.push(t.pain + (r.c.pain_area ? `: ${r.c.pain_area}` : ""));
        return { ...r, reasons };
      })
      .filter((r) => r.reasons.length);
    // Sort: no check-in last, lowest readiness first.
    rows.sort((a, b) => (a.c ? a.c.readiness : 999) - (b.c ? b.c.readiness : 999));
    return {
      rows, flags, avg,
      total: players.length,
      available: players.filter((p) => p.status === "available").length,
      checked: checked.length,
    };
  }, [q.data, squad, t]);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data || !view) return null;
  const squadName = (id: string | null) => q.data!.squads.find((s) => s.id === id)?.name ?? t.noSquad;

  return (
    <>
      <div className="spread">
        <div>
          <h1>{t.overview}</h1>
          <p className="sub">{fmtDay(today, lang, { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        {q.data.squads.length > 0 && (
          <select value={squad} onChange={(e) => setSquad(e.target.value)} style={{ width: "auto" }} aria-label={t.squad}>
            <option value="all">{t.allSquads}</option>
            {q.data.squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      <div className="kpis">
        <div className="kpi"><span className="lbl">{t.playersK}</span><b>{view.total}</b></div>
        <div className="kpi"><span className="lbl">{t.availableK}</span><b>{view.available}</b><small>/ {view.total}</small></div>
        <div className="kpi"><span className="lbl">{t.checkedInK}</span><b>{view.checked}</b><small>/ {view.total}</small></div>
        <div className="kpi"><span className="lbl">{t.avgReadyK}</span><b>{view.avg ?? t.none}</b></div>
      </div>

      <div className="grid2">
        <section className="panel">
          <h2>{t.needsAttention}</h2>
          {view.flags.length === 0 ? <p className="empty">{t.noAlerts}</p> : (
            <div className="list">
              {view.flags.map(({ p, c, reasons }) => (
                <a key={p.id} className="li" href={`#/players/${p.id}`}>
                  <span className="who"><Avatar name={p.full_name} />
                    <span><span className="nm">{p.full_name}</span><br /><span className="mt">{reasons.join(" · ")}</span></span>
                  </span>
                  <ReadyPill value={c?.readiness} />
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>{t.todayCheckins}</h2>
          {view.rows.length === 0 ? <p className="empty">{t.noPlayers}</p> : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>{t.name}</th><th className="hide-sm">{t.squad}</th><th>{t.readiness}</th><th>{t.sleepHours}</th><th>{t.statusL}</th></tr></thead>
                <tbody>
                  {view.rows.map(({ p, c }) => (
                    <tr key={p.id} className="click" onClick={() => navigate(`/players/${p.id}`)}>
                      <td><span className="who"><Avatar name={p.full_name} /><span className="nm">{p.full_name}</span></span></td>
                      <td className="hide-sm muted">{squadName(p.squad_id)}</td>
                      <td>{c ? <ReadyPill value={c.readiness} /> : <span className="pill na">{t.noCheckin}</span>}</td>
                      <td className="num">{c?.sleep_hours ?? t.none}</td>
                      <td><StatusPill status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
