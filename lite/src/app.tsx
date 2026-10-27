import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppCtx, type Screen } from "./ctx";
import { todayIso, type LiteState } from "./model";
import { Athletes, AthleteDetail, Overview } from "./screens-core";
import { Assistant, LibraryScreen, Settings, Training } from "./screens-more";
import { loadState, requestPersistence, saveState, storageKind } from "./storage";
import { fill, LITE, MAIN } from "./strings";
import { daysSince } from "./util";

const NAV: Screen["name"][] = ["overview", "athletes", "training", "library", "assistant", "settings"];
const WELCOME_KEY = "performance360-lite-welcome";

export function App() {
  const [state, setState] = useState<LiteState | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "overview" });
  const [welcome, setWelcome] = useState(false);
  const [saved, setSaved] = useState(true);
  const first = useRef(true);

  useEffect(() => {
    const guess = typeof navigator !== "undefined" && /^he/i.test(navigator.language) ? "he" : "en";
    loadState(guess).then((s) => {
      setState(s);
      try { setWelcome(!localStorage.getItem(WELCOME_KEY) && s.athletes.length === 0 && s.programs.length === 0); } catch { setWelcome(true); }
    });
    void requestPersistence();
  }, []);

  // Save at most every 300 ms while someone keeps editing, and right away when the page is hidden or closed.
  const latest = useRef<LiteState | null>(null);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!state) return;
    latest.current = state;
    if (first.current) { first.current = false; return; }
    dirty.current = true;
    if (timer.current === undefined) {
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        if (latest.current && dirty.current) { dirty.current = false; saveState(latest.current).then(setSaved); }
      }, 300);
    }
  }, [state]);
  useEffect(() => {
    const flush = () => {
      if (timer.current !== undefined) { clearTimeout(timer.current); timer.current = undefined; }
      if (latest.current && dirty.current) { dirty.current = false; void saveState(latest.current); }
    };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => { window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", onHide); };
  }, []);

  const update = useCallback((fn: (s: LiteState) => LiteState) => setState((s) => (s ? fn(s) : s)), []);
  const lang = state?.lang ?? "en";
  useEffect(() => {
    const r = document.documentElement;
    r.lang = lang;
    r.dir = lang === "he" ? "rtl" : "ltr";
    if (state?.theme === "light" || state?.theme === "dark") r.dataset.theme = state.theme; else delete r.dataset.theme;
    document.title = LITE[lang].title;
  }, [lang, state?.theme]);

  const ctx = useMemo(() => (state ? { s: state, update, lang, L: LITE[lang], d: MAIN[lang], today: todayIso(), go: setScreen } : null), [state, update, lang]);
  if (!state || !ctx) return <p style={{ padding: "1rem" }}>…</p>;
  const { L } = ctx;
  const hasData = state.athletes.length + state.programs.length > 0;
  const backupAge = state.lastExportAt ? daysSince(state.lastExportAt) : null;

  if (welcome) {
    return (
      <AppCtx.Provider value={ctx}>
        <div className="main" style={{ margin: "0 auto" }}>
          <div className="card">
            <h1>{L.welcome.title}</h1>
            <p>{L.welcome.body}</p>
            <ul>{L.welcome.points.map((p) => <li key={p}>{p}</li>)}</ul>
            <div className="row">
              <button className="btn primary" onClick={() => { try { localStorage.setItem(WELCOME_KEY, "1"); } catch { /* ignore */ } setWelcome(false); }}>{L.welcome.start}</button>
              <select aria-label={L.settings.language} value={state.lang} onChange={(e) => update((s) => ({ ...s, lang: e.target.value === "he" ? "he" : "en" }))} style={{ width: "auto" }}>
                <option value="en">English</option><option value="he">עברית</option>
              </select>
            </div>
          </div>
        </div>
      </AppCtx.Provider>
    );
  }

  return (
    <AppCtx.Provider value={ctx}>
      <div className="shell">
        <aside className="side no-print">
          <div className="brand"><i aria-hidden="true" />{L.title}</div>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => <button key={n} aria-current={screen.name === n ? "page" : undefined} onClick={() => setScreen({ name: n })}>{L.nav[n]}</button>)}
          </nav>
          <p className="muted small">{L.tagline}</p>
        </aside>
        <main className="main">
          {(storageKind() === "memory" || !saved) && <div className="banner" role="alert">{L.storage.memory}</div>}
          {hasData && (backupAge === null ? <div className="banner">{L.storage.neverBacked}</div> : backupAge >= 7 && <div className="banner">{fill(L.storage.backupDue, { when: state.lastExportAt?.slice(0, 10) ?? "" })}</div>)}
          {screen.name === "overview" && <Overview />}
          {screen.name === "athletes" && (screen.athleteId ? <AthleteDetail id={screen.athleteId} /> : <Athletes />)}
          {screen.name === "training" && <Training programId={screen.programId} />}
          {screen.name === "library" && <LibraryScreen />}
          {screen.name === "assistant" && <Assistant />}
          {screen.name === "settings" && <Settings />}
        </main>
      </div>
    </AppCtx.Provider>
  );
}

