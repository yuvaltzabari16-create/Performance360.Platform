"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { bool, done, fail, oneOf, str } from "@/lib/forms";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-categories";

export async function updateSettings(formData: FormData) {
  const { supabase, user, t } = await requireProfile();
  const fullName = str(formData, "full_name", 120);
  if (!fullName) fail("/settings", t.common.required);
  const locale = oneOf(formData, "locale", ["en", "he"] as const, "en");
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      locale,
      units: oneOf(formData, "units", ["metric", "imperial"] as const, "metric"),
      notification_prefs: {
        in_app: bool(formData, "notif_in_app"),
        email: bool(formData, "notif_email"),
        // Unticked categories are muted.
        muted: NOTIFICATION_CATEGORIES.filter((c) => !bool(formData, `notify_${c}`)),
      },
    })
    .eq("id", user.id);
  if (error) fail("/settings", error.message);
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
  done("/settings", t.common.saved);
}

/** Ends every session of this account on every device, including this one. */
export async function signOutEverywhere() {
  const { supabase } = await requireProfile();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}

export async function deactivateAccount() {
  const { supabase } = await requireProfile();
  await supabase.rpc("deactivate_my_account");
  await supabase.auth.signOut();
  redirect("/login");
}
