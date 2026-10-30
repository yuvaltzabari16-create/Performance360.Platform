"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fail, safeNext, str } from "@/lib/forms";

/** Athlete accounts. Staff come in through the academy (create it, or join with a staff invitation). */
export async function completeOnboarding(formData: FormData) {
  const { supabase, user, t } = await getSession();
  if (!user) redirect("/login");
  const next = safeNext(str(formData, "next", 500));
  const back = `/onboarding?type=athlete&next=${encodeURIComponent(next)}`;
  const fullName = str(formData, "full_name", 120);
  if (!fullName) fail(back, t.common.required);
  // The database function validates and stores the role.
  const { error } = await supabase.rpc("complete_onboarding", { p_role: "athlete", p_full_name: fullName });
  if (error) fail(back, error.message);
  redirect(next === "/onboarding" ? "/dashboard" : next);
}

/** Team account: the creator becomes the director. */
export async function createTeam(formData: FormData) {
  const { supabase, user, t } = await getSession();
  if (!user) redirect("/login");
  const back = "/onboarding?type=team&mode=create";
  const name = str(formData, "team_name", 120);
  const fullName = str(formData, "full_name", 120);
  if (!name || !fullName) fail(back, t.common.required);
  const { error } = await supabase.rpc("create_organization", { p_name: name, p_sport: str(formData, "sport", 80), p_full_name: fullName });
  if (error) fail(back, error.message);
  redirect(`/team?ok=${encodeURIComponent(t.team.created)}`);
}

/** Team staff joining with a single-use invitation code. */
export async function joinTeam(formData: FormData) {
  const { supabase, user, t } = await getSession();
  if (!user) redirect("/login");
  const code = (str(formData, "code", 20) ?? "").toUpperCase();
  const back = `/onboarding?type=team&mode=join${code ? `&code=${code}` : ""}`;
  if (!/^STAFF-[A-Z0-9]{6}$/.test(code)) fail(back, t.onboarding.invalidStaffCode);
  const { data, error } = await supabase.rpc("join_organization", { p_code: code, p_full_name: str(formData, "full_name", 120) });
  if (error) fail(back, error.message);
  switch (data as string) {
    case "joined":
      redirect(`/dashboard?ok=${encodeURIComponent(t.team.joined)}`);
    case "already_member":
      fail(back, t.onboarding.alreadyMember);
    case "not_allowed":
      fail(back, t.onboarding.notAllowed);
    default:
      fail(back, t.onboarding.invalidStaffCode);
  }
}
