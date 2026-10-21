import { useState } from "react";
import { LangToggle } from "../components/LangToggle";
import { ErrorBox, Loading, useAction } from "../components/ui";
import { useI18n } from "../lib/i18n";
import { navigate } from "../lib/router";
import { pendingInvite, useSession } from "../lib/session";
import { must, supabase } from "../lib/supabase";
import type { Role } from "../lib/types";
import { useAsync } from "../lib/useAsync";

interface Preview { club: string; role: Role; player: string | null; squad: string | null; valid: boolean }

/** Shown to signed-in users who opened #/invite/:token. */
export function InvitePage({ token }: { token: string }) {
  const { t } = useI18n();
  const { refresh, setClub } = useSession();
  const act = useAction();
  const [busy, setBusy] = useState(false);
  const q = useAsync(async () => must(await supabase.rpc("preview_invite", { p_token: token })) as Preview | null, [token]);

  async function accept() {
    setBusy(true);
    const ok = await act(async () => {
      const clubId = must(await supabase.rpc("accept_invite", { p_token: token })) as string;
      pendingInvite.clear();
      setClub(clubId);
      await refresh();
    }, t.joined);
    setBusy(false);
    if (ok) navigate("/");
  }

  return (
    <div className="auth">
      <div className="card">
        <div className="spread">
          <div className="brand">Performance<span>360</span></div>
          <LangToggle />
        </div>
        {q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : !q.data || !q.data.valid ? (
          <div className="panel">
            <p className="err" style={{ margin: 0 }}>{t.inviteInvalid}</p>
            <button className="btn ghost" onClick={() => { pendingInvite.clear(); navigate("/"); }}>{t.back}</button>
          </div>
        ) : (
          <div className="panel">
            <span className="lbl">{t.inviteT}</span>
            <h1>{q.data.club}</h1>
            <p className="sub" style={{ margin: 0 }}>
              {t.asRole} <b>{t.role[q.data.role]}</b>
              {q.data.squad ? ` · ${q.data.squad}` : ""}
            </p>
            {q.data.player && <p style={{ margin: 0 }}>{t.forPlayer}: <b>{q.data.player}</b></p>}
            <button className="btn block" disabled={busy} onClick={accept}>{t.accept}</button>
          </div>
        )}
      </div>
    </div>
  );
}
