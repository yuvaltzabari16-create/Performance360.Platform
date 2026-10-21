import { useState, type FormEvent } from "react";
import { LangToggle } from "../components/LangToggle";
import { Logo } from "../components/Logo";
import { Field } from "../components/ui";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { DEMO } from "../lib/demo";
import { normalizeUsername, playerEmail } from "../lib/playerLogin";

type Tab = "player" | "staff";
const TAB_KEY = "p360.authTab";
const savedTab = (): Tab => { try { return localStorage.getItem(TAB_KEY) === "staff" ? "staff" : "player"; } catch { return "player"; } };

export function AuthPage({ notice }: { notice?: string }) {
  const { t, lang } = useI18n();
  const [tab, setTabState] = useState<Tab>(savedTab);
  const setTab = (x: Tab) => { setTabState(x); setErr(null); setInfo(null); try { localStorage.setItem(TAB_KEY, x); } catch { /* ignore */ } };
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submitPlayer(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: playerEmail(username), password: pin });
      if (error) throw new Error(/invalid|credentials/i.test(error.message) ? t.wrongPin : error.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setInfo(null);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim(), locale: lang },
            emailRedirectTo: window.location.origin + window.location.pathname + window.location.hash,
          },
        });
        if (error) throw error;
        // With email confirmation on, there is no session until the link is clicked.
        if (!data.session) { setInfo(t.checkEmail); setMode("in"); }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="card">
        <div className="spread">
          <Logo size={40} />
          <LangToggle />
        </div>
        <p className="sub" style={{ margin: 0 }}>{t.authTagline}</p>
        {notice && <div className="info">{notice}</div>}
        <div className="seg auth-tabs" role="tablist">
          {(["player", "staff"] as const).map((x) => (
            <button key={x} role="tab" aria-selected={tab === x} className={tab === x ? "on" : ""} onClick={() => setTab(x)}>
              {x === "player" ? t.playerTab : t.staffTab}
            </button>
          ))}
        </div>
        {tab === "player" ? (
          <div className="panel">
            <h2>{t.signIn}</h2>
            <p className="muted" style={{ margin: 0 }}>{t.playerSignInHint}</p>
            <form onSubmit={submitPlayer}>
              <Field label={t.username}>
                <input type="text" required dir="ltr" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  value={username} onChange={(e) => setUsername(e.target.value)} onBlur={() => setUsername(normalizeUsername(username))} />
              </Field>
              <Field label={`${t.pin} · ${t.pinHint}`}>
                <input type="password" required dir="ltr" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password"
                  className="pin-input" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              </Field>
              {err && <div className="err" role="alert">{err}</div>}
              <button className="btn block" disabled={busy || pin.length !== 6 || !username.trim()}>{t.signIn}</button>
            </form>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>{t.forgotPin}</p>
          </div>
        ) : (
        <div className="panel">
          <h2>{mode === "in" ? t.signIn : t.signUp}</h2>
          <form onSubmit={submit}>
            {mode === "up" && (
              <Field label={t.fullName}>
                <input type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            )}
            <Field label={t.email}>
              <input type="email" required autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label={mode === "up" ? `${t.password} · ${t.passwordHint}` : t.password}>
              <input type="password" required minLength={mode === "up" ? 8 : undefined} dir="ltr"
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {err && <div className="err" role="alert">{err}</div>}
            {info && <div className="info" role="status">{info}</div>}
            <button className="btn block" disabled={busy}>{mode === "in" ? t.signIn : t.signUp}</button>
          </form>
          <div className="row muted" style={{ fontSize: 13 }}>
            <span>{mode === "in" ? t.noAccount : t.haveAccount}</span>
            <button className="link" onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(null); }}>
              {mode === "in" ? t.signUp : t.signIn}
            </button>
          </div>
        </div>
        )}
        {DEMO && (
          <div className="info demo-logins">
            <b>{t.demoLogins}</b>
            <span>{t.demoPlayerLogin}: <bdi dir="ltr">noam.levi · 482915</bdi></span>
            <span className="muted" style={{ fontSize: 12 }}>{t.staffTab}: <bdi dir="ltr">coach@demo · demo</bdi></span>
          </div>
        )}
      </div>
    </div>
  );
}
