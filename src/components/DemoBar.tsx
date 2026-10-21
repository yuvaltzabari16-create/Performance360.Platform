import { useState } from "react";
import { useI18n } from "../lib/i18n";
import { navigate } from "../lib/router";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";

declare global {
  interface Window { __p360demo?: { reset: () => void } }
}

/** Demo-only floating control: switch between the three demo accounts, or restore the sample data. */
export function DemoBar() {
  const { t } = useI18n();
  const { userId } = useSession();
  const current = userId === "u-coach" ? "coach" : userId === "u-ath" ? "ath" : "dir";
  const [open, setOpen] = useState(() => window.innerWidth > 820);
  if (!open) {
    return (
      <div className="demobar closed">
        <button className="btn sm ghost" aria-expanded={false} onClick={() => setOpen(true)}>{t.demoLabel} · {t.demoViewAs} ▾</button>
      </div>
    );
  }
  return (
    <div className="demobar" role="region" aria-label={t.demoLabel}>
      <button className="btn icon" aria-label={t.close} aria-expanded={true} onClick={() => setOpen(false)}>✕</button>
      <span className="lbl">{t.demoLabel}</span>
      <label className="row" style={{ gap: 4 }}>
        <span className="muted" style={{ fontSize: 12 }}>{t.demoViewAs}</span>
        <select id="demo-role" value={current} onChange={async (e) => {
          await supabase.auth.signInWithPassword({ email: `${e.target.value}@demo`, password: "demo" });
          navigate("/");
        }}>
          <option value="dir">{t.role.director} · Yuval</option>
          <option value="coach">{t.role.coach} · Maya</option>
          <option value="ath">{t.role.athlete} · Noam</option>
        </select>
      </label>
      <button className="btn sm ghost" title={t.demoNote} onClick={() => window.__p360demo?.reset()}>{t.demoReset}</button>
    </div>
  );
}
