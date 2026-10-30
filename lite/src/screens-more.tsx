import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { fieldEditValue, parseField, FIELD_KEYS, type FieldKey } from "@/lib/builder-fields";
import { SESSION_SECTIONS, type SessionSection } from "@/lib/catalog";
import { answer } from "@/lib/assistant/engine";
import { detectIntent, personalAnswer } from "@/lib/assistant/personal";
import { generateWorkout } from "@/lib/generator/generate";
import { buildPreview, type WorkoutPreview } from "@/lib/generator/preview";
import { personalDataFrom } from "./bridge";
import { useApp } from "./ctx";
import { ARTIFACT, ask } from "./platform";
import { CATEGORIES, EQUIPMENT, LIBRARY, type LibraryItem } from "./library";
import {
  csvCell, emptyState, exportJson, newId, parseImport, removeById, replaceById, todayIso,
  type Program, type SessionItem, type Theme, type TrainingSession,
} from "./model";
import { Rich } from "./rich";
import { storageKind } from "./storage";
import { fill } from "./strings";
import { download, itemChips, sessionText } from "./util";

// ---- library ---------------------------------------------------------------------------------------------------

export function LibraryList({ onAdd }: { onAdd?: (e: LibraryItem) => void }) {
  const { L } = useApp();
  const t = L.library;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [gear, setGear] = useState("");
  const [level, setLevel] = useState("");
  const [shown, setShown] = useState(40);
  const found = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return LIBRARY.filter((e) => (!needle || e.name.toLowerCase().includes(needle)) && (!cat || e.category === cat) && (!gear || (e.equipment ?? []).includes(gear)) && (!level || e.difficulty === level));
  }, [q, cat, gear, level]);
  return (
    <>
      <div className="form no-print" style={{ marginBottom: ".75rem" }}>
        <input aria-label={L.common.search} placeholder={L.common.search} value={q} onChange={(e) => { setQ(e.target.value); setShown(40); }} />
        <select aria-label={t.category} value={cat} onChange={(e) => { setCat(e.target.value); setShown(40); }}><option value="">{t.category}: {L.common.all}</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label={t.equipment} value={gear} onChange={(e) => { setGear(e.target.value); setShown(40); }}><option value="">{t.equipment}: {L.common.all}</option>{EQUIPMENT.map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label={t.level} value={level} onChange={(e) => { setLevel(e.target.value); setShown(40); }}><option value="">{t.level}: {L.common.all}</option>{["beginner", "intermediate", "advanced"].map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <p className="muted small">{fill(t.results, { n: found.length })}</p>
      {found.length === 0 ? <p className="muted">{t.none}</p> : (
        <ul className="list">
          {found.slice(0, shown).map((e) => (
            <li key={e.id} className="row between">
              <span><b>{e.name}</b> <span className="pill">{e.category}</span> <span className="muted small">{e.difficulty}{(e.equipment ?? []).length ? ` · ${(e.equipment ?? []).join(", ")}` : ""}</span></span>
              <span className="row">
                {e.video_url && <a className="btn" href={e.video_url} target="_blank" rel="noopener noreferrer">{t.video}</a>}
                {onAdd && <button className="btn primary" onClick={() => onAdd(e)}>{L.common.add}</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {found.length > shown && <button className="btn" onClick={() => setShown((n) => n + 40)}>{t.more}</button>}
    </>
  );
}

export function LibraryScreen() {
  const { L } = useApp();
  return (<><h1>{L.library.title}</h1><div className="card"><LibraryList /></div></>);
}

// ---- training --------------------------------------------------------------------------------------------------

function FieldInput({ k, value, label, onCommit }: { k: FieldKey; value: string; label: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const parsed = parseField(k, text);
  return (
    <label>{label}
      <input value={text} className={parsed.ok ? "" : "bad"} aria-invalid={!parsed.ok}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (parsed.ok) onCommit(fieldEditValue(parsed.patch, k)); else setText(value); }} />
    </label>
  );
}

function AutoBuild({ onApply, onClose }: { onApply: (p: WorkoutPreview) => void; onClose: () => void }) {
  const { d, lang } = useApp();
  const ai = d.training.builder.ai;
  const [prompt, setPrompt] = useState("");
  const [seed, setSeed] = useState(0);
  const [preview, setPreview] = useState<WorkoutPreview | null>(null);
  const [error, setError] = useState("");
  function run(nextSeed: number) {
    setError("");
    if (prompt.trim().length < 3) { setPreview(null); setError(ai.errors.tooShort); return; }
    const p = buildPreview(generateWorkout(prompt.trim(), LIBRARY, nextSeed), LIBRARY);
    setSeed(nextSeed);
    setPreview(p);
    if (!p) setError(ai.errors.empty);
  }
  void lang;
  return (
    <div className="card no-print">
      <div className="row between"><h3>{ai.title}</h3><button className="btn link" onClick={onClose}>×</button></div>
      <label className="f">{ai.describe}
        <textarea rows={3} maxLength={800} value={prompt} placeholder={ai.placeholder} onChange={(e) => { setPrompt(e.target.value); setSeed(0); }} /></label>
      <div className="row" style={{ margin: ".4rem 0" }}>{ai.examples.map((ex) => <button key={ex} className="btn small" onClick={() => setPrompt(ex)}>{ex}</button>)}</div>
      <div className="row">
        <button className="btn primary" onClick={() => run(preview ? seed + 1 : 0)}>{preview ? ai.another : ai.generate}</button>
      </div>
      {error && <p role="alert" className="pill bad">{error}</p>}
      {preview && (
        <section aria-label={ai.previewTitle}>
          <h3 style={{ marginTop: ".6rem" }}>{preview.title}</h3>
          <p className="muted small">{ai.matched.replace("{t}", String(preview.matched))}</p>
          {preview.blocks.map((b, i) => (
            <div key={`${b.section}-${i}`}>
              <b>{d.training.sections[b.section]}</b>
              <ul className="list">{b.items.map((it) => (
                <li key={`${it.exerciseId}-${it.name}`}>{it.name}<div className="chips">{FIELD_KEYS.filter((k) => it.values[k]).map((k) => <span key={k} className="pill">{d.training.builder.fields[k]} {it.values[k]}</span>)}</div></li>
              ))}</ul>
            </div>
          ))}
          <p className="muted small">{ai.disclaimer}</p>
          <button className="btn primary" onClick={() => onApply(preview)}>{ai.apply}</button>
        </section>
      )}
    </div>
  );
}

function SessionCard({ program, session }: { program: Program; session: TrainingSession }) {
  const { update, L, d } = useApp();
  const t = L.training;
  const [auto, setAuto] = useState(false);
  const [picker, setPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const save = (next: TrainingSession) => update((st) => ({ ...st, programs: st.programs.map((p) => (p.id === program.id ? { ...p, sessions: replaceById(p.sessions, next) } : p)) }));
  const setItem = (it: SessionItem) => save({ ...session, items: replaceById(session.items, it) });
  const add = (items: SessionItem[]) => save({ ...session, items: [...session.items, ...items] });
  async function copy() {
    try { await navigator.clipboard.writeText(sessionText(session, d)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard not available */ }
  }
  return (
    <div className="card">
      <div className="row between">
        <input aria-label={t.sessionTitle} value={session.title} maxLength={160} onChange={(e) => save({ ...session, title: e.target.value })} style={{ fontWeight: 600, maxWidth: "24rem" }} />
        <span className="row no-print">
          <button className="btn" onClick={() => setAuto((v) => !v)}>{t.build}</button>
          <button className="btn" onClick={() => setPicker((v) => !v)}>{t.addFromLibrary}</button>
          <button className="btn" onClick={copy}>{copied ? t.copied : t.copy}</button>
          <button className="btn" onClick={() => window.print()}>{t.print}</button>
          <button className="btn danger" onClick={async () => { if (await ask(L.common.confirm)) update((st) => ({ ...st, programs: st.programs.map((p) => (p.id === program.id ? { ...p, sessions: removeById(p.sessions, session.id) } : p)) })); }}>{L.common.delete}</button>
        </span>
      </div>
      {auto && <AutoBuild onClose={() => setAuto(false)} onApply={(p) => {
        add(p.blocks.flatMap((b) => b.items.map((it) => ({ id: newId(), exerciseId: it.exerciseId, name: it.name, section: b.section, values: { ...it.values } }))));
        setAuto(false);
      }} />}
      {picker && <div className="card no-print"><LibraryList onAdd={(e) => add([{ id: newId(), exerciseId: e.id, name: e.name, section: sectionFor(e.category), values: {} }])} /></div>}
      {session.items.length === 0 ? <p className="muted">{t.noItems}</p> : (
        <ul className="list">
          {session.items.map((it) => (
            <li key={it.id}>
              <div className="row between">
                <span><b>{it.name}</b> <select aria-label={d.training.sections[it.section]} value={it.section} style={{ width: "auto" }} onChange={(e) => setItem({ ...it, section: e.target.value as SessionSection })}>
                  {SESSION_SECTIONS.map((sec) => <option key={sec} value={sec}>{d.training.sections[sec]}</option>)}</select></span>
                <button className="btn link no-print" onClick={() => save({ ...session, items: removeById(session.items, it.id) })}>{t.remove}</button>
              </div>
              <div className="chips no-print">
                {FIELD_KEYS.map((k) => <FieldInput key={k} k={k} label={d.training.builder.fields[k]} value={it.values[k] ?? ""} onCommit={(v) => { const values = { ...it.values }; if (v) values[k] = v; else delete values[k]; setItem({ ...it, values }); }} />)}
              </div>
              <div className="small muted print-only">{itemChips(it, d).join(" · ")}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SECTION_OF: Record<string, SessionSection> = {
  strength: "strength", power: "power", olympic: "power", plyometrics: "plyometrics", sprint: "sprint", acceleration: "sprint", max_velocity: "sprint",
  deceleration: "cod", cod: "cod", conditioning: "conditioning", mobility: "mobility", stability: "activation", core: "core", warmup: "warmup", recovery: "recovery", rehab: "activation",
};
const sectionFor = (category: string): SessionSection => SECTION_OF[category] ?? "strength";

export function Training({ programId }: { programId?: string }) {
  const { s, update, L, go } = useApp();
  const t = L.training;
  const program = s.programs.find((p) => p.id === programId);
  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = String(new FormData(e.currentTarget).get("title") ?? "").trim();
    if (!title) return;
    const p: Program = { id: newId(), title: title.slice(0, 160), createdAt: new Date().toISOString(), sessions: [] };
    update((st) => ({ ...st, programs: [...st.programs, p] }));
    go({ name: "training", programId: p.id });
  }
  if (!program) {
    return (
      <>
        <h1>{t.title}</h1>
        <form className="card row" onSubmit={create}>
          <input name="title" aria-label={t.programTitle} placeholder={t.programTitle} maxLength={160} required style={{ flex: 1, minWidth: "12rem" }} />
          <button className="btn primary" type="submit">{t.newProgram}</button>
        </form>
        <div className="card">
          {s.programs.length === 0 ? <p className="muted">{t.empty}</p> : (
            <ul className="list">{s.programs.map((p) => (
              <li key={p.id} className="row between"><button className="btn link" onClick={() => go({ name: "training", programId: p.id })}>{p.title}</button><span className="muted small">{p.sessions.length}</span></li>
            ))}</ul>
          )}
        </div>
      </>
    );
  }
  const savep = (next: Program) => update((st) => ({ ...st, programs: replaceById(st.programs, next) }));
  return (
    <>
      <button className="btn link no-print" onClick={() => go({ name: "training" })}>← {L.common.back}</button>
      <div className="row between">
        <input aria-label={t.programTitle} value={program.title} maxLength={160} onChange={(e) => savep({ ...program, title: e.target.value })} style={{ fontSize: "1.3rem", fontWeight: 700, maxWidth: "26rem" }} />
        <span className="row no-print">
          <button className="btn primary" onClick={() => savep({ ...program, sessions: [...program.sessions, { id: newId(), title: `${t.newSession} ${program.sessions.length + 1}`, items: [] }] })}>{t.newSession}</button>
          <button className="btn danger" onClick={async () => { if (await ask(t.deleteProgram)) { update((st) => ({ ...st, programs: removeById(st.programs, program.id) })); go({ name: "training" }); } }}>{L.common.delete}</button>
        </span>
      </div>
      {program.sessions.map((sess) => <SessionCard key={sess.id} program={program} session={sess} />)}
    </>
  );
}

// ---- assistant -------------------------------------------------------------------------------------------------

export function Assistant() {
  const { s, d, lang, today } = useApp();
  const a = d.assistant;
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView?.({ block: "end" }); }, [msgs]);
  function send(q: string) {
    const text = q.trim().slice(0, 3000);
    if (!text) return;
    const intent = detectIntent(text, true);
    const reply = intent ? personalAnswer(intent, true, personalDataFrom(s, today), lang) : answer(text, "personal_trainer", lang).text;
    setMsgs((m) => [...m, { role: "user", text }, { role: "assistant", text: reply }]);
    setDraft("");
  }
  return (
    <>
      <h1>{a.title}</h1>
      <div className="card">
        <p>{a.intro}</p>
        <p className="muted small">{a.privacy}</p>
        {msgs.length === 0 && <div className="row">{a.starters.personal_trainer.map((q) => <button key={q} className="btn" onClick={() => send(q)}>{q}</button>)}</div>}
        <div className="chat" data-testid="assistant-log" aria-live="polite">
          {msgs.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.role === "assistant" ? <Rich text={m.text} /> : m.text}</div>)}
          <div ref={end} />
        </div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); send(draft); }} style={{ marginTop: ".6rem" }}>
          <input aria-label={a.placeholder} placeholder={a.placeholder} value={draft} maxLength={3000} onChange={(e) => setDraft(e.target.value)} style={{ flex: 1, minWidth: "12rem" }} />
          <button className="btn primary" type="submit">{a.send}</button>
          {msgs.length > 0 && <button type="button" className="btn" onClick={() => setMsgs([])}>{a.clear}</button>}
        </form>
      </div>
    </>
  );
}

// ---- settings --------------------------------------------------------------------------------------------------

export function Settings() {
  const { s, update, L, d } = useApp();
  const t = L.settings;
  const [msg, setMsg] = useState("");
  function backup() {
    download(`performance360-lite-backup-${todayIso()}.json`, exportJson(s), "application/json");
    update((st) => ({ ...st, lastExportAt: new Date().toISOString() }));
  }
  async function restore(file: File | undefined) {
    if (!file) return;
    const r = parseImport(await file.text());
    if (!r.ok) { setMsg(t.importErr[r.error]); return; }
    if (!(await ask(t.importWarn))) return;
    update(() => ({ ...r.state, lang: s.lang, theme: s.theme }));
    setMsg(fill(t.importOk, { a: r.counts.athletes, p: r.counts.programs }));
  }
  const nameOf = (id: string) => s.athletes.find((a) => a.id === id)?.name ?? "";
  const csv: [string, () => string[][]][] = [
    [t.csvAthletes, () => [["name", "sport", "position", "notes"], ...s.athletes.map((a) => [a.name, a.sport, a.position, a.notes])]],
    [t.csvCheckIns, () => [["athlete", "date", "sleep_hours", "sleep_quality", "fatigue", "soreness", "stress", "mood", "motivation", "pain", "pain_note"],
      ...s.checkIns.map((c) => [nameOf(c.athleteId), c.date, c.sleepHours, c.sleepQuality, c.fatigue, c.soreness, c.stress, c.mood, c.motivation, c.pain ? "yes" : "no", c.painNote].map(String))]],
    [t.csvTests, () => [["athlete", "date", "test", "value", "unit"], ...s.tests.map((x) => [nameOf(x.athleteId), x.date, x.name, String(x.value), x.unit])]],
    [t.csvInjuries, () => [["athlete", "area", "injury_date", "stage", "status", "expected_return"], ...s.injuries.map((i) => [nameOf(i.athleteId), i.area, i.injuryDate, i.stage, i.status, i.expectedReturn ?? ""])]],
    [t.csvLoad, () => [["athlete", "date", "load"], ...s.loads.map((l) => [nameOf(l.athleteId), l.date, String(l.load)])]],
  ];
  return (
    <>
      <h1>{t.title}</h1>
      <div className="card form">
        <label className="f">{t.language}<select aria-label={t.language} value={s.lang} onChange={(e) => update((st) => ({ ...st, lang: e.target.value === "he" ? "he" : "en" }))}><option value="en">English</option><option value="he">עברית</option></select></label>
        {!ARTIFACT && <label className="f">{t.theme}<select aria-label={t.theme} value={s.theme} onChange={(e) => update((st) => ({ ...st, theme: e.target.value as Theme }))}>{(["auto", "light", "dark"] as const).map((k) => <option key={k} value={k}>{t.themes[k]}</option>)}</select></label>}
      </div>
      <div className="card">
        <h2>{t.backup}</h2>
        <p className="muted small">{t.storageIn[storageKind()]}</p>
        <div className="row">
          <button className="btn primary" onClick={backup}>{t.exportJson}</button>
          <label className="btn">{t.importJson}<input className="sr" type="file" accept=".json,application/json" aria-label={t.importJson} onChange={(e) => { void restore(e.target.files?.[0]); e.target.value = ""; }} /></label>
        </div>
        {msg && <p role="status">{msg}</p>}
        <h3 style={{ marginTop: ".8rem" }}>{t.csv}</h3>
        <div className="row">{csv.map(([label, rows]) => (
          <button key={label} className="btn" onClick={() => download(`performance360-${label.toLowerCase().replace(/\s+/g, "-")}.csv`, "﻿" + rows().map((r) => r.map(csvCell).join(",")).join("\r\n"), "text/csv")}>{label}</button>
        ))}</div>
      </div>
      <div className="card">
        <h2>{t.about}</h2>
        <p>{t.aboutBody}</p>
        <p className="muted small">{d.injury.disclaimer}</p>
        <button className="btn danger" onClick={async () => { if (await ask(t.dangerWarn)) update(() => emptyState(s.lang)); }}>{t.danger}</button>
      </div>
    </>
  );
}

