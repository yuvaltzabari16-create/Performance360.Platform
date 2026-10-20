"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { fail, safeNext, str } from "@/lib/forms";
import { siteUrl } from "@/lib/site";

export async function login(formData: FormData) {
  const { t } = await getSession();
  const email = str(formData, "email", 320);
  const password = formData.get("password");
  const next = safeNext(str(formData, "next", 500));
  if (!email || typeof password !== "string" || !password) fail(`/login?next=${encodeURIComponent(next)}`, t.auth.invalidCredentials);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail(`/login?next=${encodeURIComponent(next)}`, t.auth.invalidCredentials);
  redirect(next);
}

export async function signup(formData: FormData) {
  const { t, locale } = await getSession();
  const email = str(formData, "email", 320);
  const password = formData.get("password");
  const fullName = str(formData, "full_name", 120);
  const next = safeNext(str(formData, "next", 500), "/onboarding");
  const back = `/signup?next=${encodeURIComponent(next)}`;
  // New accounts always pass through onboarding first, carrying the original destination.
  const onboard = next.startsWith("/onboarding") ? next : `/onboarding?next=${encodeURIComponent(next)}`;
  if (!email || !fullName) fail(back, t.common.required);
  if (typeof password !== "string" || password.length < 8) fail(back, t.auth.passwordRule);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, locale },
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(onboard)}`,
    },
  });
  if (error) fail(back, error.message);
  // With email confirmation enabled there is no session yet.
  if (!data.session) redirect(`/login?ok=${encodeURIComponent(t.auth.checkEmail)}&next=${encodeURIComponent(onboard)}`);
  redirect(onboard);
}

export async function requestPasswordReset(formData: FormData) {
  const { t } = await getSession();
  const email = str(formData, "email", 320);
  if (email) {
    const supabase = await createClient();
    // Same response whether or not the account exists (no account enumeration).
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await siteUrl()}/auth/callback?next=/auth/update-password`,
    });
  }
  redirect(`/forgot-password?ok=${encodeURIComponent(t.auth.resetSent)}`);
}

export async function updatePassword(formData: FormData) {
  const { t, user } = await getSession();
  if (!user) redirect("/login");
  const password = formData.get("password");
  if (typeof password !== "string" || password.length < 8) fail("/auth/update-password", t.auth.passwordRule);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) fail("/auth/update-password", error.message);
  redirect(`/settings?ok=${encodeURIComponent(t.auth.passwordUpdated)}`);
}
