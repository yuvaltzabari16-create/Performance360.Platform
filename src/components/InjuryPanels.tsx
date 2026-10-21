import { useState, type FormEvent } from "react";
import { fmtDay, isoDate } from "../lib/dates";
import { useI18n } from "../lib/i18n";
import {
  areaLabel, BODY_AREAS, daysOut, daysToReturn, KINDS, loadInjuries, loadInjuryUpdates, MECHANISMS, setStage, SEVERITIES, STAGES, stageTone,
} from "../lib/injuries";
import { useSession } from "../lib/session";
import { must, supabase } from "../lib/supabase";
import type { Injury, Player, Profile } from "../lib/types";
import { useAsync } from "../lib/useAsync";
import { Modal } from "./Modal";
import { ConfirmButton, ErrorBox, Field, Loading, useAction } from "./ui";

/** Six-step return-to-play track; the current step is filled. */
export function RtpStepper({ stage, compact = false }: { stage: number; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <ol className={"rtp" + (compact ? " compact" : "")} aria-label={t.rtpBoard}>
      {STAGES.map((s) => (
        <li key={s} className={s < stage ? "past" : s === stage ? "now " + stageTone(s) : ""} aria-current={s === stage ? "step" : undefined}>
          <span className="dot" aria-hidden="true" />
          {!compact && <span className="lab">{t.rtpStages[s]}</span>}
        </li>
      ))}
    </ol>
  );
}

export function SeverityPill({ severity }: { severity: string }) {
  const { t } = useI18n();
  const tone = severity === "severe" ? "bad" : severity === "moderate" ? "warn" : "na";
  return <span className={"pill " + tone}>{t.severities[severity] ?? severity}</span>;
}

/** "12 days out · 9 days to go" / "overdue by 3d" */
export function InjuryTiming({ injury }: { injury: Injury }) {
  const { t } = useI18n();
  const out = daysOut(injury);
  const left = injury.closed_at ? null : daysToReturn(injury);
  return (
    <span className="muted" style={{ fontSize: 12 }}>
      <span className="num">{out}</span> {t.daysOut}
      {left != null && (left >= 0
        ? <> · <span className="num">{left}</span> {t.daysLeft}</>
        : <> · <span style={{ color: "var(--bad)" }}>{t.overdueBy} <span className="num">{-left}</span>{t.dayUnit}</span></>)}
    </span>
  );
}

export function injuryTitle(i: Injury, t: ReturnType<typeof useI18n>["t"]) {
  return [areaLabel(i.body_area, t.areas), i.side && t.sides[i.side]].filter(Boolean).join(" · ");
}

