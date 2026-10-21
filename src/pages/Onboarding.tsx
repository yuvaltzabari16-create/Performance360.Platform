import { useState, type FormEvent } from "react";
import { LangToggle } from "../components/LangToggle";
import { Field, useAction } from "../components/ui";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/session";
import { must, supabase } from "../lib/supabase";

/** Signed in but not a member of any club yet. */
export function Onboarding() {
  const { t } = useI18n();
  const { profile, refresh, setClub, signOut } = useSession();
  const act = useAction();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await act(async () => {
      const id = must(await supabase.rpc("create_club", { p_name: name.trim() })) as string;
      setClub(id);
      await refresh();
    });
    setBusy(false);
  }

  return (
    <div className="auth">
      <div className="card">
        <div className="spread">
          <div className="brand">Performance<span>360</span></div>
          <LangToggle />
        </div>
        <h1>{t.welcome}{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}</h1>
        <div className="panel">
          <h2>{t.createClubT}</h2>
          <p className="sub" style={{ marginTop: 0 }}>{t.createClubSub}</p>
          <form onSubmit={create} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label={t.clubName}>
              <input type="text" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <button className="btn block" disabled={busy || name.trim().length < 2}>{t.createClub}</button>
          </form>
        </div>
        <div className="panel">
          <h3>{t.waitingInvite}</h3>
          <p className="sub" style={{ margin: 0 }}>{t.waitingInviteSub}</p>
        </div>
        <button className="link" style={{ alignSelf: "center" }} onClick={signOut}>{t.signOut}</button>
      </div>
    </div>
  );
}
