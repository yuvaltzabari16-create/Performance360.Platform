import { useMemo, useState, type FormEvent } from "react";
import { Avatar, ErrorBox, Field, Loading, ReadyPill, StatusPill, useAction } from "../../components/ui";
import { isLiveInvite, loadCheckins, loadClub, loadInvites } from "../../lib/data";
import { ageFrom, isoDate } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { navigate } from "../../lib/router";
import { useSession } from "../../lib/session";
import { must, supabase } from "../../lib/supabase";
import type { Position } from "../../lib/types";
import { useAsync } from "../../lib/useAsync";

export function Players() {
  const { t } = useI18n();
  const { club, role, userId } = useSession();
  const act = useAction();
  const today = isoDate();
  const [squad, setSquad] = useState("all");
  const [term, setTerm] = useState("");
  const [adding, setAdding] = useState(false);

  const q = useAsync(async () => {
    const [c, checkins, invites] = await Promise.all([loadClub(club!.id), loadCheckins(club!.id, today, today), loadInvites(club!.id)]);
    return { ...c, checkins, invites };
  }, [club?.id, today]);

  // Squads this user may add players to (directors: all; coaches: their own).
  const addable = useMemo(() => {
    if (!q.data) return [];
    if (role === "director") return q.data.squads;
    const mine = new Set(q.data.squadStaff.filter((s) => s.user_id === userId).map((s) => s.squad_id));
    return q.data.squads.filter((s) => mine.has(s.id));
  }, [q.data, role, userId]);

  const rows = useMemo(() => {
    if (!q.data) return [];
    const needle = term.trim().toLowerCase();
    const ready = new Map(q.data.checkins.map((c) => [c.player_id, c.readiness]));
    const invited = new Set(q.data.invites.filter(isLiveInvite).map((i) => i.player_id));
    return q.data.players
      .filter((p) => squad === "all" || (squad === "none" ? !p.squad_id : p.squad_id === squad))
      .filter((p) => !needle || p.full_name.toLowerCase().includes(needle))
      .map((p) => ({ p, ready: ready.get(p.id) ?? null, account: p.user_id ? "linked" : invited.has(p.id) ? "invited" : "none" }));
  }, [q.data, squad, term]);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data) return null;
  const squadName = (id: string | null) => q.data!.squads.find((s) => s.id === id)?.name ?? t.noSquad;
  const canAdd = role === "director" || addable.length > 0;

  return (
    <>
      <div className="spread">
        <div><h1>{t.players}</h1><p className="sub">{q.data.players.length} · {club?.name}</p></div>
        {canAdd && !adding && <button className="btn" onClick={() => setAdding(true)}>+ {t.addPlayer}</button>}
      </div>

      {adding && (
        <AddPlayer
          squads={addable}
          allowNoSquad={role === "director"}
          defaultSquad={squad !== "all" && squad !== "none" && addable.some((s) => s.id === squad) ? squad : addable[0]?.id ?? ""}
          onCancel={() => setAdding(false)}
          onSave={async (v) => {
            const ok = await act(async () => {
              const row = must(await supabase.from("players").insert({ ...v, club_id: club!.id }).select("id").single()) as { id: string };
              navigate(`/players/${row.id}`);
            }, t.playerAdded);
            if (ok) setAdding(false);
          }}
        />
      )}
      {role === "coach" && !canAdd && <p className="muted" style={{ margin: 0 }}>{t.coachSquadOnly}</p>}

      <section className="panel">
        <div className="row">
          <input type="search" placeholder={t.search} value={term} onChange={(e) => setTerm(e.target.value)} style={{ flex: "1 1 200px", width: "auto" }} />
          <select value={squad} onChange={(e) => setSquad(e.target.value)} style={{ width: "auto" }} aria-label={t.squad}>
            <option value="all">{t.allSquads}</option>
            {q.data.squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="none">{t.noSquad}</option>
          </select>
        </div>
        {rows.length === 0 ? <p className="empty">{t.noPlayers}</p> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr>
                <th>{t.name}</th><th>{t.number}</th><th>{t.position}</th><th className="hide-sm">{t.squad}</th>
                <th>{t.readiness}</th><th>{t.statusL}</th><th className="hide-sm">{t.account}</th>
              </tr></thead>
              <tbody>
                {rows.map(({ p, ready, account }) => (
                  <tr key={p.id} className="click" onClick={() => navigate(`/players/${p.id}`)}>
                    <td><span className="who"><Avatar name={p.full_name} />
                      <span><span className="nm">{p.full_name}</span>{p.date_of_birth && <><br /><span className="mt">{t.age} {ageFrom(p.date_of_birth)}</span></>}</span>
                    </span></td>
                    <td className="num">{p.shirt_number ?? t.none}</td>
                    <td>{p.position ? t.pos[p.position] : t.none}</td>
                    <td className="hide-sm muted">{squadName(p.squad_id)}</td>
                    <td><ReadyPill value={ready} /></td>
                    <td><StatusPill status={p.status} /></td>
                    <td className="hide-sm"><span className="tag">{account === "linked" ? t.linked : account === "invited" ? t.invited : t.notLinked}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

interface NewPlayer { full_name: string; squad_id: string | null; position: Position | null; shirt_number: number | null; date_of_birth: string | null }

function AddPlayer({ squads, allowNoSquad, defaultSquad, onSave, onCancel }: {
  squads: { id: string; name: string }[]; allowNoSquad: boolean; defaultSquad: string;
  onSave: (v: NewPlayer) => Promise<void>; onCancel: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [sq, setSq] = useState(defaultSquad);
  const [pos, setPos] = useState("");
  const [num, setNum] = useState("");
  const [dob, setDob] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSave({
      full_name: name.trim(),
      squad_id: sq || null,
      position: (pos || null) as Position | null,
      shirt_number: num === "" ? null : Number(num),
      date_of_birth: dob || null,
    });
    setBusy(false);
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>{t.addPlayer}</h2>
      <div className="form">
        <Field label={t.fullName}><input type="text" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label={t.squad}>
          <select value={sq} onChange={(e) => setSq(e.target.value)} required={!allowNoSquad}>
            {allowNoSquad && <option value="">{t.noSquad}</option>}
            {squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label={t.position}>
          <select value={pos} onChange={(e) => setPos(e.target.value)}>
            <option value="">{t.none}</option>
            {(["GK", "DF", "MF", "FW"] as const).map((p) => <option key={p} value={p}>{t.pos[p]}</option>)}
          </select>
        </Field>
        <Field label={t.number}><input type="number" min={0} max={999} value={num} onChange={(e) => setNum(e.target.value)} /></Field>
        <Field label={t.dob}><input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
      </div>
      <div className="row">
        <button className="btn" disabled={busy || !name.trim()}>{t.save}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>{t.cancel}</button>
      </div>
    </form>
  );
}
