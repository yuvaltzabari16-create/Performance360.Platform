import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { bestTrial, meanTrial } from "@/lib/metrics";

function csvCell(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CSV export of one athlete's test results. Runs as the signed-in user, so RLS
// limits it to athletes they are authorised to see.
export async function GET(request: NextRequest) {
  const { supabase, user } = await getSession();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const athleteId = request.nextUrl.searchParams.get("athlete");
  if (!isUuid(athleteId)) return new NextResponse("Bad request", { status: 400 });

  const { data: athlete } = await supabase.from("athletes").select("full_name").eq("id", athleteId).maybeSingle();
  if (!athlete) return new NextResponse("Not found", { status: 404 });
  const { data } = await supabase
    .from("test_results")
    .select("tested_on, side, trials, method, conditions, data_quality, is_baseline, notes, test_definitions(name, unit, higher_is_better)")
    .eq("athlete_id", athleteId)
    .order("tested_on");

  const header = ["athlete", "date", "test", "unit", "side", "trials", "best", "mean", "method", "conditions", "data_quality", "baseline", "notes"];
  const lines = [header.join(",")];
  for (const r of data ?? []) {
    const def = r.test_definitions as unknown as { name: string; unit: string; higher_is_better: boolean };
    const trials = r.trials as number[];
    lines.push(
      [athlete.full_name, r.tested_on, def.name, def.unit, r.side, trials.join(" / "), bestTrial(trials, def.higher_is_better), meanTrial(trials), r.method, r.conditions, r.data_quality, r.is_baseline, r.notes]
        .map(csvCell)
        .join(","),
    );
  }
  const filename = `tests-${athlete.full_name.replace(/[^\w-]+/g, "_")}.csv`;
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}
