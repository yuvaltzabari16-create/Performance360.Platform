"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fail, safeNext, str } from "@/lib/forms";
import { TERMS_VERSION } from "@/lib/legal/operator";

export async function acceptTerms(formData: FormData) {
  const { supabase, user, t } = await getSession();
  const next = safeNext(str(formData, "next", 500), "/onboarding");
  const back = `/auth/terms?next=${encodeURIComponent(next)}`;
  if (!user) redirect("/login");
  if (formData.get("accept_terms") !== "on") fail(back, t.auth.acceptRequired);
  const { error } = await supabase.rpc("accept_terms", { p_version: TERMS_VERSION });
  if (error) fail(back, error.message);
  redirect(next);
}
