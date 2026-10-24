"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { fail, safeNext, str } from "@/lib/forms";
import { isLoginRole, matchesLoginRole } from "@/lib/login-roles";
import { siteUrl } from "@/lib/site";
import type { OrgRole, UserRole } from "@/lib/types";
import { verifyBotGuard } from "@/lib/security/bot-guard";
import { clientIp } from "@/lib/security/rate-limit";
import { headers } from "next/headers";

/** Rejects bot submissions (honeypot, time trap, optional challenge). Redirects back with a generic message. */
async function requireHuman(formData: FormData, back: string, message: string) {
  const result = await verifyBotGuard(formData, clientIp(await headers()));
  if (!result.ok) fail(back, message);
}

export async function login(formData: FormData) {
  const { t } = await getSession();
  const email = str(formData, "email", 320);
  const password = formData.get("password");
  const next = safeNext(str(formData, "next", 500));
  if (!email || typeof password !== "string" || !password) fail(`/login?next=${encodeURIComponent(next)}`, t.auth.invalidCredentials);
  await requireHuman(formData, `/login?next=${encodeURIComponent(next)}`, t.auth.botBlocked);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail(`/login?next=${encodeURIComponent(next)}`, t.auth.invalidCredentials);
  // A chosen login option must match the account; otherwise the session is closed again.
  const chosen = str(formData, "as", 30);
  if (isLoginRole(chosen)) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    const [{ data: prof }, { data: member }] = uid
      ? await Promise.all([
          supabase.from("profiles").select("role").eq("id", uid).maybeSingle(),
          supabase.from("organization_members").select("org_role").eq("user_id", uid).eq("status", "active").maybeSingle(),
        ])
      : [{ data: null }, { data: null }];
    if (!matchesLoginRole(chosen, (prof?.role as UserRole | null) ?? null, (member?.org_role as OrgRole | null) ?? null)) {
      await supabase.auth.signOut();
      const label = chosen === "athlete" || chosen === "personal_trainer" ? t.roles[chosen] : t.orgRoles[chosen];
      fail(`/login?as=${chosen}&next=${encodeURIComponent(next)}`, t.auth.roleMismatch.replace("{role}", label));
    }
  }
  // Accounts with two-factor authentication must pass the second step before reaching the app.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect(`/login/mfa?next=${encodeURIComponent(next)}`);
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
  await requireHuman(formData, back, t.auth.botBlocked);
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
  await requireHuman(formData, "/forgot-password", t.auth.botBlocked);
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
