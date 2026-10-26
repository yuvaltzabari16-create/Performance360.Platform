"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { done, fail, isUuid, oneOf, str } from "@/lib/forms";
import { IDLE_COOKIE, IDLE_OPTIONS } from "@/lib/security/idle";

// Server actions for the Settings → Security area. Each action re-checks who is calling.

const SETTINGS = "/settings";
const CODE = /^\d{6}$/;

/** Permanently deletes the signed-in account after re-confirming email and password. */
export async function deleteAccount(formData: FormData) {
  const { supabase, profile, t } = await requireProfile();
  const ts = t.settings;
  const typedEmail = (str(formData, "confirm_email", 320) ?? "").toLowerCase();
  const password = formData.get("password");
  if (typedEmail !== profile.email.toLowerCase()) fail(SETTINGS, ts.deleteWrongEmail);
  if (typeof password !== "string" || !password) fail(SETTINGS, ts.deleteWrongPassword);
  // Re-authenticate: a stolen session alone must not be enough to erase an account.
  const { error: authError } = await supabase.auth.signInWithPassword({ email: profile.email, password });
  if (authError) fail(SETTINGS, ts.deleteWrongPassword);
  const { error } = await supabase.rpc("delete_my_account");
  if (error) fail(SETTINGS, error.message.includes("last_director") ? ts.deleteLastDirector : t.common.error);
  await supabase.auth.signOut();
  redirect(`/login?ok=${encodeURIComponent(ts.deleted)}`);
}

/** Saves the automatic sign-out choice for this browser. */
export async function setIdleTimeout(formData: FormData) {
  const { t } = await requireProfile();
  const choice = oneOf(formData, "minutes", IDLE_OPTIONS.map(String) as readonly string[], "60");
  (await cookies()).set(IDLE_COOKIE, choice, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  revalidatePath("/", "layout");
  done(SETTINGS, t.settings.idleSaved);
}

export type EnrollResult = { ok: true; factorId: string; qr: string; secret: string } | { ok: false; error: string };

/** Starts TOTP enrolment: returns the QR code and the manual key to show once. */
export async function enrollTotp(): Promise<EnrollResult> {
  const { supabase, t } = await requireProfile();
  // Abandoned, never-verified setups would otherwise pile up and block a new one.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${crypto.randomUUID().slice(0, 8)}` });
  if (error || !data?.totp) return { ok: false, error: t.settings.twoFactorStartFailed };
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Confirms enrolment with the first code from the app; the factor only counts once this succeeds. */
export async function confirmTotp(factorId: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, t } = await requireProfile();
  if (!isUuid(factorId) || !CODE.test(code)) return { ok: false, error: t.settings.twoFactorInvalid };
  const { data: challenge, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error || !challenge) return { ok: false, error: t.settings.twoFactorStartFailed };
  const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (verifyError) return { ok: false, error: t.settings.twoFactorInvalid };
  revalidatePath(SETTINGS);
  return { ok: true };
}

/** Turns two-factor authentication off (Supabase requires a fully verified session for this). */
export async function disableTotp(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const factorId = str(formData, "factor_id", 64);
  if (!isUuid(factorId)) fail(SETTINGS, t.common.error);
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) fail(SETTINGS, t.common.error);
  done(SETTINGS, t.settings.twoFactorDisabled);
}
