"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/auth";
import { done, fail, oneOf, str, uuid } from "@/lib/forms";
import { MAX_CSV_BYTES } from "@/lib/gps/constants";
import { generateSamples } from "@/lib/gps/demo";
import { nameKey, toRpcRow } from "@/lib/gps/format";
import { buildHeat, computeMetrics } from "@/lib/gps/metrics";
import { parseSamples } from "@/lib/gps/samples";
import { parseSummary } from "@/lib/gps/summary";
import { DEFAULT_PITCH } from "@/lib/gps/types";
import { canWriteTraining } from "@/lib/permissions";

const SOURCES = ["statsports", "catapult", "polar", "other"] as const;
const KINDS = ["training", "match"] as const;

/** Athletes the caller can work with, keyed by normalised name. */
async function rosterByName(supabase: Awaited<ReturnType<typeof requireSection>>["supabase"]) {
  const { data } = await supabase.from("athletes").select("id, full_name").eq("status", "active").limit(500);
  const map = new Map<string, string>();
  for (const a of data ?? []) map.set(nameKey(a.full_name as string), a.id as string);
  return { map, athletes: (data ?? []) as { id: string; full_name: string }[] };
}

function pitchFrom(fd: FormData) {
  const length = Number(str(fd, "pitch_length", 8) ?? DEFAULT_PITCH.length);
  const width = Number(str(fd, "pitch_width", 8) ?? DEFAULT_PITCH.width);
  return {
    length: Number.isFinite(length) ? Math.min(140, Math.max(20, length)) : DEFAULT_PITCH.length,
    width: Number.isFinite(width) ? Math.min(100, Math.max(10, width)) : DEFAULT_PITCH.width,
  };
}

/** Imports a wearable export (summary or position data) and matches athletes to the roster by name. */
export async function importGpsSession(formData: FormData) {
  const { supabase, org, t } = await requireSection("gps");
  const back = "/gps/import";
  const te = t.gps.importErrors;
  if (!canWriteTraining(org?.org_role ?? null)) fail(back, te.generic);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) fail(back, te.no_file);
  if (file.size > MAX_CSV_BYTES) fail(back, te.too_big);

  const pitch = pitchFrom(formData);
  const type = oneOf(formData, "type", ["summary", "samples"] as const, "summary");
  const text = await file.text();

  const rows: ReturnType<typeof toRpcRow>[] = [];
  const unmatched: string[] = [];
  let fitted = false;
  const { map } = await rosterByName(supabase);
  try {
    if (type === "samples") {
      const parsed = parseSamples(text, pitch);
      fitted = parsed.warnings.includes("positions_fitted");
      for (const [name, samples] of parsed.players) {
        const id = map.get(nameKey(name));
        if (!id) { unmatched.push(name); continue; }
        rows.push(toRpcRow(id, computeMetrics(samples), buildHeat(samples, pitch)));
      }
    } else {
      for (const r of parseSummary(text)) {
        const id = map.get(nameKey(r.name));
        if (!id) { unmatched.push(r.name); continue; }
        rows.push(toRpcRow(id, r.metrics, null));
      }
    }
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    fail(back, (te as Record<string, string>)[code] ?? te.generic);
  }
  if (rows.length === 0) fail(back, te.no_match);

  const title = str(formData, "title", 160) ?? (file.name.replace(/\.[^.]+$/, "") || t.gps.importTitle);
  const { data, error } = await supabase.rpc("import_gps_session", {
    p_title: title,
    p_kind: oneOf(formData, "kind", KINDS, "training"),
    p_date: str(formData, "session_date", 10),
    p_pitch_length: pitch.length,
    p_pitch_width: pitch.width,
    p_source: oneOf(formData, "source", SOURCES, "other"),
    p_is_sample: false,
    p_rows: rows,
  });
  if (error || !data) fail(back, te.generic);
  revalidatePath("/gps");
  const notes = [fitted ? t.gps.fitted : null, unmatched.length ? t.gps.unmatched.replace("{names}", unmatched.slice(0, 8).join(", ")) : null].filter(Boolean).join(" ");
  done(`/gps/${data}`, `${t.gps.imported}${notes ? " " + notes : ""}`);
}

/** Adds a clearly labelled sample session for the roster so the GPS pages can be explored. */
export async function loadSampleSession() {
  const { supabase, org, t } = await requireSection("gps");
  if (!canWriteTraining(org?.org_role ?? null)) fail("/gps", t.gps.importErrors.generic);
  const { athletes } = await rosterByName(supabase);
  const squad = athletes.slice(0, 18);
  if (squad.length === 0) fail("/gps", t.gps.sampleNoAthletes);
  const pitch = DEFAULT_PITCH;
  const rows = squad.map((a, i) => {
    const samples = generateSamples(i, pitch, 45);
    return toRpcRow(a.id, computeMetrics(samples), buildHeat(samples, pitch));
  });
  const { data, error } = await supabase.rpc("import_gps_session", {
    p_title: t.gps.sampleTitle, p_kind: "training", p_date: new Date().toISOString().slice(0, 10),
    p_pitch_length: pitch.length, p_pitch_width: pitch.width, p_source: "sample", p_is_sample: true, p_rows: rows,
  });
  if (error || !data) fail("/gps", t.gps.importErrors.generic);
  revalidatePath("/gps");
  done(`/gps/${data}`, t.gps.sampleSaved);
}

export async function deleteGpsSession(formData: FormData) {
  const { supabase, t } = await requireSection("gps");
  const id = uuid(formData, "session_id");
  if (!id) fail("/gps", t.common.error);
  const { error } = await supabase.rpc("delete_gps_session", { p_session: id });
  if (error) fail("/gps", t.common.error);
  revalidatePath("/gps");
  done("/gps", t.gps.deleted);
}
