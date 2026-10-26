"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { bool, fail, str } from "@/lib/forms";

const COACH_RE = /^P360-[A-Z0-9]{6}$/;
const TEAM_RE = /^TEAM-[A-Z0-9]{6}$/;

export async function connectWithCode(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const code = (str(formData, "code", 20) ?? "").toUpperCase();
  if (!COACH_RE.test(code) && !TEAM_RE.test(code)) fail("/connect", t.connect.invalid);
  const { data, error } = TEAM_RE.test(code)
    ? await supabase.rpc("connect_with_org_code", { p_code: code })
    : await supabase.rpc("connect_with_coach_code", { p_code: code, p_confirm_transfer: bool(formData, "confirm_transfer") });
  if (error) fail(`/connect?code=${code}`, t.common.error);
  switch (data as string) {
    case "connected":
      revalidatePath("/", "layout");
      redirect(`/connect?ok=${encodeURIComponent(t.connect.connected)}`);
    case "already_connected":
      redirect(`/connect?ok=${encodeURIComponent(t.connect.already)}`);
    case "needs_transfer_confirmation":
      redirect(`/connect?code=${code}&transfer=1`);
    case "not_athlete":
      fail("/connect", t.connect.notAthlete);
    default:
      fail("/connect", t.connect.invalid);
  }
}

export async function leaveTeamAsAthlete(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const org = str(formData, "org_id", 64);
  if (!org || !/^[0-9a-f-]{36}$/i.test(org)) fail("/connect", t.common.notFound);
  const { error } = await supabase.rpc("leave_org_as_athlete", { p_org: org });
  if (error) fail("/connect", t.common.notAllowed);
  revalidatePath("/", "layout");
  redirect(`/connect?ok=${encodeURIComponent(t.team.left)}`);
}
