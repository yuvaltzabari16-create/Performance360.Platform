"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/forms";
import { getSession } from "@/lib/auth";

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale") === "he" ? "he" : "en";
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ locale }).eq("id", user.id);
  // Return to the page the switch was used on (same-origin path only).
  let back = formData.get("next") as string | null;
  if (!back) {
    const referer = (await headers()).get("referer");
    try {
      if (referer) back = new URL(referer).pathname + new URL(referer).search;
    } catch {}
  }
  redirect(safeNext(back, "/"));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Automatic sign-out after inactivity: ends the session and explains why on the login page. */
export async function signOutIdle() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { t } = await getSession();
  redirect(`/login?ok=${encodeURIComponent(t.settings.idleSignedOut)}`);
}
