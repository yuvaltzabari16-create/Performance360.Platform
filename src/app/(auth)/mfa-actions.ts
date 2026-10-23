"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fail, safeNext, str } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/** Second step of sign-in: checks the 6-digit authenticator code and upgrades the session. */
export async function verifyLoginMfa(formData: FormData) {
  const { t } = await getSession();
  const next = safeNext(str(formData, "next", 500));
  const back = `/login/mfa?next=${encodeURIComponent(next)}`;
  const code = str(formData, "code", 12)?.replace(/\s/g, "") ?? "";
  if (!/^\d{6}$/.test(code)) fail(back, t.auth.mfaInvalid);
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (!factor) redirect(next);
  const { data: challenge, error } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (error || !challenge) fail(back, t.auth.mfaInvalid);
  const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
  if (verifyError) fail(back, t.auth.mfaInvalid);
  redirect(next);
}
