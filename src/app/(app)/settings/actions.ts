"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { bool, done, fail, oneOf, str } from "@/lib/forms";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-categories";
import { MOTION_COOKIE, START_PAGES, TEXT_COOKIE, TEXT_SIZES, TIME_FORMATS, WEEK_STARTS, parsePreferences } from "@/lib/preferences";

const YEAR = 60 * 60 * 24 * 365;

/** Saves part of the stored preferences without touching the rest. */
async function savePreferences(patch: Record<string, unknown>) {
  const { supabase, user, profile } = await requireProfile();
  const next = { ...parsePreferences(profile.preferences), ...patch };
  return supabase.from("profiles").update({ preferences: parsePreferences(next) }).eq("id", user.id);
}

/** Name, phone and job title. */
export async function updateProfile(formData: FormData) {
  const { supabase, user, t } = await requireProfile();
  const fullName = str(formData, "full_name", 120);
  if (!fullName) fail("/settings", t.common.required);
  const { error: e1 } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
  const { error: e2 } = await savePreferences({ phone: str(formData, "phone", 30) ?? "", job_title: str(formData, "job_title", 80) ?? "" });
  if (e1 || e2) fail("/settings", (e1 ?? e2)!.message);
  revalidatePath("/", "layout");
  done("/settings", t.common.saved);
}

/** Language, units, week start, clock and the page to open after sign-in. */
export async function updatePreferences(formData: FormData) {
  const { supabase, user, t } = await requireProfile();
  const locale = oneOf(formData, "locale", ["en", "he"] as const, "en");
  const { error: e1 } = await supabase.from("profiles").update({ locale, units: oneOf(formData, "units", ["metric", "imperial"] as const, "metric") }).eq("id", user.id);
  const { error: e2 } = await savePreferences({
    week_start: oneOf(formData, "week_start", WEEK_STARTS, "auto"),
    time_format: oneOf(formData, "time_format", TIME_FORMATS, "auto"),
    start_page: oneOf(formData, "start_page", START_PAGES, "dashboard"),
  });
  if (e1 || e2) fail("/settings", (e1 ?? e2)!.message);
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
  done("/settings", t.common.saved);
}

/** Text size and reduced motion: kept in cookies so the page is right from the first paint. */
export async function updateDisplay(formData: FormData) {
  const { t } = await requireProfile();
  const jar = await cookies();
  jar.set(TEXT_COOKIE, oneOf(formData, "text_size", TEXT_SIZES, "normal"), { path: "/", maxAge: YEAR, sameSite: "lax" });
  jar.set(MOTION_COOKIE, bool(formData, "reduce_motion") ? "reduce" : "normal", { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
  done("/settings", t.common.saved);
}

/** In-app and email notifications, and which categories are muted. */
export async function updateNotifications(formData: FormData) {
  const { supabase, user, t } = await requireProfile();
  const { error } = await supabase
    .from("profiles")
    .update({
      notification_prefs: {
        in_app: bool(formData, "notif_in_app"),
        email: bool(formData, "notif_email"),
        // Unticked categories are muted.
        muted: NOTIFICATION_CATEGORIES.filter((c) => !bool(formData, `notify_${c}`)),
      },
    })
    .eq("id", user.id);
  if (error) fail("/settings", error.message);
  revalidatePath("/", "layout");
  done("/settings", t.common.saved);
}

/** Starts an email change: the new address is confirmed through a link sent to it. */
export async function changeEmail(formData: FormData) {
  const { supabase, profile, t } = await requireProfile();
  const email = (str(formData, "new_email", 320) ?? "").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("/settings", t.settings.emailInvalid);
  if (email === profile.email.toLowerCase()) fail("/settings", t.settings.emailSame);
  const { error } = await supabase.auth.updateUser({ email });
  if (error) fail("/settings", t.settings.emailFailed);
  done("/settings", t.settings.emailSent);
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
