import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/export/csv";
import { canAccess, type Section } from "@/lib/permissions";

// CSV downloads of the data a person can already see. Every query runs under row-level security as the
// signed-in user, so squad scoping, athlete sharing choices and the director's read-only view all apply.
const DATASETS = {
  athletes: "athletes",
  tests: "testing",
  injuries: "injuries",
  gps: "gps",
  readiness: "readiness",
  wearables: "wearables",
} as const satisfies Record<string, Section>;
type Dataset = keyof typeof DATASETS;

type Row = Record<string, unknown>;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export async function GET(_req: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  const { supabase, user, profile, org } = await getSession();
  if (!user || !profile) return new NextResponse("Unauthorized", { status: 401 });
  if (!(dataset in DATASETS)) return new NextResponse("Not found", { status: 404 });
  const kind = dataset as Dataset;
  if (!canAccess(DATASETS[kind], profile.role, org?.org_role ?? null)) return new NextResponse("Forbidden", { status: 403 });

  // Names: the director cannot read athlete records, only the roster list.
  const { data: roster } = await supabase.rpc("org_roster");
  const rosterNames = new Map(((roster ?? []) as { athlete_id: string; full_name: string }[]).map((r) => [r.athlete_id, r.full_name]));
  const nameFor = async (ids: string[]) => {
    const names = new Map(rosterNames);
    const missing = [...new Set(ids)].filter((id) => !names.has(id));
    if (missing.length) {
      const { data } = await supabase.from("athletes").select("id, full_name").in("id", missing);
      for (const a of data ?? []) names.set(a.id as string, a.full_name as string);
    }
    return (id: string) => names.get(id) ?? "";
  };

  let headers: string[] = [];
  let rows: unknown[][] = [];

  if (kind === "athletes") {
    const { data } = await supabase.from("athletes").select("full_name, sport, team_name, position, competitive_level, date_of_birth, height_cm, body_mass_kg, status").order("full_name").limit(5000);
    headers = ["name", "sport", "team", "position", "level", "date_of_birth", "height_cm", "body_mass_kg", "status"];
    rows = ((data ?? []) as Row[]).map((a) => [a.full_name, a.sport, a.team_name, a.position, a.competitive_level, a.date_of_birth, a.height_cm, a.body_mass_kg, a.status]);
  } else if (kind === "tests") {
    const { data } = await supabase.from("test_results").select("athlete_id, tested_on, side, trials, data_quality, is_baseline, test_definitions(name, unit)").order("tested_on", { ascending: false }).limit(10000);
    const list = (data ?? []) as unknown as Row[];
    const name = await nameFor(list.map((r) => r.athlete_id as string));
    headers = ["athlete", "date", "test", "unit", "side", "trials", "data_quality", "baseline"];
    rows = list.map((r) => { const d = one(r.test_definitions as { name: string; unit: string } | { name: string; unit: string }[] | null); return [name(r.athlete_id as string), r.tested_on, d?.name, d?.unit, r.side, r.trials, r.data_quality, r.is_baseline]; });
  } else if (kind === "injuries") {
    const { data } = await supabase.from("injuries").select("athlete_id, body_area, side, kind, severity, mechanism, injury_date, stage, status, expected_return, resolved_on").order("injury_date", { ascending: false }).limit(10000);
    const list = (data ?? []) as Row[];
    const name = await nameFor(list.map((r) => r.athlete_id as string));
    headers = ["athlete", "body_area", "side", "type", "severity", "mechanism", "injury_date", "stage", "status", "expected_return", "resolved_on"];
    rows = list.map((r) => [name(r.athlete_id as string), r.body_area, r.side, r.kind, r.severity, r.mechanism, r.injury_date, r.stage, r.status, r.expected_return, r.resolved_on]);
  } else if (kind === "gps") {
    const { data } = await supabase.from("gps_session_metrics").select("athlete_id, minutes, total_distance_m, hsr_distance_m, sprint_distance_m, sprint_count, max_speed_kmh, accel_count, decel_count, player_load, avg_hr, max_hr, gps_sessions!inner(title, kind, session_date)").order("session_id").limit(20000);
    const list = (data ?? []) as unknown as Row[];
    const name = await nameFor(list.map((r) => r.athlete_id as string));
    headers = ["date", "session", "kind", "athlete", "minutes", "distance_m", "high_speed_m", "sprint_m", "sprints", "top_speed_kmh", "accels", "decels", "load", "avg_hr", "max_hr"];
    rows = list.map((r) => { const s = one(r.gps_sessions as { title: string; kind: string; session_date: string } | { title: string; kind: string; session_date: string }[] | null); return [s?.session_date, s?.title, s?.kind, name(r.athlete_id as string), r.minutes, r.total_distance_m, r.hsr_distance_m, r.sprint_distance_m, r.sprint_count, r.max_speed_kmh, r.accel_count, r.decel_count, r.player_load, r.avg_hr, r.max_hr]; });
    rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  } else if (kind === "readiness") {
    const { data } = await supabase.from("readiness_entries").select("athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress, mood, motivation, pain_reported").order("entry_date", { ascending: false }).limit(20000);
    const list = (data ?? []) as Row[];
    const name = await nameFor(list.map((r) => r.athlete_id as string));
    headers = ["athlete", "date", "sleep_hours", "sleep_quality", "fatigue", "soreness", "stress", "mood", "motivation", "pain_reported"];
    rows = list.map((r) => [name(r.athlete_id as string), r.entry_date, r.sleep_hours, r.sleep_quality, r.fatigue, r.soreness, r.stress, r.mood, r.motivation, r.pain_reported]);
  } else {
    // Own data, or data athletes chose to share (the database filters).
    const { data } = await supabase.from("wearable_daily").select("athlete_id, provider, day, recovery_score, hrv_ms, resting_hr, sleep_hours, sleep_performance, strain").order("day", { ascending: false }).limit(20000);
    const list = (data ?? []) as Row[];
    const name = await nameFor(list.map((r) => r.athlete_id as string));
    headers = ["athlete", "provider", "day", "recovery", "hrv_ms", "resting_hr", "sleep_hours", "sleep_performance", "strain"];
    rows = list.map((r) => [name(r.athlete_id as string), r.provider, r.day, r.recovery_score, r.hrv_ms, r.resting_hr, r.sleep_hours, r.sleep_performance, r.strain]);
  }

  return new NextResponse(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="performance360-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
