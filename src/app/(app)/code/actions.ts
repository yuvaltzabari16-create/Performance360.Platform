"use server";

import { revalidatePath } from "next/cache";
import { requireProfessional } from "@/lib/auth";
import { done, fail } from "@/lib/forms";

export async function regenerateCode() {
  const { supabase, t } = await requireProfessional();
  const { error } = await supabase.rpc("regenerate_coach_code");
  if (error) fail("/code", error.message);
  revalidatePath("/code");
  done("/code", t.common.saved);
}

export async function revokeCode() {
  const { supabase, t } = await requireProfessional();
  const { error } = await supabase.rpc("revoke_coach_code");
  if (error) fail("/code", error.message);
  revalidatePath("/code");
  done("/code", t.common.saved);
}
