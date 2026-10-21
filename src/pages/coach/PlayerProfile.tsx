import { useEffect, useState, type FormEvent } from "react";
import { ReadinessChart } from "../../components/ReadinessChart";
import { Avatar, ConfirmButton, ErrorBox, Field, Loading, ReadyPill, StatusPill, useAction, useToast } from "../../components/ui";
import { LoadPanel, TestsPanel } from "../../components/PlayerPanels";
import { displayName, inviteUrl, isLiveInvite, loadCheckins, loadClub, loadNotes, loadResults, loadRpe, loadTestDefs } from "../../lib/data";
import { addDays, ageFrom, fmtDay, isoDate } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { navigate } from "../../lib/router";
import { useSession } from "../../lib/session";
import { must, supabase } from "../../lib/supabase";
import type { Foot, Invite, Player, PlayerStatus, Position } from "../../lib/types";
import { useAsync } from "../../lib/useAsync";

export function PlayerProfile({ id }: { id: string }) {
  const { t, lang } = useI18n();
  const { club, role, userId } = useSession();
  const act = useAction();
  const today = isoDate();
  const [editing, setEditing] = useState(false);

  const q = useAsync(async () => {
    const [c, checkins, notes, invites, rpe, defs, results] = await Promise.all([
      loadClub(club!.id),
      loadCheckins(club!.id, addDays(today, -27), today, id),
      loadNotes(id),
      supabase.from("invites").select("*").eq("player_id", id).order("created_at", { ascending: false }),
      loadRpe(club!.id, addDays(today, -27), today, id),
      loadTestDefs(),
      loadResults(club!.id, id),
    ]);
    const player = c.players.find((p) => p.id === id) ?? null;
    return {
      ...c, player, checkins, notes, invites: (must(invites) as Invite[]).filter(isLiveInvite),
      rpe, defs: defs.filter((d) => !d.club_id || d.club_id === club!.id), results,
    };
  }, [club?.id, id, today]);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data) return null;
  const { player } = q.data;
  if (!player) return <><a className="back" href="#/players">← {t.back}</a><p className="empty">{t.noPlayers}</p></>;

  const canEdit = role === "director" || (!!player.squad_id && q.data.squadStaff.some((s) => s.squad_id === player.squad_id && s.user_id === userId));
  const squad = q.data.squads.find((s) => s.id === player.squad_id);
  const values: Record<string, number> = Object.fromEntries(q.data.checkins.map((c) => [c.entry_date, c.readiness]));
  const latest = q.data.checkins[0];

  return (
    <>
      <a className="back" href="#/players">{lang === "he" ? "→" : "←"} {t.back}</a>
      <div className="spread">
        <div className="phead">
          <Avatar name={player.full_name} />
          <div>
            <h1>{player.full_name}</h1>
            <p className="sub">
              {[squad?.name ?? t.noSquad, player.position && t.pos[player.position], player.shirt_number != null && `#${player.shirt_number}`,
                player.date_of_birth && `${t.age} ${ageFrom(player.date_of_birth)}`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="row">
          <StatusPill status={player.status} />
          {latest?.entry_date === today && <ReadyPill value={latest.readiness} />}
        </div>
      </div>

      <div className="grid2">
        <div className="stack">
        <section className="panel">
          <h2>{t.readiness14}</h2>
          <ReadinessChart values={values} days={14} />
          <h3>{t.recentCheckins}</h3>
          {q.data.checkins.length === 0 ? <p className="empty">{t.noCheckins}</p> : (
            <div className="list">
              {q.data.checkins.slice(0, 7).map((c) => (
                <div key={c.id} className="li">
                  <span>
                    <b>{fmtDay(c.entry_date, lang, { weekday: "short", day: "numeric", month: "short" })}</b>
                    <span className="muted"> · {t.sleepHours} {c.sleep_hours ?? t.none}</span>
                    {c.pain && <span className="pill bad" style={{ marginInlineStart: 6 }}>{t.pain}{c.pain_area ? `: ${c.pain_area}` : ""}</span>}
                    {c.notes && <><br /><span className="muted" style={{ whiteSpace: "normal" }}>“{c.notes}”</span></>}
                  </span>
                  <ReadyPill value={c.readiness} />
                </div>
              ))}
            </div>
          )}
        </section>
        <LoadPanel rpe={q.data.rpe} />
        <TestsPanel defs={q.data.defs} results={q.data.results} />
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>{t.details}</h2>
              {canEdit && !editing && <button className="btn sm ghost" onClick={() => setEditing(true)}>{t.edit}</button>}
            </div>
            {editing ? (
              <EditPlayer
                player={player}
                squads={role === "director" ? q.data.squads : q.data.squads.filter((s) => q.data!.squadStaff.some((x) => x.squad_id === s.id && x.user_id === userId))}
                allowNoSquad={role === "director"}
                onCancel={() => setEditing(false)}
                onSave={async (patch) => {
                  const ok = await act(async () => { must(await supabase.from("players").update(patch).eq("id", player.id)); }, t.saved);
                  if (ok) { setEditing(false); q.reload(); }
                }}
              />
            ) : (
              <dl className="form" style={{ margin: 0 }}>
                {[
                  [t.dob, player.date_of_birth ? fmtDay(player.date_of_birth, lang, { day: "numeric", month: "short", year: "numeric" }) : null],
                  [t.dominantFoot, player.dominant_foot && t.foot[player.dominant_foot]],
                  [t.heightCm, player.height_cm],
                  [t.weightKg, player.weight_kg],
                ].map(([k, v]) => (
                  <div key={String(k)} className="field"><dt className="lbl">{k}</dt><dd style={{ margin: 0 }}>{v ?? t.none}</dd></div>
                ))}
                {player.notes && <div className="field" style={{ gridColumn: "1/-1" }}><dt className="lbl">{t.notesL}</dt><dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>{player.notes}</dd></div>}
              </dl>
            )}
            {role === "director" && !editing && (
              <div>
                <ConfirmButton label={t.archive} confirmLabel={t.confirmArchive} onConfirm={async () => {
                  const ok = await act(async () => { must(await supabase.from("players").update({ archived_at: new Date().toISOString() }).eq("id", player.id)); }, t.archived);
                  if (ok) navigate("/players");
                }} />
              </div>
            )}
          </section>

          <AthleteAccess player={player} invites={q.data.invites} canInvite={canEdit} onChange={q.reload} />

          <Notes
            playerId={player.id}
            notes={q.data.notes}
            authorName={(uid) => displayName(q.data!.profiles.get(uid))}
            me={userId!}
            onChange={q.reload}
          />
        </div>
      </div>
    </>
  );
}

function EditPlayer({ player, squads, allowNoSquad, onSave, onCancel }: {
  player: Player; squads: { id: string; name: string }[]; allowNoSquad: boolean;
  onSave: (patch: Partial<Player>) => Promise<void>; onCancel: () => void;
}) {
  const { t } = useI18n();
  const [f, setF] = useState({
    full_name: player.full_name,
    squad_id: player.squad_id ?? "",
    position: player.position ?? "",
    shirt_number: player.shirt_number?.toString() ?? "",
    date_of_birth: player.date_of_birth ?? "",
    dominant_foot: player.dominant_foot ?? "",
    height_cm: player.height_cm?.toString() ?? "",
    weight_kg: player.weight_kg?.toString() ?? "",
    status: player.status,
    notes: player.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const num = (s: string) => (s === "" ? null : Number(s));
  // Keep the current squad selectable even if this coach doesn't own it any more.
  const squadOpts = player.squad_id && !squads.some((s) => s.id === player.squad_id) ? [...squads, { id: player.squad_id, name: "…" }] : squads;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSave({
      full_name: f.full_name.trim(),
      squad_id: f.squad_id || null,
      position: (f.position || null) as Position | null,
      shirt_number: num(f.shirt_number),
      date_of_birth: f.date_of_birth || null,
      dominant_foot: (f.dominant_foot || null) as Foot | null,
      height_cm: num(f.height_cm),
      weight_kg: num(f.weight_kg),
      status: f.status as PlayerStatus,
      notes: f.notes.trim() || null,
    });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="form">
        <Field label={t.fullName}><input type="text" required value={f.full_name} onChange={set("full_name")} /></Field>
        <Field label={t.squad}>
          <select value={f.squad_id} onChange={set("squad_id")}>
            {allowNoSquad && <option value="">{t.noSquad}</option>}
            {squadOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label={t.statusL}>
          <select value={f.status} onChange={set("status")}>
            {(["available", "injured", "rehab", "unavailable"] as const).map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
          </select>
        </Field>
        <Field label={t.position}>
          <select value={f.position} onChange={set("position")}>
            <option value="">{t.none}</option>
            {(["GK", "DF", "MF", "FW"] as const).map((p) => <option key={p} value={p}>{t.pos[p]}</option>)}
          </select>
        </Field>
        <Field label={t.number}><input type="number" min={0} max={999} value={f.shirt_number} onChange={set("shirt_number")} /></Field>
        <Field label={t.dob}><input type="date" value={f.date_of_birth} onChange={set("date_of_birth")} /></Field>
        <Field label={t.dominantFoot}>
          <select value={f.dominant_foot} onChange={set("dominant_foot")}>
            <option value="">{t.none}</option>
            {(["right", "left", "both"] as const).map((x) => <option key={x} value={x}>{t.foot[x]}</option>)}
          </select>
        </Field>
        <Field label={t.heightCm}><input type="number" min={80} max={250} step="0.1" value={f.height_cm} onChange={set("height_cm")} /></Field>
        <Field label={t.weightKg}><input type="number" min={20} max={200} step="0.1" value={f.weight_kg} onChange={set("weight_kg")} /></Field>
      </div>
      <Field label={t.notesL}><textarea value={f.notes} onChange={set("notes")} /></Field>
      <div className="row">
        <button className="btn" disabled={busy || !f.full_name.trim()}>{t.save}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>{t.cancel}</button>
      </div>
    </form>
  );
}

function AthleteAccess({ player, invites, canInvite, onChange }: { player: Player; invites: Invite[]; canInvite: boolean; onChange: () => void }) {
  const { t } = useI18n();
  const { club } = useSession();
  const act = useAction();
  const live = invites[0];

  return (
    <section className="panel">
      <h2>{t.athleteApp}</h2>
      {player.user_id ? (
        <p className="row" style={{ margin: 0 }}><span className="pill good">{t.linked}</span><span className="muted">{t.linkedNote}</span></p>
      ) : live ? (
        <>
          <p className="muted" style={{ margin: 0 }}>{t.inviteNote}</p>
          <CopyLink url={inviteUrl(live.token)} />
          {canInvite && (
            <div>
              <button className="btn sm danger" onClick={() => act(async () => {
                must(await supabase.from("invites").update({ revoked_at: new Date().toISOString() }).eq("id", live.id));
                onChange();
              }, t.revoked)}>{t.revoke}</button>
            </div>
          )}
        </>
      ) : canInvite ? (
        <div>
          <button className="btn" onClick={() => act(async () => {
            must(await supabase.from("invites").insert({ club_id: club!.id, role: "athlete", player_id: player.id }));
            onChange();
          })}>{t.createInvite}</button>
        </div>
      ) : (
        <p className="empty">{t.notLinked}</p>
      )}
    </section>
  );
}

export function CopyLink({ url }: { url: string }) {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <div className="copybox">
      <input type="text" readOnly value={url} dir="ltr" onFocus={(e) => e.target.select()} aria-label={t.inviteLink} />
      <button className="btn sm" onClick={async () => {
        try { await navigator.clipboard.writeText(url); toast(t.copied); } catch { /* clipboard blocked; text is selectable */ }
      }}>{t.copy}</button>
    </div>
  );
}

function Notes({ playerId, notes, authorName, me, onChange }: {
  playerId: string; notes: { id: string; author_id: string; body: string; shared_with_athlete: boolean; created_at: string }[];
  authorName: (uid: string) => string; me: string; onChange: () => void;
}) {
  const { t, lang } = useI18n();
  const act = useAction();
  const [body, setBody] = useState("");
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBody(""); }, [playerId]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await act(async () => {
      must(await supabase.from("player_notes").insert({ player_id: playerId, body: body.trim(), shared_with_athlete: shared }));
    }, t.noteAdded);
    setBusy(false);
    if (ok) { setBody(""); setShared(false); onChange(); }
  }

  return (
    <section className="panel">
      <h2>{t.coachNotes}</h2>
      <form onSubmit={add} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea placeholder={t.writeNote} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
        <div className="spread">
          <label className="check"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />{t.shareWithAthlete}</label>
          <button className="btn sm" disabled={busy || !body.trim()}>{t.addNote}</button>
        </div>
      </form>
      {notes.length === 0 ? <p className="empty">{t.noNotes}</p> : notes.map((n) => (
        <div key={n.id} className="note">
          <div className="spread" style={{ fontSize: 12 }}>
            <span className="muted">{authorName(n.author_id)} · {fmtDay(n.created_at.slice(0, 10), lang)}</span>
            <span className="row">
              <span className="tag">{n.shared_with_athlete ? t.sharedNote : t.privateNote}</span>
              {n.author_id === me && (
                <ConfirmButton label={t.delete} confirmLabel={t.confirmRemove} onConfirm={() => act(async () => {
                  must(await supabase.from("player_notes").delete().eq("id", n.id));
                  onChange();
                })} />
              )}
            </span>
          </div>
          <p>{n.body}</p>
        </div>
      ))}
    </section>
  );
}
