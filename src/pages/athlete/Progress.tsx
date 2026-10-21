import { ReadinessChart } from "../../components/ReadinessChart";
import { ErrorBox, Loading, ReadyPill } from "../../components/ui";
import { addDays, fmtDay, isoDate } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { useSession } from "../../lib/session";
import { must, supabase } from "../../lib/supabase";
import type { Checkin } from "../../lib/types";
import { useAsync } from "../../lib/useAsync";

export function Progress() {
  const { t, lang } = useI18n();
  const { myPlayer } = useSession();
  const today = isoDate();
  const q = useAsync(async () => {
    if (!myPlayer) return [];
    return must(await supabase.from("wellness_checkins").select("*").eq("player_id", myPlayer.id)
      .gte("entry_date", addDays(today, -27)).order("entry_date", { ascending: false })) as Checkin[];
  }, [myPlayer?.id, today]);

  if (!myPlayer) return <><h1>{t.progress}</h1><div className="panel"><p className="empty">{t.notLinkedAthlete}</p></div></>;
  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  const rows = q.data ?? [];
  const avg = (list: Checkin[]) => (list.length ? Math.round(list.reduce((s, c) => s + c.readiness, 0) / list.length) : null);
  const last7 = rows.filter((c) => c.entry_date > addDays(today, -7));
  const dates = new Set(rows.map((c) => c.entry_date));
  let streak = 0;
  for (let d = dates.has(today) ? today : addDays(today, -1); dates.has(d); d = addDays(d, -1)) streak++;

  return (
    <>
      <h1>{t.progress}</h1>
      <div className="kpis">
        <div className="kpi"><span className="lbl">{t.avg7}</span><b>{avg(last7) ?? t.none}</b></div>
        <div className="kpi"><span className="lbl">{t.avg28}</span><b>{avg(rows) ?? t.none}</b></div>
        <div className="kpi"><span className="lbl">{t.streak}</span><b>{streak}</b><small>{t.days}</small></div>
      </div>
      <section className="panel">
        <h2>{t.last28}</h2>
        <ReadinessChart values={Object.fromEntries(rows.map((c) => [c.entry_date, c.readiness]))} days={28} />
      </section>
      <section className="panel">
        <h2>{t.recentCheckins}</h2>
        {rows.length === 0 ? <p className="empty">{t.noCheckins}</p> : (
          <div className="list">
            {rows.map((c) => (
              <div key={c.id} className="li">
                <span><b>{fmtDay(c.entry_date, lang, { weekday: "short", day: "numeric", month: "short" })}</b>
                  <span className="muted"> · {t.sleepHours} {c.sleep_hours ?? t.none}</span></span>
                <ReadyPill value={c.readiness} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
