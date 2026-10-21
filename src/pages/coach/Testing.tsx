import { useMemo, useState } from "react";
import { DateLine } from "../../components/charts";
import { Avatar, ErrorBox, Field, Loading, useAction } from "../../components/ui";
import { editablePlayerIds, fmtValue, loadClub, loadResults, loadTestDefs, testName } from "../../lib/data";
import { fmtDay, isoDate } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { navigate } from "../../lib/router";
import { useSession } from "../../lib/session";
import { must, supabase } from "../../lib/supabase";
import type { TestDef, TestResult } from "../../lib/types";
import { useAsync } from "../../lib/useAsync";

/** Latest, previous, best for one player's results on one test (results sorted by date asc). */
export function testStats(results: TestResult[], def: TestDef) {
  if (!results.length) return null;
  const latest = results[results.length - 1];
  const previous = results.length > 1 ? results[results.length - 2] : null;
  const best = results.reduce((b, r) => (def.higher_is_better ? (r.value > b.value ? r : b) : (r.value < b.value ? r : b)));
  const delta = previous ? latest.value - previous.value : null;
  const improved = delta == null || delta === 0 ? null : def.higher_is_better ? delta > 0 : delta < 0;
  return { latest, previous, best, delta, improved };
}

export function Delta({ delta, improved, def }: { delta: number | null; improved: boolean | null; def: TestDef }) {
  if (delta == null) return <span className="muted">—</span>;
  const cls = improved == null ? "flat" : improved ? "up" : "down";
  return <span dir="ltr" className={"delta " + cls}>{delta > 0 ? "+" : ""}{fmtValue(delta, def)}</span>;
}

export function Testing() {
  const { t, lang } = useI18n();
  const { club, role, userId } = useSession();
  const act = useAction();
  const [testId, setTestId] = useState<string | null>(null);
  const [squad, setSquad] = useState("all");
  const [recording, setRecording] = useState(false);
  const [date, setDate] = useState(isoDate());
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const q = useAsync(async () => {
    const [c, defs, results] = await Promise.all([loadClub(club!.id), loadTestDefs(), loadResults(club!.id)]);
    return { ...c, defs: defs.filter((d) => !d.club_id || d.club_id === club!.id), results };
  }, [club?.id]);

  const def = q.data?.defs.find((d) => d.id === testId) ?? q.data?.defs[0] ?? null;
  const players = useMemo(() => (q.data ? q.data.players.filter((p) => squad === "all" || p.squad_id === squad) : []), [q.data, squad]);

  const view = useMemo(() => {
    if (!q.data || !def) return null;
    const res = q.data.results.filter((r) => r.test_id === def.id);
    const rows = players.map((p) => ({ p, s: testStats(res.filter((r) => r.player_id === p.id), def) }));
    rows.sort((a, b) => {
      if (!a.s) return 1; if (!b.s) return -1;
      return def.higher_is_better ? b.s.latest.value - a.s.latest.value : a.s.latest.value - b.s.latest.value;
    });
    const ids = new Set(players.map((p) => p.id));
    const byDate = new Map<string, number[]>();
    for (const r of res) if (ids.has(r.player_id)) byDate.set(r.tested_on, [...(byDate.get(r.tested_on) ?? []), Number(r.value)]);
    const trend = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, value: v.reduce((x, y) => x + y, 0) / v.length }));
    return { rows, trend };
  }, [q.data, def, players]);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data || !def || !view) return null;
  const editable = editablePlayerIds(q.data, role, userId);
  const filled = Object.entries(vals).filter(([, v]) => v.trim() !== "" && !isNaN(Number(v)));

  async function save() {
    setBusy(true);
    const rows = filled.map(([player_id, v]) => ({ player_id, test_id: def!.id, tested_on: date, value: Number(v) }));
    const ok = await act(async () => { must(await supabase.from("test_results").insert(rows)); }, t.resultsSaved);
    setBusy(false);
    if (ok) { setVals({}); setRecording(false); q.reload(); }
  }

  return (
    <>
      <div className="spread">
        <h1>{t.testing}</h1>
        {editable.size > 0 && !recording && <button className="btn" onClick={() => setRecording(true)}>+ {t.recordResults}</button>}
      </div>

      <div className="row">
        <div className="seg" role="group" aria-label={t.test}>
          {q.data.defs.map((d) => (
            <button key={d.id} aria-pressed={d.id === def.id} onClick={() => { setTestId(d.id); setVals({}); }}>{testName(d, lang)}</button>
          ))}
        </div>
        {q.data.squads.length > 0 && (
          <select value={squad} onChange={(e) => setSquad(e.target.value)} style={{ width: "auto" }} aria-label={t.squad}>
            <option value="all">{t.allSquads}</option>
            {q.data.squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {recording && (
        <section className="panel">
          <div className="panel-head">
            <h2>{t.recordResults}: {testName(def, lang)} ({def.unit})</h2>
            <Field label={t.testDate}><input type="date" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <p className="muted" style={{ margin: 0 }}>{t.enterValuesHint}</p>
          <div className="form">
            {players.filter((p) => editable.has(p.id)).map((p) => (
              <Field key={p.id} label={p.full_name}>
                <input type="number" inputMode="decimal" step="any" value={vals[p.id] ?? ""} onChange={(e) => setVals({ ...vals, [p.id]: e.target.value })} />
              </Field>
            ))}
          </div>
          <div className="row">
            <button className="btn" disabled={busy || filled.length === 0} onClick={save}>{t.save} ({filled.length})</button>
            <button className="btn ghost" onClick={() => { setRecording(false); setVals({}); }}>{t.cancel}</button>
          </div>
        </section>
      )}

      <div className="grid2">
        <section className="panel">
          <div className="panel-head">
            <h2>{testName(def, lang)}</h2>
            <span className="muted" style={{ fontSize: 12 }}>{def.unit} · {def.higher_is_better ? t.higherBetter : t.lowerBetter}</span>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>{t.name}</th><th>{t.latest}</th><th>{t.change}</th><th className="hide-sm">{t.previous}</th><th className="hide-sm">{t.best}</th></tr></thead>
              <tbody>
                {view.rows.map(({ p, s }) => (
                  <tr key={p.id} className="click" onClick={() => navigate(`/players/${p.id}`)}>
                    <td><span className="who"><Avatar name={p.full_name} /><span className="nm">{p.full_name}</span></span></td>
                    <td className="num">{s ? <>{fmtValue(s.latest.value, def)} <span className="muted" style={{ fontSize: 11 }}>{fmtDay(s.latest.tested_on, lang)}</span></> : "—"}</td>
                    <td>{s ? <Delta delta={s.delta} improved={s.improved} def={def} /> : ""}</td>
                    <td className="num hide-sm">{s?.previous ? fmtValue(s.previous.value, def) : "—"}</td>
                    <td className="num hide-sm">{s ? fmtValue(s.best.value, def) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <h2>{t.teamAvg}</h2>
          {view.trend.length === 0 ? <p className="empty">{t.noResults}</p> : <DateLine points={view.trend} label={t.teamAvg} fmt={(v) => v.toFixed(def.decimals)} />}
        </section>
      </div>
    </>
  );
}
