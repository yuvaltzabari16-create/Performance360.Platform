import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/forms";
import { needsTermsAcceptance } from "@/lib/google";
import { isLoginRole, matchesLoginRole } from "@/lib/login-roles";
import type { OrgRole, UserRole } from "@/lib/types";

// Handles email confirmation, magic links, password-reset links and the return from Google.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }
  if (!ok) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("The link is invalid or has expired.")}`);

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (user) {
    const [{ data: prof }, { data: member }] = await Promise.all([
      supabase.from("profiles").select("role, terms_version").eq("id", user.id).maybeSingle(),
      supabase.from("organization_members").select("org_role").eq("user_id", user.id).eq("status", "active").maybeSingle(),
    ]);
    // Google accounts have no sign-up form: they accept the terms first, then choose what they are on the onboarding page.
    if (needsTermsAcceptance(user, prof)) return NextResponse.redirect(`${origin}/auth/terms?next=${encodeURIComponent(prof?.role ? next : `/onboarding?next=${encodeURIComponent(next)}`)}`);
    // A chosen login option ("Sign in as ...") must match the account, as with a password.
    const as = searchParams.get("as");
    if (isLoginRole(as) && prof?.role && !matchesLoginRole(as, prof.role as UserRole, (member?.org_role as OrgRole | null) ?? null)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?as=${as}&error=${encodeURIComponent("This account does not match the login option you chose. Pick the matching option, or sign in with \"Any account\".")}`);
    }
    // Two-step verification applies to Google sign-ins too.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return NextResponse.redirect(`${origin}/login/mfa?next=${encodeURIComponent(prof?.role ? next : `/onboarding?next=${encodeURIComponent(next)}`)}`);
    if (!prof?.role && next === "/dashboard") return NextResponse.redirect(`${origin}/onboarding`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
