import { useState, type FormEvent } from "react";
import { ConfirmButton, ErrorBox, Field, Loading, useAction } from "../../components/ui";
import { displayName, loadClub } from "../../lib/data";
import { useI18n } from "../../lib/i18n";
import { useSession } from "../../lib/session";
import { must, supabase } from "../../lib/supabase";
import { useAsync } from "../../lib/useAsync";

export function Squads() {
  const { t } = useI18n();
  const { club, role } = useSession();
  const act = useAction();
  const isDirector = role === "director";
  const [adding, setAdding] = useState(false);
  const q = useAsync(() => loadClub(club!.id), [club?.id]);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data) return null;
  const d = q.data;
  const staff = d.members.filter((m) => m.role !== "athlete");

  return (
    <>
      <div className="spread">
        <h1>{t.squads}</h1>
        {isDirector && !adding && <button className="btn" onClick={() => setAdding(true)}>+ {t.newSquad}</button>}
      </div>

      {adding && <NewSquad onCancel={() => setAdding(false)} onSave={async (v) => {
        const ok = await act(async () => { must(await supabase.from("squads").insert({ ...v, club_id: club!.id })); }, t.squadAdded);
        if (ok) { setAdding(false); q.reload(); }
      }} />}

      {d.squads.length === 0 ? <p className="empty">{t.noSquads}</p> : (
        <div className="grid2">
          {d.squads.map((s) => {
            const coaches = d.squadStaff.filter((x) => x.squad_id === s.id);
            const free = staff.filter((m) => !coaches.some((c) => c.user_id === m.user_id));
            const count = d.players.filter((p) => p.squad_id === s.id).length;
            return (
              <section key={s.id} className="panel">
                <div className="panel-head">
                  <div>
                    <h2>{s.name}</h2>
                    <p className="sub">{[s.age_group, s.season].filter(Boolean).join(" · ") || " "}</p>
                  </div>
                  <span className="tag">{count} {t.players}</span>
                </div>
                <div>
                  <span className="lbl">{t.coaches}</span>
                  {coaches.length === 0 ? <p className="empty">{t.noCoaches}</p> : (
                    <div className="list">
                      {coaches.map((c) => (
                        <div key={c.user_id} className="li">
                          <span>{displayName(d.profiles.get(c.user_id))}</span>
                          {isDirector && <ConfirmButton label={t.remove} confirmLabel={t.confirmRemove} onConfirm={() => act(async () => {
                            must(await supabase.from("squad_staff").delete().eq("squad_id", s.id).eq("user_id", c.user_id));
                            q.reload();
                          })} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {isDirector && free.length > 0 && (
                  <select value="" aria-label={t.addCoach} onChange={(e) => {
                    const uid = e.target.value;
                    if (uid) act(async () => { must(await supabase.from("squad_staff").insert({ squad_id: s.id, user_id: uid })); q.reload(); });
                  }}>
                    <option value="">+ {t.addCoach}</option>
                    {free.map((m) => <option key={m.user_id} value={m.user_id}>{displayName(d.profiles.get(m.user_id))} · {t.role[m.role]}</option>)}
                  </select>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function NewSquad({ onSave, onCancel }: { onSave: (v: { name: string; age_group: string | null; season: string | null }) => Promise<void>; onCancel: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [season, setSeason] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSave({ name: name.trim(), age_group: age.trim() || null, season: season.trim() || null });
    setBusy(false);
  }
  return (
    <form className="panel" onSubmit={submit}>
      <h2>{t.newSquad}</h2>
      <div className="form">
        <Field label={t.squadName}><input type="text" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label={t.ageGroup}><input type="text" placeholder="U17" value={age} onChange={(e) => setAge(e.target.value)} /></Field>
        <Field label={t.season}><input type="text" placeholder="2026/27" value={season} onChange={(e) => setSeason(e.target.value)} /></Field>
      </div>
      <div className="row">
        <button className="btn" disabled={busy || !name.trim()}>{t.save}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>{t.cancel}</button>
      </div>
    </form>
  );
}
