"use server";

import { revalidatePath } from "next/cache";
import { requireAthlete } from "@/lib/auth";
import { bool, done, fail } from "@/lib/forms";
import { parseWearableFiles } from "@/lib/wearables/file-import";
import { saveDays, syncWhoop } from "@/lib/wearables/server";
import { isWearableProvider } from "@/lib/wearables/types";

const BACK = "/wearables";
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Pulls the latest days from WHOOP now. */
export async function syncWearable() {
  const { supabase, t } = await requireAthlete();
  const r = await syncWhoop(supabase);
  revalidatePath(BACK);
  if (!r.ok) fail(BACK, t.wearables.errors.sync.replace("{code}", r.error));
  done(BACK, t.wearables.synced.replace("{n}", String(r.days)));
}

export async function setWearableSharing(formData: FormData) {
  const { supabase, t } = await requireAthlete();
  const provider = String(formData.get("provider") ?? "");
  if (!isWearableProvider(provider)) fail(BACK, t.wearables.errors.generic);
  const share = bool(formData, "share");
  const { error } = await supabase.rpc("wearable_set_sharing", { p_provider: provider, p_share: share });
  if (error) fail(BACK, t.wearables.errors.generic);
  revalidatePath(BACK);
  done(BACK, share ? t.wearables.shareOn : t.wearables.shareOff);
}

export async function disconnectWearable(formData: FormData) {
  const { supabase, t } = await requireAthlete();
  const provider = String(formData.get("provider") ?? "");
  if (!isWearableProvider(provider)) fail(BACK, t.wearables.errors.generic);
  const { error } = await supabase.rpc("wearable_disconnect", { p_provider: provider });
  if (error) fail(BACK, t.wearables.errors.generic);
  revalidatePath(BACK);
  done(BACK, t.wearables.disconnected);
}

/** Erases every stored day for a provider. */
export async function eraseWearableData(formData: FormData) {
  const { supabase, t } = await requireAthlete();
  const provider = String(formData.get("provider") ?? "");
  if (!isWearableProvider(provider)) fail(BACK, t.wearables.errors.generic);
  const { error } = await supabase.rpc("wearable_erase_data", { p_provider: provider });
  if (error) fail(BACK, t.wearables.errors.generic);
  revalidatePath(BACK);
  done(BACK, t.wearables.erased);
}

/** Imports device export files (WHOOP CSV, Fitbit JSON / CSV, or the plain template). */
export async function importWearableFiles(formData: FormData) {
  const { supabase, t } = await requireAthlete();
  const provider = String(formData.get("provider") ?? "");
  if (!isWearableProvider(provider)) fail(BACK, t.wearables.errors.generic);
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) fail(BACK, t.wearables.errors.noFiles);
  if (files.some((f) => f.size > MAX_FILE_BYTES)) fail(BACK, t.wearables.errors.tooBig);
  const parsed = parseWearableFiles(await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() }))), provider);
  if (parsed.rows.length === 0) fail(BACK, t.wearables.errors.nothing);

  // Importing a file for a provider that is not connected creates a file-based connection (private until shared).
  await supabase.rpc("ensure_my_athlete_record");
  const { data: existing } = await supabase.from("wearable_connections").select("status").eq("provider", provider).maybeSingle();
  if (existing?.status !== "connected") {
    const { error } = await supabase.rpc("wearable_connect", { p_provider: provider, p_source: "file", p_access: null, p_refresh: null, p_expires: null, p_scopes: null, p_external: null });
    if (error) fail(BACK, t.wearables.errors.generic);
  }
  let saved = 0;
  try {
    saved = await saveDays(supabase, provider, parsed.rows);
  } catch {
    fail(BACK, t.wearables.errors.generic);
  }
  revalidatePath(BACK);
  const ignored = parsed.ignored.length ? t.wearables.ignoredFiles.replace("{names}", parsed.ignored.slice(0, 5).join(", ")) : "";
  done(BACK, t.wearables.imported.replace("{n}", String(saved)).replace("{ignored}", ignored).trim());
}
