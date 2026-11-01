import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/forms";
import { googleLoginEnabled } from "@/lib/google";
import { isLoginRole } from "@/lib/login-roles";
import { siteUrl } from "@/lib/site";

// Starts "Continue with Google". It is a plain link (GET), not a form post, so the browser may follow the redirect to Google.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  if (!googleLoginEnabled()) return NextResponse.redirect(`${origin}/login`);
  const next = safeNext(searchParams.get("next"));
  const as = searchParams.get("as");
  const callback = new URL("/auth/callback", await siteUrl());
  callback.searchParams.set("next", next);
  if (isLoginRole(as)) callback.searchParams.set("as", as);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString(), queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Google sign-in is not available right now.")}`);
  return NextResponse.redirect(data.url);
}
