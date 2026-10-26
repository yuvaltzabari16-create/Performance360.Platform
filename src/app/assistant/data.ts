import { getSession } from "@/lib/auth";
import { needs, type Intent, type PersonalData } from "@/lib/assistant/personal";

type Supabase = Awaited<ReturnType<typeof getSession>>["supabase"];

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

type LoadRow = { athlete_id: string; player_load: number | null; total_distance_m: number; gps_sessions: { session_date: string } | { session_date: string }[] };

/**
 * Loads only the rows a question needs, with the signed-in person's own database permissions: an athlete gets their
 * own rows, staff get what row-level security already lets them see (their squad; wearables only when shared).
 * `athleteId` is set for athletes; staff pass null.
 */
export async function loadPersonalData(supabase: Supabase, intent: Intent, athleteId: string | null): Promise<PersonalData> {
  const want = needs(intent);
  const today = isoDaysAgo(0);
  const mine = <Q extends { eq: (c: string, v: string) => Q }>(q: Q) => (athleteId ? q.eq("athlete_id", athleteId) : q);

  const athletes = athleteId
    ? supabase.from("athletes").select("id, full_name").eq("id", athleteId)
    : supabase.from("athletes").select("id, full_name").eq("status", "active").limit(1000);

  const [roster, load, readiness, injuries, wearable] = await Promise.all([
    athletes,
    want.load ? mine(supabase.from("gps_session_metrics").select("athlete_id, player_load, total_distance_m, gps_sessions!inner(session_date)").gte("gps_sessions.session_date", isoDaysAgo(40)).limit(3000)) : null,
    want.readiness ? mine(supabase.from("readiness_entries").select("athlete_id, entry_date, sleep_quality, fatigue, soreness, stress, mood, motivation, pain_reported").gte("entry_date", isoDaysAgo(21)).order("entry_date", { ascending: false }).limit(3000)) : null,
    want.injuries ? mine(supabase.from("injuries").select("athlete_id, body_area, stage, injury_date, expected_return").eq("status", "open").order("injury_date", { ascending: true }).limit(200)) : null,
    want.wearable ? mine(supabase.from("wearable_daily").select("athlete_id, day, recovery_score, hrv_ms, sleep_hours, resting_hr").gte("day", isoDaysAgo(14)).order("day", { ascending: false }).limit(1500)) : null,
  ]);

  const names: Record<string, string> = {};
  for (const a of (roster.data ?? []) as { id: string; full_name: string }[]) names[a.id] = a.full_name;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  return {
    today,
    names,
    roster: athleteId ? [] : Object.keys(names),
    load: ((load?.data ?? []) as unknown as LoadRow[]).map((r) => ({
      athleteId: r.athlete_id,
      date: (Array.isArray(r.gps_sessions) ? r.gps_sessions[0] : r.gps_sessions).session_date,
      load: Number(r.player_load) || r.total_distance_m / 100,
    })),
    readiness: ((readiness?.data ?? []) as { athlete_id: string; entry_date: string; sleep_quality: number | null; fatigue: number | null; soreness: number | null; stress: number | null; mood: number | null; motivation: number | null; pain_reported: boolean }[]).map((r) => ({
      athleteId: r.athlete_id, date: r.entry_date, sleepQuality: r.sleep_quality, fatigue: r.fatigue, soreness: r.soreness, stress: r.stress, mood: r.mood, motivation: r.motivation, pain: r.pain_reported,
    })),
    injuries: ((injuries?.data ?? []) as { athlete_id: string; body_area: string; stage: string; injury_date: string; expected_return: string | null }[]).map((r) => ({
      athleteId: r.athlete_id, area: r.body_area, stage: r.stage, injuryDate: r.injury_date, expectedReturn: r.expected_return,
    })),
    wearable: ((wearable?.data ?? []) as { athlete_id: string; day: string; recovery_score: number | null; hrv_ms: number | null; sleep_hours: number | null; resting_hr: number | null }[]).map((r) => ({
      athleteId: r.athlete_id, day: r.day, recovery: num(r.recovery_score), hrv: num(r.hrv_ms), sleepHours: num(r.sleep_hours), restingHr: num(r.resting_hr),
    })),
  };
}
