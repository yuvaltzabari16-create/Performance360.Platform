"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfessional } from "@/lib/auth";
import { TEST_CATEGORIES } from "@/lib/catalog";
import { bool, done, fail, int, isUuid, num, oneOf, str, uuid } from "@/lib/forms";

const MAX_TRIALS = 10;
const MAX_ROWS = 30;

export async function recordTests(formData: FormData) {
  const { supabase, user, t } = await requireProfessional();
  const athleteId = uuid(formData, "athlete_id");
  const battery = uuid(formData, "battery_id");
  const back = `/testing/new?${new URLSearchParams({ ...(athleteId ? { athlete: athleteId } : {}), ...(battery ? { battery } : {}) })}`;
  if (!athleteId) fail(back, t.common.required);
  const testedOn = str(formData, "tested_on", 10) ?? new Date().toISOString().slice(0, 10);
  const rowCount = Math.min(MAX_ROWS, int(formData, "row_count") ?? 1);

  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    const testId = uuid(formData, `r${i}_test`);
    if (!testId) continue;
    const trials: number[] = [];
    for (let j = 0; j < MAX_TRIALS; j++) {
      const v = num(formData, `r${i}_t${j}`);
      if (v != null) trials.push(v);
    }
    if (trials.length === 0) continue; // tests left blank in a battery are not recorded
    rows.push({
      athlete_id: athleteId,
      test_id: testId,
      tested_on: testedOn,
      side: oneOf(formData, `r${i}_side`, ["both", "left", "right"] as const, "both"),
      trials,
      method: str(formData, `r${i}_method`, 200),
      conditions: str(formData, "conditions", 300),
      data_quality: oneOf(formData, "data_quality", ["good", "questionable", "poor"] as const, "good"),
      is_baseline: bool(formData, "is_baseline"),
      notes: str(formData, "notes", 2000),
      tester_id: user.id,
    });
  }
  if (rows.length === 0) fail(back, t.testing.trials);
  const { error } = await supabase.from("test_results").insert(rows);
  if (error) fail(back, error.message.includes("row-level security") ? t.common.notAllowed : error.message);
  revalidatePath("/testing");
  done(`/testing?athlete=${athleteId}`, t.common.saved);
}

export async function deleteResult(formData: FormData) {
  const { supabase, t } = await requireProfessional();
  const id = uuid(formData, "id");
  const athleteId = uuid(formData, "athlete_id");
  if (!id) fail("/testing", t.common.notFound);
  const { data } = await supabase.from("test_results").delete().eq("id", id).select("id");
  if (!data?.length) fail(`/testing?athlete=${athleteId ?? ""}`, t.common.notAllowed);
  revalidatePath("/testing");
  done(`/testing?athlete=${athleteId ?? ""}`, t.common.saved);
}

export async function createTestDefinition(formData: FormData) {
  const { supabase, user, t } = await requireProfessional();
  const name = str(formData, "name", 160);
  const unit = str(formData, "unit", 20);
  if (!name || !unit) fail("/testing/new", t.common.required);
  const { error } = await supabase.from("test_definitions").insert({
    owner_id: user.id,
    name,
    short_name: str(formData, "short_name", 30),
    category: oneOf(formData, "category", TEST_CATEGORIES, "custom"),
    unit,
    higher_is_better: bool(formData, "higher_is_better"),
    bilateral: bool(formData, "bilateral"),
    protocol: str(formData, "protocol", 2000),
    default_trials: Math.min(10, Math.max(1, int(formData, "default_trials") ?? 3)),
  });
  if (error) fail("/testing/new", error.message);
  done("/testing/new", t.common.saved);
}

export async function createBattery(formData: FormData) {
  const { supabase, user, t } = await requireProfessional();
  const name = str(formData, "name", 160);
  const testIds = formData.getAll("test_ids").filter((v): v is string => typeof v === "string" && isUuid(v)).slice(0, MAX_ROWS);
  if (!name || testIds.length === 0) fail("/testing/batteries", t.common.required);
  const { error } = await supabase.from("test_batteries").insert({ owner_id: user.id, name, description: str(formData, "description", 1000), test_ids: testIds });
  if (error) fail("/testing/batteries", error.message);
  done("/testing/batteries", t.common.saved);
}

export async function deleteBattery(formData: FormData) {
  const { supabase } = await requireProfessional();
  const id = uuid(formData, "id");
  if (id) await supabase.from("test_batteries").delete().eq("id", id);
  redirect("/testing/batteries");
}