/** Create or edit an injury. `players` limits who can be picked (players this user may edit). */
export function InjuryForm({ players, playerId, injury, onDone }: {
  players: Pick<Player, "id" | "full_name">[]; playerId?: string; injury?: Injury; onDone: (saved: boolean) => void;
}) {
  const { t } = useI18n();
  const act = useAction();
  const known = (BODY_AREAS as readonly string[]).includes(injury?.body_area ?? "hamstring");
  const [f, setF] = useState({
    player_id: injury?.player_id ?? playerId ?? players[0]?.id ?? "",
    reported_on: injury?.reported_on ?? isoDate(),
    area: known ? injury?.body_area ?? "hamstring" : "other",
    areaText: known ? "" : injury?.body_area ?? "",
    side: injury?.side ?? "",
    kind: injury?.kind ?? "muscle",
    mechanism: injury?.mechanism ?? "non_contact",
    severity: injury?.severity ?? "minor",
    stage: String(injury?.stage ?? 0),
    expected_return: injury?.expected_return ?? "",
    diagnosis: injury?.diagnosis ?? "",
    notes: injury?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const row = {
      reported_on: f.reported_on,
      body_area: f.area === "other" && f.areaText.trim() ? f.areaText.trim() : f.area,
      side: f.side || null, kind: f.kind, mechanism: f.mechanism, severity: f.severity,
      expected_return: f.expected_return || null, diagnosis: f.diagnosis.trim() || null, notes: f.notes.trim() || null,
    };
    const ok = await act(async () => {
      if (injury) must(await supabase.from("injuries").update({ ...row, stage: Number(f.stage) }).eq("id", injury.id));
      else must(await supabase.from("injuries").insert({ ...row, player_id: f.player_id, stage: Number(f.stage) }));
    }, injury ? t.saved : t.injuryLogged);
    setBusy(false);
    if (ok) onDone(true);
  }

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
      <div className="form">
        {!injury && (
          <Field label={t.name}>
            <select value={f.player_id} onChange={set("player_id")} required disabled={!!playerId}>
              {players.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </Field>
        )}
        <Field label={t.reportedOn}><input type="date" required max={isoDate()} value={f.reported_on} onChange={set("reported_on")} /></Field>
        <Field label={t.bodyArea}>
          <select value={f.area} onChange={set("area")}>
            {BODY_AREAS.map((a) => <option key={a} value={a}>{t.areas[a]}</option>)}
          </select>
        </Field>
        {f.area === "other" && <Field label={t.bodyArea}><input type="text" maxLength={80} value={f.areaText} onChange={set("areaText")} /></Field>}
        <Field label={t.side}>
          <select value={f.side} onChange={set("side")}>
            <option value="">—</option>
            {(["left", "right", "both"] as const).map((s) => <option key={s} value={s}>{t.sides[s]}</option>)}
          </select>
        </Field>
        <Field label={t.injuryType}>
          <select value={f.kind} onChange={set("kind")}>{KINDS.map((k) => <option key={k} value={k}>{t.kinds[k]}</option>)}</select>
        </Field>
        <Field label={t.mechanismL}>
          <select value={f.mechanism} onChange={set("mechanism")}>{MECHANISMS.map((k) => <option key={k} value={k}>{t.mechanisms[k]}</option>)}</select>
        </Field>
        <Field label={t.severity}>
          <select value={f.severity} onChange={set("severity")}>{SEVERITIES.map((k) => <option key={k} value={k}>{t.severities[k]}</option>)}</select>
        </Field>
        <Field label={t.currentStage}>
          <select value={f.stage} onChange={set("stage")}>{STAGES.map((s) => <option key={s} value={s}>{s + 1}. {t.rtpStages[s]}</option>)}</select>
        </Field>
        <Field label={t.expectedReturn}><input type="date" value={f.expected_return} min={f.reported_on} onChange={set("expected_return")} /></Field>
      </div>
      <Field label={t.diagnosis}><input type="text" maxLength={200} value={f.diagnosis} onChange={set("diagnosis")} /></Field>
      <Field label={t.notesL}><textarea value={f.notes} onChange={set("notes")} /></Field>
      <div className="row">
        <button className="btn" disabled={busy || !f.player_id || (f.area === "other" && !f.areaText.trim())}>{t.save}</button>
        <button type="button" className="btn ghost" onClick={() => onDone(false)}>{t.cancel}</button>
      </div>
    </form>
  );
}

/** Full injury view: stepper, stage controls with a note, details, timeline. */
export function InjuryDetail({ injury, playerName, canEdit, profiles, onChanged }: {
  injury: Injury; playerName: string; canEdit: boolean; profiles: Map<string, Profile>; onChanged: () => void;
}) {
  const { t, lang } = useI18n();
  const act = useAction();
  const { role } = useSession();
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const ups = useAsync(() => loadInjuryUpdates([injury.id]), [injury.id, injury.stage, injury.updated_at]);

  async function move(stage: number) {
    setBusy(true);
    const ok = await act(() => setStage(injury, stage, note), t.stageUpdated);
    setBusy(false);
    if (ok) { setNote(""); onChanged(); ups.reload(); }
  }

  if (editing) {
    return <InjuryForm players={[{ id: injury.player_id, full_name: playerName }]} injury={injury} onDone={(s) => { setEditing(false); if (s) onChanged(); }} />;
  }
  const last = [...(ups.data ?? [])].reverse();
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="spread">
        <div>
          <h3 style={{ fontSize: 16 }}>{injuryTitle(injury, t)}</h3>
          <InjuryTiming injury={injury} />
        </div>
        <span className="row"><SeverityPill severity={injury.severity} />{injury.kind && <span className="tag">{t.kinds[injury.kind]}</span>}</span>
      </div>
      <RtpStepper stage={injury.stage} />
      {canEdit && (
        <div className="stack" style={{ gap: 8 }}>
          <input type="text" placeholder={t.stageNote} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} aria-label={t.stageNote} />
          <div className="row">
            {injury.stage > 0 && <button className="btn ghost sm" disabled={busy} onClick={() => move(injury.stage - 1)}>{t.prevStage}: {t.rtpStages[injury.stage - 1]}</button>}
            {injury.stage < 5 && <button className="btn sm" disabled={busy} onClick={() => move(injury.stage + 1)}>{t.nextStage}: {t.rtpStages[injury.stage + 1]}</button>}
          </div>
        </div>
      )}
      <dl className="form" style={{ margin: 0 }}>
        {[
          [t.reportedOn, fmtDay(injury.reported_on, lang, { day: "numeric", month: "short", year: "numeric" })],
          [t.expectedReturn, injury.expected_return ? fmtDay(injury.expected_return, lang, { day: "numeric", month: "short", year: "numeric" }) : null],
          [t.mechanismL, injury.mechanism && t.mechanisms[injury.mechanism]],
          [t.diagnosis, injury.diagnosis],
        ].map(([k, v]) => <div key={String(k)} className="field"><dt className="lbl">{k}</dt><dd style={{ margin: 0 }}>{v || t.none}</dd></div>)}
      </dl>
      {injury.notes && <p dir="auto" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{injury.notes}</p>}
      <div>
        <span className="lbl">{t.timeline}</span>
        {ups.error ? <ErrorBox message={ups.error} /> : (
          <ol className="timeline">
            {last.map((u) => (
              <li key={u.id}>
                <span className={"tl-dot " + stageTone(u.stage)} aria-hidden="true" />
                <div>
                  <b>{t.rtpStages[u.stage]}</b>
                  <span className="muted" style={{ fontSize: 12 }}> · {fmtDay(u.created_at.slice(0, 10), lang)}{u.created_by && profiles.get(u.created_by)?.full_name ? ` · ${profiles.get(u.created_by)!.full_name}` : ""}</span>
                  {u.note && <div dir="auto" style={{ fontSize: 13 }}>{u.note}</div>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      {canEdit && (
        <div className="row" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <button className="btn sm ghost" onClick={() => setEditing(true)}>{t.edit}</button>
          {role === "director" && <ConfirmButton label={t.delete} confirmLabel={t.confirmRemove} onConfirm={() => act(async () => {
            must(await supabase.from("injuries").delete().eq("id", injury.id));
            onChanged();
          })} />}
        </div>
      )}
    </div>
  );
}

/** Player profile panel: open injuries with the RTP track, history, and "log injury". */
export function PlayerInjuries({ player, canEdit, profiles, onChanged }: {
  player: Player; canEdit: boolean; profiles: Map<string, Profile>; onChanged?: () => void;
}) {
  const { t, lang } = useI18n();
  const q = useAsync(() => loadInjuries(player.club_id, player.id), [player.id]);
  const [open, setOpen] = useState<Injury | null>(null);
  const [adding, setAdding] = useState(false);
  const changed = () => { q.reload(); onChanged?.(); };

  if (q.loading && !q.data) return <section className="panel"><Loading /></section>;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  const list = q.data ?? [];
  const current = list.filter((i) => !i.closed_at);
  const past = list.filter((i) => i.closed_at);
  const fresh = open ? list.find((i) => i.id === open.id) ?? null : null;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t.injuries}</h2>
        {canEdit && <button className="btn sm ghost" onClick={() => setAdding(true)}>+ {t.logInjury}</button>}
      </div>
      {current.map((i) => (
        <button key={i.id} className="injcard" onClick={() => setOpen(i)}>
          <span className="spread"><b>{injuryTitle(i, t)}</b><SeverityPill severity={i.severity} /></span>
          <RtpStepper stage={i.stage} />
          <InjuryTiming injury={i} />
        </button>
      ))}
      {current.length === 0 && <p className="empty">{t.noInjuries}</p>}
      {past.length > 0 && (
        <div>
          <span className="lbl">{t.injuryHistory}</span>
          <div className="list">
            {past.map((i) => (
              <button key={i.id} className="li linkrow" onClick={() => setOpen(i)}>
                <span>{injuryTitle(i, t)} <span className="muted" style={{ fontSize: 12 }}>· {fmtDay(i.reported_on, lang, { day: "numeric", month: "short", year: "numeric" })}</span></span>
                <span className="muted" style={{ fontSize: 12 }}><span className="num">{daysOut(i)}</span> {t.daysLost}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {adding && (
        <Modal title={`${t.logInjury}: ${player.full_name}`} onClose={() => setAdding(false)}>
          <InjuryForm players={[player]} playerId={player.id} onDone={(s) => { setAdding(false); if (s) changed(); }} />
        </Modal>
      )}
      {fresh && (
        <Modal title={player.full_name} onClose={() => setOpen(null)}>
          <InjuryDetail injury={fresh} playerName={player.full_name} canEdit={canEdit} profiles={profiles} onChanged={changed} />
        </Modal>
      )}
    </section>
  );
}

/** Athlete's own view on Today: where they are in return to play. */
export function AthleteRtpCard({ player }: { player: Player }) {
  const { t, lang } = useI18n();
  const q = useAsync(() => loadInjuries(player.club_id, player.id), [player.id]);
  const open = (q.data ?? []).filter((i) => !i.closed_at);
  if (!open.length) return null;
  return (
    <>
      {open.map((i) => (
        <section key={i.id} className="panel rtp-athlete">
          <div className="spread">
            <div>
              <span className="lbl">{t.rtpYour}</span>
              <h2>{t.rtpStages[i.stage]} <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>· {t.rtpStageHints[i.stage]}</span></h2>
            </div>
            <span className="tag">{injuryTitle(i, t)}</span>
          </div>
          <RtpStepper stage={i.stage} />
          <div className="spread">
            <InjuryTiming injury={i} />
            {i.expected_return && <span className="muted" style={{ fontSize: 12 }}>{t.expectedReturn}: {fmtDay(i.expected_return, lang, { weekday: "short", day: "numeric", month: "short" })}</span>}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>{t.rtpAthleteNote}</p>
        </section>
      ))}
    </>
  );
}
