import { LogoMark } from "./logo";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  checkPasscode, clearLock, createLockRecord, lockSupported, passcodeProblem, readLock, waitSeconds, writeLock, type LockRecord,
} from "./lock";
import { guessLang, ask } from "./platform";
import { wipeStorage } from "./storage";
import { fill, LITE } from "./strings";

const IDLE_MS = 10 * 60_000;
type Mode = "create" | "locked" | "open";

/** Passcode screen in front of the app: first visit creates a passcode, later visits ask for it. */
export function LockGate({ children }: { children: ReactNode }) {
  const lang = (() => { try { return localStorage.getItem("performance360-lite-lang") === "he" ? "he" : guessLang(); } catch { return guessLang(); } })();
  const L = LITE[lang].lock;
  const supported = lockSupported();
  const [record, setRecord] = useState<LockRecord | null>(() => readLock());
  const [mode, setMode] = useState<Mode>(() => (!supported ? "open" : readLock() ? "locked" : "create"));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const failures = useRef(0);
  const blockedUntil = useRef(0);

  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === "he" ? "rtl" : "ltr"; }, [lang]);

  const lockNow = useCallback(() => { if (readLock()) setMode("locked"); }, []);
  useEffect(() => {
    if (mode !== "open") return;
    let t = window.setTimeout(lockNow, IDLE_MS);
    const reset = () => { clearTimeout(t); t = window.setTimeout(lockNow, IDLE_MS); };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    for (const e of events) window.addEventListener(e, reset, { passive: true });
    window.addEventListener("performance360-lock", lockNow);
    return () => { clearTimeout(t); for (const e of events) window.removeEventListener(e, reset); window.removeEventListener("performance360-lock", lockNow); };
  }, [mode, lockNow]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pass = String(f.get("pass") ?? "");
    if (passcodeProblem(pass)) return setError(L.short);
    if (pass !== String(f.get("confirm") ?? "")) return setError(L.mismatch);
    setBusy(true);
    const rec = await createLockRecord(pass);
    setBusy(false);
    if (!writeLock(rec)) return setError(L.noCrypto);
    setRecord(rec); setError(""); setMode("open");
  }

  async function unlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const wait = Math.ceil((blockedUntil.current - Date.now()) / 1000);
    if (wait > 0) return setError(fill(L.wait, { s: wait }));
    const pass = String(new FormData(e.currentTarget).get("pass") ?? "");
    setBusy(true);
    const ok = record ? await checkPasscode(record, pass) : false;
    setBusy(false);
    if (ok) { failures.current = 0; setError(""); setMode("open"); return; }
    failures.current += 1;
    const w = waitSeconds(failures.current);
    if (w > 0) blockedUntil.current = Date.now() + w * 1000;
    setError(w > 0 ? fill(L.wait, { s: w }) : L.wrong);
  }

  async function forgot() {
    if (!(await ask(L.forgotWarn))) return;
    await wipeStorage();
    clearLock();
    setRecord(null); failures.current = 0; blockedUntil.current = 0; setError(""); setMode("create");
  }

  if (mode === "open") return <>{children}</>;
  return (
    <div className="main" style={{ margin: "0 auto", maxWidth: 440 }}>
      <div className="card">
        <div className="brand"><LogoMark />Performance360</div>
        {mode === "create" ? (
          <form className="form" onSubmit={create}>
            <h1>{L.createTitle}</h1>
            <p>{L.createBody}</p>
            <label className="f">{L.pass}<input name="pass" type="password" autoComplete="new-password" minLength={8} required autoFocus /></label>
            <label className="f">{L.confirm}<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
            {error && <p role="alert" className="pill bad">{error}</p>}
            <div className="row"><button className="btn primary" type="submit" disabled={busy}>{L.create}</button></div>
            <p className="muted small">{L.note}</p>
          </form>
        ) : (
          <form className="form" onSubmit={unlock}>
            <h1>{L.unlockTitle}</h1>
            <label className="f">{L.pass.replace(/ \(.*\)$/, "")}<input name="pass" type="password" autoComplete="current-password" required autoFocus /></label>
            {error && <p role="alert" className="pill bad">{error}</p>}
            <div className="row"><button className="btn primary" type="submit" disabled={busy}>{L.unlock}</button><button type="button" className="btn link" onClick={() => { void forgot(); }}>{L.forgot}</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
