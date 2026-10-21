import { useState, type FormEvent } from "react";
import { LangToggle } from "../components/LangToggle";
import { Logo } from "../components/Logo";
import { Field } from "../components/ui";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";

export function AuthPage({ notice }: { notice?: string }) {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
      </div>
    </div>
  );
}
