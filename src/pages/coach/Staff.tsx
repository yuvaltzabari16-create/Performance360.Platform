import { useState } from "react";
import { Avatar, ConfirmButton, ErrorBox, Field, Loading, useAction } from "../../components/ui";
import { displayName, inviteUrl, loadClub, loadInvites } from "../../lib/data";
import { fmtDay } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { useSession } from "../../lib/session";
import { must, supabase } from "../../lib/supabase";
import { useAsync } from "../../lib/useAsync";
import { CopyLink } from "./PlayerProfile";

/** Director-only: club members, coach invites, club name. */
export function Staff() {
  const { t, lang } = useI18n();
  const { club, userId, refresh } = useSession();
  const act = useAction();
  const [squad, setSquad] = useState("");
  const [clubName, setClubName] = useState(club?.name ?? "");
  const q = useAsync(async () => {
    const [c, invites] = await Promise.all([loadClub(club!.id), loadInvites(club!.id)]);
    return { ...c, invites };
  }, [club?.id]);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data) return null;
  const d = q.data;
  const staff = d.members.filter((m) => m.role !== "athlete").sort((a, b) => a.role.localeCompare(b.role));
  const coachInvites = d.invites.filter((i) => i.role !== "athlete");
  const squadName = (id: string | null) => d.squads.find((s) => s.id === id)?.name;

  return (
    <>
      <h1>{t.staff}</h1>
      <div className="grid2">
        <section className="panel">
          <h2>{t.members}</h2>
          <div className="list">
            {staff.map((m) => (
              <div key={m.user_id} className="li">
                <span className="who"><Avatar name={d.profiles.get(m.user_id)?.full_name} />
                  <span><span className="nm">{displayName(d.profiles.get(m.user_id))}{m.user_id === userId && ` (${t.you})`}</span><br />
                    <span className="mt">{t.role[m.role]}</span></span>
                </span>
                {m.user_id !== userId && m.role !== "director" && <ConfirmButton label={t.remove} confirmLabel={t.confirmRemove} onConfirm={() => act(async () => {
                  must(await supabase.from("club_members").delete().eq("club_id", club!.id).eq("user_id", m.user_id));
                  q.reload();
                })} />}
              </div>
            ))}
          </div>
        </section>

        <div className="stack">
          <section className="panel">
            <h2>{t.inviteStaff}</h2>
            <p className="sub" style={{ margin: 0 }}>{t.inviteStaffSub}</p>
            <div className="form">
              <Field label={t.optionalSquad}>
                <select value={squad} onChange={(e) => setSquad(e.target.value)}>
                  <option value="">{t.none}</option>
                  {d.squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <button className="btn" onClick={() => act(async () => {
                must(await supabase.from("invites").insert({ club_id: club!.id, role: "coach", squad_id: squad || null }));
                q.reload();
              })}>{t.createInvite}</button>
            </div>
            <span className="lbl">{t.openInvites}</span>
            {coachInvites.length === 0 ? <p className="empty">{t.noOpenInvites}</p> : coachInvites.map((i) => (
              <div key={i.id} className="note">
                <div className="spread" style={{ fontSize: 12 }}>
                  <span className="muted">{t.role[i.role]}{squadName(i.squad_id) ? ` · ${squadName(i.squad_id)}` : ""} · {t.expires} {fmtDay(i.expires_at.slice(0, 10), lang)}</span>
                  <button className="btn sm danger" onClick={() => act(async () => {
                    must(await supabase.from("invites").update({ revoked_at: new Date().toISOString() }).eq("id", i.id));
                    q.reload();
                  }, t.revoked)}>{t.revoke}</button>
                </div>
                <CopyLink url={inviteUrl(i.token)} />
              </div>
            ))}
          </section>

          <section className="panel">
            <h2>{t.clubSettings}</h2>
            <div className="form">
              <Field label={t.clubName}><input type="text" value={clubName} minLength={2} maxLength={120} onChange={(e) => setClubName(e.target.value)} /></Field>
              <button className="btn ghost" disabled={clubName.trim().length < 2 || clubName.trim() === club?.name} onClick={() => act(async () => {
                must(await supabase.from("clubs").update({ name: clubName.trim() }).eq("id", club!.id));
                await refresh();
              }, t.saved)}>{t.rename}</button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
