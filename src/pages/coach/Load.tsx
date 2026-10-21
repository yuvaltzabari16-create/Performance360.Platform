import { useMemo, useState } from "react";
import { Avatar, ErrorBox, Loading } from "../../components/ui";
import { loadClub, loadRpe } from "../../lib/data";
import { addDays, isoDate } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { acwrTone, summarize } from "../../lib/load";
import { navigate } from "../../lib/router";
import { useSession } from "../../lib/session";
import { useAsync } from "../../lib/useAsync";

export function AcwrPill({ value }: { value: number | null }) {
  const { t } = useI18n();
  return <span className={"pill " + acwrTone(value)}>{value == null ? t.none : value.toFixed(2)}</span>;
}

/** Acute / chronic / ACWR per player, highest ACWR first. */
export function LoadTable() {
  const { t } = useI18n();
  const { club } = useSession();
  const today = isoDate();
  const [squad, setSquad] = useState("all");
  const q = useAsync(async () => {
    const [c, rpe] = await Promise.all([loadClub(club!.id), loadRpe(club!.id, addDays(today, -27), today)]);
    return { ...c, rpe };
  }, [club?.id, today]);

  const rows = useMemo(() => {
    if (!q.data) return [];
    return q.data.players
      .filter((p) => squad === "all" || p.squad_id === squad)
      .map((p) => {
        const mine = q.data!.rpe.filter((r) => r.player_id === p.id);
        const s = summarize(mine, today);
        const week = mine.filter((r) => r.session_date > addDays(today, -7));
        return { p, ...s, week: week.reduce((a, r) => a + r.load, 0), sessions7: week.length };
      })
      .sort((a, b) => (b.acwr ?? -1) - (a.acwr ?? -1));
  }, [q.data, squad, today]);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data) return null;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t.loadByPlayer}</h2>
        {q.data.squads.length > 0 && (
          <select value={squad} onChange={(e) => setSquad(e.target.value)} style={{ width: "auto" }} aria-label={t.squad}>
            <option value="all">{t.allSquads}</option>
            {q.data.squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>{t.acwrHelp}</p>
      {rows.length === 0 ? <p className="empty">{t.noPlayers}</p> : (
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>{t.name}</th><th>{t.acwr}</th><th>{t.acute}</th><th>{t.chronic}</th>
              <th className="hide-sm">{t.totalLoad} 7d</th><th className="hide-sm">{t.training} 7d</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.p.id} className="click" onClick={() => navigate(`/players/${r.p.id}`)}>
                  <td><span className="who"><Avatar name={r.p.full_name} /><span className="nm">{r.p.full_name}</span></span></td>
                  <td><AcwrPill value={r.acwr} /></td>
                  <td className="num">{Math.round(r.acute)}</td>
                  <td className="num">{Math.round(r.chronic)}</td>
                  <td className="num hide-sm">{r.week}</td>
                  <td className="num hide-sm">{r.sessions7}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
