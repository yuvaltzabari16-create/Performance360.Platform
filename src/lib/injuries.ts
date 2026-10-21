import { isoDate } from "./dates";
import { must, supabase } from "./supabase";
import type { Injury, InjuryUpdate } from "./types";

export const STAGES = [0, 1, 2, 3, 4, 5] as const;
export const BODY_AREAS = ["hamstring", "quadriceps", "groin", "calf", "ankle", "knee", "hip", "foot", "lower_back", "shoulder", "head", "other"] as const;
export const KINDS = ["muscle", "ligament", "tendon", "bone", "joint", "contusion", "concussion", "illness", "other"] as const;
export const MECHANISMS = ["contact", "non_contact", "overuse", "unknown"] as const;
export const SEVERITIES = ["minor", "moderate", "severe"] as const;

/** Whole days between two YYYY-MM-DD dates (b − a). */
export function daysBetween(a: string, b: string) {
  const [y1, m1, d1] = a.slice(0, 10).split("-").map(Number);
  const [y2, m2, d2] = b.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5);
}

/** Days out so far (open) or days lost (closed). */
export function daysOut(i: Injury, today = isoDate()) {
  return daysBetween(i.reported_on, i.closed_at ? i.closed_at.slice(0, 10) : today);
}

/** Positive = days left until expected return, negative = overdue. */
export function daysToReturn(i: Injury, today = isoDate()) {
  return i.expected_return ? daysBetween(today, i.expected_return) : null;
}

export function stageTone(stage: number): "bad" | "warn" | "good" {
  return stage <= 1 ? "bad" : stage <= 3 ? "warn" : "good";
}

/** Body area label: known keys are translated, free text (e.g. from a check-in) is shown as typed. */
export function areaLabel(area: string | null | undefined, areas: Record<string, string>) {
  if (!area) return "";
  return areas[area] ?? area;
}

export async function loadInjuries(clubId: string, playerId?: string) {
  let q = supabase.from("injuries").select("*").eq("club_id", clubId);
  if (playerId) q = q.eq("player_id", playerId);
  return must(await q.order("reported_on", { ascending: false })) as Injury[];
}

export async function loadInjuryUpdates(injuryIds: string[]) {
  if (!injuryIds.length) return [] as InjuryUpdate[];
  return must(await supabase.from("injury_updates").select("*").in("injury_id", injuryIds).order("created_at")) as InjuryUpdate[];
}

/** Moves an injury to a stage; the database logs the change, and we attach the optional note to that log row. */
export async function setStage(injury: Injury, stage: number, note: string) {
  must(await supabase.from("injuries").update({ stage }).eq("id", injury.id));
  if (note.trim()) {
    const ups = await loadInjuryUpdates([injury.id]);
    const last = [...ups].reverse().find((u) => u.stage === stage);
    if (last) must(await supabase.from("injury_updates").update({ note: note.trim() }).eq("id", last.id));
  }
}
