import { useMemo, useState, type FormEvent } from "react";
import { editablePlayerIds, type ClubData } from "../lib/data";
import { isoDate } from "../lib/dates";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/session";
import { must, supabase } from "../lib/supabase";
import type { SessionType } from "../lib/types";
import type { WorkoutContent } from "../lib/workout";
import { Modal } from "./Modal";
import { Field, useAction } from "./ui";

/** Creates a training session carrying a snapshot of the workout, for a squad or one athlete. */
export function AssignDialog({ workout, club, onClose }: {
  workout: { id: string; title: string; focus: string | null; est_minutes: number | null; content: WorkoutContent };
  club: ClubData; onClose: () => void;
}) {
  const { t } = useI18n();
  const { role, userId, club: c } = useSession();
  const act = useAction();
  const squads = useMemo(() => role === "director" ? club.squads
    : club.squads.filter((s) => club.squadStaff.some((x) => x.squad_id === s.id && x.user_id === userId)), [club, role, userId]);
  const editable = editablePlayerIds(club, role, userId);
  const players = club.players.filter((p) => editable.has(p.id));
  const [kind, setKind] = useState<"squad" | "player">(squads.length ? "squad" : "player");
  const [target, setTarget] = useState(kind === "squad" ? squads[0]?.id ?? "" : players[0]?.id ?? "");
  const [date, setDate] = useState(isoDate());
  const [type, setType] = useState<SessionType>("gym");
  const [dur, setDur] = useState(String(workout.est_minutes ?? 60));
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await act(async () => {
      must(await supabase.from("training_sessions").insert({
        club_id: c!.id, session_date: date, type, duration_min: Number(dur), title: workout.title,
        squad_id: kind === "squad" ? target : null, player_id: kind === "player" ? target : null,
        workout_id: workout.id, workout_snapshot: { title: workout.title, focus: workout.focus, content: workout.content },
      }));
    }, t.assigned);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={`${t.assignT}: ${workout.title}`} onClose={onClose}>
      <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
        <div className="seg" role="group" aria-label={t.assignTo}>
          <button type="button" aria-pressed={kind === "squad"} disabled={!squads.length} onClick={() => { setKind("squad"); setTarget(squads[0]?.id ?? ""); }}>{t.aSquad}</button>
          <button type="button" aria-pressed={kind === "player"} disabled={!players.length} onClick={() => { setKind("player"); setTarget(players[0]?.id ?? ""); }}>{t.anAthlete}</button>
        </div>
        <div className="form">
          <Field label={t.assignTo}>
            <select value={target} onChange={(e) => setTarget(e.target.value)} required>
              {(kind === "squad" ? squads : players).map((x) => <option key={x.id} value={x.id}>{"name" in x ? x.name : x.full_name}</option>)}
            </select>
          </Field>
          <Field label={t.date}><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={t.type}>
            <select value={type} onChange={(e) => setType(e.target.value as SessionType)}>
              {(["gym", "pitch", "recovery", "match"] as const).map((x) => <option key={x} value={x}>{t.sessionType[x]}</option>)}
            </select>
          </Field>
          <Field label={t.minutes}><input type="number" min={5} max={300} required value={dur} onChange={(e) => setDur(e.target.value)} /></Field>
        </div>
        <div className="row">
          <button className="btn" disabled={busy || !target}>{t.assign}</button>
          <button type="button" className="btn ghost" onClick={onClose}>{t.cancel}</button>
        </div>
      </form>
    </Modal>
  );
}
