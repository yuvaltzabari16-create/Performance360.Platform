import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppCtx, type Screen } from "./ctx";
import { connectCloud, demoState, type Cloud, type CloudStatus } from "./cloud";
import { emptyState, todayIso, type Lang, type LiteState, type Theme } from "./model";
import { claudeNs, guessLang, registerAsker } from "./platform";
import { CheckIns } from "./screens-core";
import { Shell } from "./shell";
import { litefor, MAIN } from "./strings";
import { fill } from "./strings";

type Role = "loading" | "demo" | "staff" | "athlete" | "anonymous";
interface UserNs { isOwner(): Promise<boolean>; canEdit(): Promise<boolean>; id(): Promise<string | null> }
type DbArg = Parameters<typeof connectCloud>[0]["db"];

const PREFS = "performance360-shared-prefs";
function loadPrefs(): { lang: Lang; theme: Theme } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) ?? "{}") as { lang?: string };
    return { lang: p.lang === "he" ? "he" : p.lang === "en" ? "en" : guessLang(), theme: "auto" };
  } catch { return { lang: guessLang(), theme: "auto" }; }
}

/** Yes/no dialog shown inside the page (the viewer blocks the browser's own confirm). */
function useAsker() {
  const [q, setQ] = useState<{ text: string; done: (v: boolean) => void } | null>(null);
  useEffect(() => {
    registerAsker((text) => new Promise<boolean>((resolve) => setQ({ text, done: (v) => { setQ(null); resolve(v); } })));
    return () => registerAsker(null);
  }, []);
  return q;
}

export function ArtifactApp() {
  const [role, setRole] = useState<Role>("loading");
  const [state, setState] = useState<LiteState>(() => emptyState(loadPrefs().lang));
  const [status, setStatus] = useState<CloudStatus>("connecting");
  const [screen, setScreen] = useState<Screen>({ name: "overview" });
  const cloud = useRef<Cloud | null>(null);
  const current = useRef(state);
  const prefs = useRef(loadPrefs());
  const asking = useAsker();

  // Decide who is looking and connect to the shared store.
  useEffect(() => {
    let off: (() => void) | undefined;
    let gone = false;
    void (async () => {
      const ns = claudeNs();
      const [db, user] = await Promise.all([ns?.use("db").catch(() => null) ?? null, ns?.use("user").catch(() => null) ?? null]) as [DbArg | null, UserNs | null];
      if (gone) return;
      if (!db) { const s = demoState(prefs.current.lang); current.current = s; setState(s); setRole("demo"); return; }
      const [canEdit, userId] = await Promise.all([user?.canEdit() ?? Promise.resolve(false), user?.id() ?? Promise.resolve(null)]);
      if (gone) return;
      const mode = canEdit ? "staff" : "athlete";
      if (mode === "athlete" && !userId) { setRole("anonymous"); return; }
      const c = connectCloud({
        db, mode, userId, prefs: () => prefs.current,
        onState: (s) => { current.current = s; setState(s); },
        onStatus: setStatus,
      });
      cloud.current = c;
      off = () => c.dispose();
      setRole(mode);
    })();
    return () => { gone = true; off?.(); };
  }, []);

  const update = useCallback((fn: (s: LiteState) => LiteState) => {
    const next = fn(current.current);
    // Language and theme are per person: kept in this browser, never written to the shared store.
    if (next.lang !== current.current.lang || next.theme !== current.current.theme) {
      prefs.current = { lang: next.lang, theme: next.theme };
      try { localStorage.setItem(PREFS, JSON.stringify({ lang: next.lang })); } catch { /* the choice just isn't remembered */ }
    }
    current.current = next;
    setState(next);
    cloud.current?.push(next);
  }, []);

  useEffect(() => {
    const flush = () => { if (document.visibilityState === "hidden") cloud.current?.flushNow(); };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", () => cloud.current?.flushNow());
    return () => document.removeEventListener("visibilitychange", flush);
  }, []);

  const lang = state.lang;
  useEffect(() => {
    const r = document.documentElement;
    r.lang = lang;
    r.dir = lang === "he" ? "rtl" : "ltr";
  }, [lang]);

  const L = litefor(lang);
  const ctx = useMemo(() => ({ s: state, update, lang, L, d: MAIN[lang], today: todayIso(), go: setScreen }), [state, update, lang, L]);
  const c = L.cloud;

  const statusLine = role === "staff" || role === "athlete"
    ? <div className="banner" role="status" style={status === "error" || status === "revoked" ? undefined : { background: "transparent", color: "var(--muted)", padding: 0 }}>
        {status === "connecting" ? c.connecting : status === "saving" ? c.saving : status === "error" ? c.saveError : status === "revoked" ? c.revoked : c.saved}
      </div>
    : null;

  if (role === "loading") return <p style={{ padding: "1rem" }}>{c.connecting}</p>;
  if (role === "anonymous") return <div className="main"><div className="card"><p>{c.noIdentity}</p></div></div>;

  if (role === "athlete") {
    const me = state.athletes[0];
    return (
      <AppCtx.Provider value={ctx}>
        <div className="main" style={{ margin: "0 auto" }}>
          <h1>{c.athleteTitle}</h1>
          {statusLine}
          {status === "connecting" ? null : !me ? (
            <div className="card"><h2>{c.waitTitle}</h2><p>{c.wait}</p></div>
          ) : (
            <>
              <p>{fill(c.athleteHello, { name: me.name })} <span className="muted small">{c.athletePrivacy}</span></p>
              <CheckIns athlete={me} />
            </>
          )}
        </div>
        {asking && <AskDialog q={asking} yes={c.yes} no={c.no} />}
      </AppCtx.Provider>
    );
  }

  const banners = (
    <>
      {role === "demo" && <div className="banner" role="status">{c.demoBanner}</div>}
      {statusLine}
    </>
  );
  return (
    <>
      <Shell ctx={ctx} screen={screen} setScreen={setScreen} banners={banners} />
      {asking && <AppCtx.Provider value={ctx}><AskDialog q={asking} yes={c.yes} no={c.no} /></AppCtx.Provider>}
    </>
  );
}

function AskDialog({ q, yes, no }: { q: { text: string; done: (v: boolean) => void }; yes: string; no: string }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={q.text} className="ask-backdrop">
      <div className="card ask">
        <p>{q.text}</p>
        <div className="row"><button className="btn danger" autoFocus onClick={() => q.done(true)}>{yes}</button><button className="btn" onClick={() => q.done(false)}>{no}</button></div>
      </div>
    </div>
  );
}
