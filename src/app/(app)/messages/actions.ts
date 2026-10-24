"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/auth";
import { done, fail, str, uuid } from "@/lib/forms";
import { fileProblem, toByteaHex } from "@/lib/files/rules";

/** Sends a message (text, a file, or both) to someone the database says the caller may write to. */
export async function sendMessage(formData: FormData) {
  const { supabase, t } = await requireSection("messages");
  const to = uuid(formData, "to");
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;
  const body = str(formData, "body", 4000) ?? (hasFile ? `${t.files.attachment}: ${file.name}`.slice(0, 300) : null);
  if (!to || !body) fail("/messages", t.common.error);
  const back = `/messages?with=${to}`;
  if (hasFile) {
    const problem = fileProblem(file.name, file.size);
    if (problem) fail(back, t.files.errors[problem]);
  }
  const { data: messageId, error } = await supabase.rpc("send_message", { p_to: to, p_body: body });
  if (error) fail(back, error.message.includes("not allowed") ? t.messages.notAllowed : t.common.error);
  if (hasFile && messageId) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: fileError } = await supabase.rpc("add_attachment", { p_kind: "message", p_ref: messageId, p_athlete: null, p_name: file.name, p_data: toByteaHex(bytes) });
    if (fileError) fail(back, t.files.errors.generic);
  }
  revalidatePath("/messages");
  done(back, t.messages.sent);
}
