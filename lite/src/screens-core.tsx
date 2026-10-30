import { useEffect, useMemo, useState, type FormEvent } from "react";
import { staffAlerts } from "@/lib/alerts";
import { workloads } from "@/lib/gps/workload";
import { daysOut, returnOutlook } from "@/lib/injury";
import { isImprovement, percentChange, readinessFlag, wellnessIndex } from "@/lib/metrics";
import { round } from "@/lib/units";
import { useApp } from "./ctx";
import { ARTIFACT, ask } from "./platform";
import { LinkAccount } from "./link";
import {
  BODY_AREAS, INJURY_STAGES, newId, parseLoadCsv, removeAthlete, removeById, replaceById, saveCheckIn, setInjuryStage,
  type Athlete, type CheckIn, type Injury, type TestEntry,
} from "./model";
import { fill } from "./strings";

const idx = (c: CheckIn) => wellnessIndex({ sleep_quality: c.sleepQuality, fatigue: c.fatigue, soreness: c.soreness, stress: c.stress, mood: c.mood, motivation: c.motivation });

export function Overview() {
  const { s, L, d, today, go, lang } = useApp();
  const t = L.overview;
  const name = (id: string) => s.athletes.find((a) => a.id === id)?.name ?? "—";

  const alerts = useMemo(() => {
    const out: { key: string; athleteId: string; text: string; tone: "warn" | "bad" }[] = [];
    for (const a of staffAlerts(s.loads.map((l) => ({ athleteId: l.athleteId, date: l.date, load: l.load })), [], today)) {
      out.push({ key: `w-${a.athleteId}`, athleteId: a.athleteId, text: fill(a.kind === "workload_high" ? t.alertHigh : t.alertLow, { v: a.value }), tone: a.kind === "workload_high" ? "bad" : "warn" });
    }
    for (const a of s.athletes) {
      const mine = s.checkIns.filter((c) => c.athleteId === a.id).sort((x, y) => y.date.localeCompare(x.date));
      const todays = mine.find((c) => c.date === today);
      if (todays) {
        const prior = mine.filter((c) => c.date < today).slice(0, 14).map(idx);
        if (todays.pain || readinessFlag(idx(todays), prior)) out.push({ key: `r-${a.id}`, athleteId: a.id, text: `${t.flagged}${todays.pain ? " · " + d.readiness.pain.replace("?", "") : ""}`, tone: "warn" });
      }
    }
    for (const i of s.injuries.filter((x) => x.status === "open")) {
      if (returnOutlook(i.expectedReturn, today).kind === "overdue") out.push({ key: `i-${i.id}`, athleteId: i.athleteId, text: `${d.injury.areas[i.area as keyof typeof d.injury.areas] ?? i.area}: ${t.overdue}`, tone: "warn" });
    }
    return out;
  }, [s, today, t, d]);

  const checkedToday = s.checkIns.filter((c) => c.date === today).length;
  const open = s.injuries.filter((i) => i.status === "open").length;
  void lang;
  return (
    <>
      <h1>{t.title}</h1>
      {s.athletes.length === 0 && (
        <div className="card">
          <p>{t.startHint}</p>
          <button className="btn primary" onClick={() => go({ name: "athletes" })}>{t.addAthlete}</button>
        </div>
      )}
      <div className="grid" style={{ marginBottom: "1rem" }}>
        {[[t.athletes, s.athletes.length], [t.checkedIn, `${checkedToday}/${s.athletes.length}`], [t.openInjuries, open], [t.programs, s.programs.length]].map(([label, v]) => (
          <div className="card" key={String(label)}><div className="muted small">{label}</div><div className="stat">{v}</div></div>
        ))}
      </div>
      <div className="card">
        <h2>{t.attention}</h2>
        {alerts.length === 0 ? <p className="muted">{t.none}</p> : (
          <ul className="list">
            {alerts.map((a) => (
              <li key={a.key} className="row between">
                <span><button className="btn link" onClick={() => go({ name: "athletes", athleteId: a.athleteId })}>{name(a.athleteId)}</button> <span className={`pill ${a.tone}`}>{a.text}</span></span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function Athletes() {
  const { s, update, L, go } = useApp();
  const t = L.athletes;
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    if (!name) return;
    const a: Athlete = { id: newId(), name: name.slice(0, 120), sport: String(f.get("sport") ?? "").slice(0, 80), position: String(f.get("position") ?? "").slice(0, 80), notes: "", createdAt: new Date().toISOString() };
    update((st) => ({ ...st, athletes: [...st.athletes, a] }));
    setAdding(false);
    go({ name: "athletes", athleteId: a.id });
  }
  const list = s.athletes.filter((a) => a.name.toLowerCase().includes(q.trim().toLowerCase())).sort((x, y) => x.name.localeCompare(y.name));
  return (
    <>
      <div className="row between"><h1>{t.title}</h1><button className="btn primary" onClick={() => setAdding(true)}>{t.add}</button></div>
      {adding && (
        <form className="card form" onSubmit={create}>
          <label className="f">{L.common.name}<input name="name" required maxLength={120} autoFocus /></label>
          <label className="f">{L.common.sport}<input name="sport" maxLength={80} /></label>
          <label className="f">{L.common.position}<input name="position" maxLength={80} /></label>
          <div className="row"><button className="btn primary" type="submit">{L.common.save}</button><button type="button" className="btn" onClick={() => setAdding(false)}>{L.common.cancel}</button></div>
        </form>
      )}
      {s.athletes.length > 0 && <input aria-label={L.common.search} placeholder={L.common.search} value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: ".75rem" }} />}
      <div className="card">
        {list.length === 0 ? <p className="muted">{t.empty}</p> : (
          <ul className="list">
            {list.map((a) => (
              <li key={a.id} className="row between">
                <button className="btn link" onClick={() => go({ name: "athletes", athleteId: a.id })}>{a.name}</button>
                <span className="muted small">{[a.sport, a.position].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

type Tab = "checkIns" | "tests" | "injuries" | "load";

export function AthleteDetail({ id }: { id: string }) {
  const { s, update, L, go } = useApp();
  const a = s.athletes.find((x) => x.id === id);
  const [tab, setTab] = useState<Tab>("checkIns");
  if (!a) return <p className="muted">{L.common.empty}</p>;
  const t = L.athletes;
  const patch = (p: Partial<Athlete>) => update((st) => ({ ...st, athletes: replaceById(st.athletes, { ...a, ...p }) }));
  return (
    <>
      <button className="btn link" onClick={() => go({ name: "athletes" })}>← {L.common.back}</button>
      <div className="card">
        <div className="form">
          <label className="f">{L.common.name}<input value={a.name} maxLength={120} onChange={(e) => patch({ name: e.target.value })} /></label>
          <label className="f">{L.common.sport}<input value={a.sport} maxLength={80} onChange={(e) => patch({ sport: e.target.value })} /></label>
          <label className="f">{L.common.position}<input value={a.position} maxLength={80} onChange={(e) => patch({ position: e.target.value })} /></label>
        </div>
        <label className="f" style={{ marginTop: ".6rem" }}>{L.common.notes} <span className="muted small">({t.noteHelp})</span>
          <textarea rows={2} value={a.notes} maxLength={4000} onChange={(e) => patch({ notes: e.target.value })} /></label>
        <div className="row" style={{ marginTop: ".6rem" }}>
          <button className="btn danger" onClick={async () => { if (await ask(t.deleteWarn)) { update((st) => removeAthlete(st, a.id)); go({ name: "athletes" }); } }}>{L.common.delete}</button>
        </div>
      </div>
      {ARTIFACT && !a.id.startsWith("demo-") && <LinkAccount athlete={a} />}
      <div className="tabs" role="tablist">
        {(Object.keys(t.tabs) as Tab[]).map((k) => <button key={k} role="tab" aria-current={tab === k} onClick={() => setTab(k)}>{t.tabs[k]}</button>)}
      </div>
      {tab === "checkIns" && <CheckIns athlete={a} />}
      {tab === "tests" && <Tests athlete={a} />}
      {tab === "injuries" && <Injuries athlete={a} />}
      {tab === "load" && <Load athlete={a} />}
    </>
  );
}

const SCALES = ["sleepQuality", "fatigue", "soreness", "stress", "mood", "motivation"] as const;
const num = (v: FormDataEntryValue | null) => { const n = Number(v); return v === null || v === "" || !Number.isFinite(n) ? null : n; };

export function CheckIns({ athlete }: { athlete: Athlete }) {
  const { s, update, L, d, today } = useApp();
  const t = L.checkIn;
  const mine = s.checkIns.filter((c) => c.athleteId === athlete.id).sort((x, y) => y.date.localeCompare(x.date));
  const [date, setDate] = useState(today);
  const existing = mine.find((c) => c.date === date);
  const [, force] = useState(0);
  useEffect(() => force((n) => n + 1), [date]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const scale = (k: string) => { const n = num(f.get(k)); return n !== null && n >= 1 && n <= 5 ? n : null; };
    const hours = num(f.get("sleepHours"));
    const c: CheckIn = {
      id: existing?.id ?? newId(), athleteId: athlete.id, date,
      sleepHours: hours !== null && hours >= 0 && hours <= 24 ? hours : null,
      sleepQuality: scale("sleepQuality"), fatigue: scale("fatigue"), soreness: scale("soreness"), stress: scale("stress"), mood: scale("mood"), motivation: scale("motivation"),
      pain: f.get("pain") === "on", painNote: String(f.get("painNote") ?? "").slice(0, 500),
    };
    update((st) => saveCheckIn(st, c));
  }
  const history = mine.slice(0, 14);
  const values = history.map(idx).reverse();
  return (
    <>
      <form className="card" key={`${athlete.id}-${date}-${existing?.id ?? "new"}`} onSubmit={submit}>
        <h2>{t.today}</h2>
        <div className="form">
          <label className="f">{L.common.date}<input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required /></label>
          <label className="f">{d.readiness.sleepHours}<input name="sleepHours" type="number" step="0.5" min="0" max="24" defaultValue={existing?.sleepHours ?? ""} /></label>
          {SCALES.map((k) => (
            <label className="f" key={k}>{d.readiness[k]}
              <select name={k} aria-label={d.readiness[k]} defaultValue={existing?.[k] ?? ""}><option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </label>
          ))}
        </div>
        <p className="muted small">{d.readiness.scaleGood} · {d.readiness.scaleBad}</p>
        <label className="f inline"><input type="checkbox" name="pain" defaultChecked={existing?.pain} /> {d.readiness.pain}</label>
        <label className="f">{d.readiness.painNotes}<input name="painNote" maxLength={500} defaultValue={existing?.painNote ?? ""} /></label>
        <div className="row" style={{ marginTop: ".6rem" }}><button className="btn primary" type="submit">{L.common.save}</button></div>
      </form>
      <div className="card">
        <h2>{t.history}</h2>
        {history.length === 0 ? <p className="muted">{t.empty}</p> : (
          <>
            <div className="bar" aria-hidden="true">{values.map((v, i) => <i key={i} style={{ height: `${v == null ? 5 : (v / 5) * 100}%` }} />)}</div>
            <div className="scroll-x"><table><thead><tr><th>{L.common.date}</th><th>{t.index}</th><th>{d.readiness.sleepHours}</th><th /></tr></thead>
              <tbody>{history.map((c) => {
                const v = idx(c);
                const prior = mine.filter((x) => x.date < c.date).slice(0, 14).map(idx);
                return <tr key={c.id}><td>{c.date}</td><td>{v == null ? "—" : round(v, 1)}</td><td>{c.sleepHours ?? "—"}</td><td>{(c.pain || readinessFlag(v, prior)) && <span className="pill warn">{t.flagged}{c.pain ? ` · ${d.readiness.pain.replace("?", "")}` : ""}</span>}</td></tr>;
              })}</tbody></table></div>
          </>
        )}
      </div>
    </>
  );
}

function Tests({ athlete }: { athlete: Athlete }) {
  const { s, update, L, today } = useApp();
  const t = L.tests;
  const mine = s.tests.filter((x) => x.athleteId === athlete.id);
  const groups = useMemo(() => {
    const m = new Map<string, TestEntry[]>();
    for (const r of [...mine].sort((a, b) => a.date.localeCompare(b.date))) m.set(r.name, [...(m.get(r.name) ?? []), r]);
    return [...m.entries()];
  }, [mine]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const value = num(f.get("value"));
    const name = String(f.get("name") ?? "").trim();
    if (value === null || !name) return;
    const r: TestEntry = { id: newId(), athleteId: athlete.id, date: String(f.get("date")), name: name.slice(0, 120), unit: String(f.get("unit") ?? "").slice(0, 20), value, higherIsBetter: f.get("higher") === "on" };
    update((st) => ({ ...st, tests: [...st.tests, r] }));
    e.currentTarget.reset();
  }
  return (
    <>
      <form className="card form" onSubmit={submit}>
        <label className="f">{t.name}<input name="name" required maxLength={120} list="test-names" /></label>
        <datalist id="test-names">{[...new Set(s.tests.map((x) => x.name))].map((n) => <option key={n} value={n} />)}</datalist>
        <label className="f">{L.common.value}<input name="value" type="number" step="any" required /></label>
        <label className="f">{t.unit}<input name="unit" maxLength={20} /></label>
        <label className="f">{L.common.date}<input name="date" type="date" defaultValue={today} max={today} required /></label>
        <label className="f inline"><input name="higher" type="checkbox" defaultChecked /> {t.higher}</label>
        <div className="row"><button className="btn primary" type="submit">{t.add}</button></div>
      </form>
      <div className="card">
        <h2>{t.title}</h2>
        {groups.length === 0 ? <p className="muted">{t.empty}</p> : groups.map(([name, rows]) => {
          const first = rows[0], last = rows[rows.length - 1];
          const better = last.higherIsBetter ? Math.max(...rows.map((r) => r.value)) : Math.min(...rows.map((r) => r.value));
          const change = percentChange(last.value, first.value);
          const good = isImprovement(change, last.higherIsBetter);
          return (
            <div key={name} style={{ marginBottom: ".9rem" }}>
              <h3>{name}</h3>
              <div className="row small">
                <span>{t.last}: <b>{last.value} {last.unit}</b></span><span>{t.best}: <b>{better} {last.unit}</b></span>
                {rows.length > 1 && change !== null && <span className={`pill ${good ? "" : "warn"}`}>{t.change}: {change > 0 ? "+" : ""}{round(change, 1)}%</span>}
                <span className="muted">{t.count}: {rows.length}</span>
              </div>
              <div className="scroll-x"><table><tbody>{[...rows].reverse().slice(0, 6).map((r) => (
                <tr key={r.id}><td>{r.date}</td><td>{r.value} {r.unit}</td><td><button className="btn link" aria-label={L.common.delete} onClick={() => update((st) => ({ ...st, tests: removeById(st.tests, r.id) }))}>×</button></td></tr>
              ))}</tbody></table></div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Injuries({ athlete }: { athlete: Athlete }) {
  const { s, update, L, d, today } = useApp();
  const t = L.injuries;
  const mine = s.injuries.filter((i) => i.athleteId === athlete.id).sort((a, b) => (a.status === b.status ? b.injuryDate.localeCompare(a.injuryDate) : a.status === "open" ? -1 : 1));
  const [err, setErr] = useState("");
  function report(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const injuryDate = String(f.get("date"));
    const expected = String(f.get("expected") ?? "");
    const i: Injury = {
      id: newId(), athleteId: athlete.id, area: String(f.get("area")), injuryDate, expectedReturn: expected && expected >= injuryDate ? expected : null,
      stage: "rest", status: "open", note: String(f.get("note") ?? "").slice(0, 2000), events: [{ at: new Date().toISOString(), stage: "rest", note: String(f.get("note") ?? "").slice(0, 2000) }],
    };
    update((st) => ({ ...st, injuries: [...st.injuries, i] }));
    e.currentTarget.reset();
  }
  return (
    <>
      <form className="card form" onSubmit={report}>
        <label className="f">{t.area}<select name="area" aria-label={t.area}>{BODY_AREAS.map((a) => <option key={a} value={a}>{d.injury.areas[a]}</option>)}</select></label>
        <label className="f">{t.date}<input name="date" type="date" defaultValue={today} max={today} required /></label>
        <label className="f">{t.expected}<input name="expected" type="date" /></label>
        <label className="f">{t.note}<input name="note" maxLength={2000} /></label>
        <div className="row"><button className="btn primary" type="submit">{t.add}</button></div>
      </form>
      <p className="muted small">{t.disclaimer}</p>
      {mine.length === 0 && <div className="card"><p className="muted">{t.empty}</p></div>}
      {mine.map((i) => (
        <div className="card" key={i.id}>
          <div className="row between">
            <h3>{d.injury.areas[i.area as keyof typeof d.injury.areas] ?? i.area} <span className={`pill ${i.status === "open" ? "warn" : ""}`}>{d.injury.stages[i.stage as keyof typeof d.injury.stages]}</span></h3>
            <span className="muted small">{i.injuryDate} · {daysOut(i.injuryDate, today, i.status === "resolved" ? i.events[i.events.length - 1]?.at.slice(0, 10) : null)} {L.common.days}</span>
          </div>
          <form className="row" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const r = setInjuryStage(i, String(f.get("stage")), String(f.get("note") ?? ""));
            if ("error" in r) { setErr(r.error === "note_required" ? t.needNote : ""); return; }
            setErr("");
            update((st) => ({ ...st, injuries: replaceById(st.injuries, r) }));
            e.currentTarget.reset();
          }}>
            <select name="stage" aria-label={t.move} defaultValue={i.stage} style={{ width: "auto" }}>{INJURY_STAGES.map((g) => <option key={g} value={g}>{d.injury.stages[g]}</option>)}</select>
            <input name="note" placeholder={t.stageNote} maxLength={2000} style={{ flex: 1, minWidth: "10rem" }} />
            <button className="btn" type="submit">{t.move}</button>
            <button type="button" className="btn danger" onClick={async () => { if (await ask(L.common.confirm)) update((st) => ({ ...st, injuries: removeById(st.injuries, i.id) })); }}>{L.common.delete}</button>
          </form>
          {err && <p role="alert" className="pill bad">{err}</p>}
          <h3 style={{ marginTop: ".6rem" }}>{t.timeline}</h3>
          <ul className="list small">{[...i.events].reverse().map((ev, k) => <li key={k}>{ev.at.slice(0, 10)} · <b>{d.injury.stages[ev.stage as keyof typeof d.injury.stages]}</b>{ev.note ? ` · ${ev.note}` : ""}</li>)}</ul>
        </div>
      ))}
    </>
  );
}

function Load({ athlete }: { athlete: Athlete }) {
  const { s, update, L, today } = useApp();
  const t = L.load;
  const mine = s.loads.filter((l) => l.athleteId === athlete.id).sort((a, b) => b.date.localeCompare(a.date));
  const w = workloads(mine.map((l) => ({ athleteId: l.athleteId, date: l.date, load: l.load })), today)[0];
  const [msg, setMsg] = useState("");
  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = num(f.get("load"));
    if (v === null || v < 0 || v > 100000) return;
    update((st) => ({ ...st, loads: [...st.loads, { id: newId(), athleteId: athlete.id, date: String(f.get("date")), load: v }] }));
    e.currentTarget.reset();
  }
  async function importCsv(file: File | undefined) {
    if (!file) return;
    const { rows, skipped } = parseLoadCsv(await file.text(), s.athletes);
    update((st) => ({ ...st, loads: [...st.loads, ...rows] }));
    setMsg(fill(t.imported, { n: rows.length, s: skipped }));
  }
  return (
    <>
      <form className="card form" onSubmit={add}>
        <label className="f">{L.common.date}<input name="date" type="date" defaultValue={today} max={today} required /></label>
        <label className="f">{t.value}<input name="load" type="number" step="any" min="0" required /></label>
        <div className="row"><button className="btn primary" type="submit">{t.add}</button></div>
      </form>
      <div className="card">
        <h2>{t.title}</h2>
        {w ? (
          <div className="row">
            <span>{t.acute}: <b>{w.acute}</b></span><span>{t.chronic}: <b>{w.chronic}</b></span>
            <span>{t.ratio}: <b>{w.ratio ?? "—"}</b></span>
            <span className={`pill ${w.status === "high" ? "bad" : w.status === "low" ? "warn" : ""}`}>{t.status[w.status]}</span>
          </div>
        ) : <p className="muted">{t.empty}</p>}
        <p className="muted small">{t.help}</p>
        {mine.length > 0 && <div className="scroll-x"><table><tbody>{mine.slice(0, 10).map((l) => (
          <tr key={l.id}><td>{l.date}</td><td>{l.load}</td><td><button className="btn link" aria-label={L.common.delete} onClick={() => update((st) => ({ ...st, loads: removeById(st.loads, l.id) }))}>×</button></td></tr>
        ))}</tbody></table></div>}
      </div>
      <div className="card">
        <h3>{t.import}</h3>
        <p className="muted small">{t.importHelp}</p>
        <input type="file" accept=".csv,.txt" aria-label={t.import} onChange={(e) => { void importCsv(e.target.files?.[0]); e.target.value = ""; }} />
        {msg && <p role="status">{msg}</p>}
      </div>
    </>
  );
}
