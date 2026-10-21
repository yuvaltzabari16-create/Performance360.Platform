import { useState } from "react";
import { Field, useAction } from "../components/ui";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/session";
import { must, supabase } from "../lib/supabase";

export function Settings() {
  const { t, lang, setLang } = useI18n();
  const { profile, userId, session, clubs, club, memberships, setClub, refresh, signOut } = useSession();
  const act = useAction();
  const [name, setName] = useState(profile?.full_name ?? "");

  return (
    <>
      <h1>{t.settings}</h1>
      <div className="grid2">
        <section className="panel">
          <h2>{t.profile}</h2>
          <p className="muted" style={{ margin: 0 }} dir="ltr">{session?.user.email}</p>
          <div className="form">
            <Field label={t.fullName}><input type="text" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></Field>
            <button className="btn ghost" disabled={!name.trim() || name.trim() === profile?.full_name} onClick={() => act(async () => {
              must(await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", userId!));
              await refresh();
            }, t.saved)}>{t.save}</button>
          </div>
        </section>
        <section className="panel">
          <h2>{t.language}</h2>
          <div className="seg" role="group" aria-label={t.language}>
            {(["he", "en"] as const).map((l) => (
              <button key={l} aria-pressed={lang === l} onClick={() => {
                setLang(l);
                // Persist so the choice follows the user to other devices.
                if (userId) supabase.from("profiles").update({ locale: l }).eq("id", userId).then(() => {});
              }}>{l === "he" ? "עברית" : "English"}</button>
            ))}
          </div>
          {clubs.length > 1 && (
            <Field label={t.activeClub}>
              <select value={club?.id} onChange={(e) => setClub(e.target.value)}>
                {clubs.map((c) => <option key={c.id} value={c.id}>{c.name} · {t.role[memberships.find((m) => m.club_id === c.id)!.role]}</option>)}
              </select>
            </Field>
          )}
          <div><button className="btn danger" onClick={signOut}>{t.signOut}</button></div>
          <span className="muted" style={{ fontSize: 11 }}>Performance360 · v0.1</span>
        </section>
      </div>
    </>
  );
}
