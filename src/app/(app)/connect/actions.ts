"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { bool, fail, str } from "@/lib/forms";

const CODE_RE = /^P360-[A-Z0-9]{6}$/;

export async function connectWithCode(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const code = (str(formData, "code", 20) ?? "").toUpperCase();
  if (!CODE_RE.test(code)) fail("/connect", t.connect.invalid);
  const { data, error } = await supabase.rpc("connect_with_coach_code", {
    p_code: code,
    p_confirm_transfer: bool(formData, "confirm_transfer"),
  });
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
