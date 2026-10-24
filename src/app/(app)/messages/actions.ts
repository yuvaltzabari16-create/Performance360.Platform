"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/auth";
import { done, fail, str, uuid } from "@/lib/forms";

/** Sends a message to someone the database says the caller may write to. */
export async function sendMessage(formData: FormData) {
  const { supabase, t } = await requireSection("messages");
  const to = uuid(formData, "to");
  const body = str(formData, "body", 4000);
  if (!to || !body) fail("/messages", t.common.error);
  const { error } = await supabase.rpc("send_message", { p_to: to, p_body: body });
  if (error) fail(`/messages?with=${to}`, error.message.includes("not allowed") ? t.messages.notAllowed : t.common.error);
  revalidatePath("/messages");
  done(`/messages?with=${to}`, t.messages.sent);
}
