import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// Exports the signed-in user's own data as JSON. Every query runs under RLS as
// that user; professionals get their own authored content, athletes their record.
export async function GET() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) return new NextResponse("Unauthorized", { status: 401 });

  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), profile };
  if (profile.role === "athlete") {
    const { data: me } = await supabase.from("athletes").select("*").eq("user_id", user.id).maybeSingle();
    out.athlete_profile = me;
    if (me) {
      const [tests, readiness, completions, notes] = await Promise.all([
        supabase.from("test_results").select("*, test_definitions(name, unit)").eq("athlete_id", me.id),
        supabase.from("readiness_entries").select("*").eq("athlete_id", me.id),
        supabase.from("workout_completions").select("*, exercise_logs(*)").eq("athlete_id", me.id),
        supabase.from("athlete_notes").select("body, created_at").eq("athlete_id", me.id),
      ]);
      Object.assign(out, { test_results: tests.data, readiness: readiness.data, completed_sessions: completions.data, shared_notes: notes.data });
    }
  } else {
    const [programs, exercises, teams, notes, tests] = await Promise.all([
      supabase.from("training_programs").select("*, training_sessions(*, session_exercises(*)), program_phases(*)").eq("coach_id", user.id),
      supabase.from("exercises").select("*").eq("owner_id", user.id),
      supabase.from("teams").select("*, team_members(athlete_id)").eq("owner_id", user.id),
      supabase.from("athlete_notes").select("*").eq("author_id", user.id),
      supabase.from("test_results").select("*").eq("tester_id", user.id),
    ]);
    Object.assign(out, { programs: programs.data, exercises: exercises.data, teams: teams.data, notes_authored: notes.data, tests_recorded: tests.data });
  }
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="performance360-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
