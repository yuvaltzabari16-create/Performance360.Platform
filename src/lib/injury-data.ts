import type { SupabaseClient } from "@supabase/supabase-js";
import type { InjuryEventRow, InjuryRow } from "@/components/injury/types";
import { loadAttachments, type AttachmentRow } from "@/lib/files/data";

const INJURY_COLUMNS = "id, athlete_id, body_area, side, kind, mechanism, severity, injury_date, diagnosis, expected_return, stage, status, resolved_on";
const EVENT_COLUMNS = "id, injury_id, kind, stage, note, author_name, author_role, created_at";

/** Injuries (newest first) and their timelines for the given athletes. Row-level security decides what comes back. */
export async function loadInjuries(supabase: SupabaseClient, athleteIds: string[]) {
  if (athleteIds.length === 0) return { injuries: [] as InjuryRow[], events: [] as InjuryEventRow[], files: [] as AttachmentRow[] };
  const { data: injuries } = await supabase.from("injuries").select(INJURY_COLUMNS).in("athlete_id", athleteIds).order("injury_date", { ascending: false }).limit(200);
  const rows = (injuries ?? []) as InjuryRow[];
  if (rows.length === 0) return { injuries: rows, events: [] as InjuryEventRow[], files: [] as AttachmentRow[] };
  const { data: events } = await supabase.from("injury_events").select(EVENT_COLUMNS).in("injury_id", rows.map((r) => r.id)).order("created_at", { ascending: true }).limit(2000);
  const files = await loadAttachments(supabase, "injury", rows.map((r) => r.id));
  return { injuries: rows, events: (events ?? []) as InjuryEventRow[], files };
}
