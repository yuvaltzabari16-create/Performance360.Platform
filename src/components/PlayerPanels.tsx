import { fmtValue, testName } from "../lib/data";
import { fmtDay, isoDate } from "../lib/dates";
import { useI18n } from "../lib/i18n";
import { summarize } from "../lib/load";
import type { SessionRpe, TestDef, TestResult } from "../lib/types";
import { AcwrPill } from "../pages/coach/Load";
import { Delta, testStats } from "../pages/coach/Testing";
import { LoadChart } from "./ReadinessChart";

export function LoadPanel({ rpe, title }: { rpe: SessionRpe[]; title?: string }) {
  const { t } = useI18n();
  const s = summarize(rpe, isoDate());
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title ?? t.dailyLoad28}</h2>
        <span className="row"><span className="muted" style={{ fontSize: 12 }}>{t.acwr}</span><AcwrPill value={s.acwr} /></span>
      </div>
      <LoadChart values={s.daily} days={28} />
      <div className="row muted" style={{ fontSize: 12, gap: 16 }}>
        <span>{t.acute}: <b className="num">{Math.round(s.acute)}</b> {t.au}</span>
        <span>{t.chronic}: <b className="num">{Math.round(s.chronic)}</b> {t.au}</span>
      </div>
    </section>
  );
}

export function TestsPanel({ defs, results, title }: { defs: TestDef[]; results: TestResult[]; title?: string }) {
  const { t, lang } = useI18n();
  const rows = defs
    .map((d) => ({ d, s: testStats(results.filter((r) => r.test_id === d.id), d) }))
    .filter((r) => r.s);
  return (
    <section className="panel">
      <h2>{title ?? t.testing}</h2>
      {rows.length === 0 ? <p className="empty">{t.noResults}</p> : (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>{t.test}</th><th>{t.latest}</th><th>{t.change}</th><th className="hide-sm">{t.best}</th></tr></thead>
            <tbody>
              {rows.map(({ d, s }) => (
                <tr key={d.id}>
                  <td>{testName(d, lang)} <span className="muted" style={{ fontSize: 11 }}>{d.unit}</span></td>
                  <td className="num">{fmtValue(s!.latest.value, d)} <span className="muted" style={{ fontSize: 11 }}>{fmtDay(s!.latest.tested_on, lang)}</span></td>
                  <td><Delta delta={s!.delta} improved={s!.improved} def={d} /></td>
                  <td className="num hide-sm">{fmtValue(s!.best.value, d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
