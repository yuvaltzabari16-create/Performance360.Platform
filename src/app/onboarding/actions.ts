"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fail, safeNext, str } from "@/lib/forms";
import { ONBOARDING_ROLES, type UserRole } from "@/lib/types";

export async function completeOnboarding(formData: FormData) {
  const { supabase, user, t } = await getSession();
  if (!user) redirect("/login");
  const next = safeNext(str(formData, "next", 500));
  const back = `/onboarding?next=${encodeURIComponent(next)}`;
  const role = str(formData, "role", 40) as UserRole | null;
  const fullName = str(formData, "full_name", 120);
  if (!role || !ONBOARDING_ROLES.includes(role) || !fullName) fail(back, t.common.required);
  // Role assignment is validated and stored by the database function, not the client.
  const { error } = await supabase.rpc("complete_onboarding", { p_role: role, p_full_name: fullName });
  if (error) fail(back, error.message);
  redirect(next === "/onboarding" ? "/dashboard" : next);
}
