import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { getCookieLocale, getDictionary } from "./i18n";
import type { OrgMembership, OrgRole, Profile, UserRole } from "./types";

/** Loads the signed-in user and their profile once per request. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    profile = data as Profile | null;
  }
  let org: OrgMembership | null = null;
  if (user) {
    const { data } = await supabase
      .from("organization_members")
      .select("org_id, org_role, organizations(name)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (data) {
      org = { org_id: data.org_id, org_role: data.org_role as OrgRole, org_name: (data.organizations as unknown as { name: string } | null)?.name ?? "" };
    }
  }
  const locale = profile?.locale ?? (await getCookieLocale());
  return { supabase, user, profile, org, locale, t: getDictionary(locale) };
});

/** Requires an onboarded, active account. */
export async function requireProfile() {
  const session = await getSession();
  if (!session.user) redirect("/login");
  if (!session.profile?.role) redirect("/onboarding");
  return { ...session, user: session.user, profile: session.profile as Profile & { role: UserRole } };
}

/** The director manages the team but does not see individual athlete records. */
export function isTeamDirector(org: OrgMembership | null) {
  return org?.org_role === "director";
}

export function isProfessional(role: UserRole | null | undefined) {
  return role != null && role !== "athlete";
}

/**
 * Page-level guard for professional-only screens. This only shapes the UI;
 * the database enforces the same rule on every query.
 */
export async function requireProfessional() {
  const session = await requireProfile();
  if (!isProfessional(session.profile.role)) redirect("/dashboard");
  return session;
}

export async function requireAthlete() {
  const session = await requireProfile();
  if (session.profile.role !== "athlete") redirect("/dashboard");
  return session;
}

/** The athlete record linked to the signed-in athlete account, if any. */
export async function getMyAthleteId(): Promise<string | null> {
  const { supabase, user } = await getSession();
  if (!user) return null;
  const { data } = await supabase.from("athletes").select("id").eq("user_id", user.id).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
