"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { done, fail, safeNext, str, uuid } from "@/lib/forms";
import { contentProblem, fileProblem, isAttachmentKind, toByteaHex } from "@/lib/files/rules";

/** Uploads one file to a record (message, injury, GPS session, athlete testing / documents, program). */
export async function uploadAttachment(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const back = safeNext(str(formData, "back", 300), "/dashboard");
  const kind = str(formData, "kind", 20);
  const ref = uuid(formData, "ref_id");
  const athlete = uuid(formData, "athlete_id");
  const file = formData.get("file");
  if (!isAttachmentKind(kind) || !ref) fail(back, t.common.error);
  if (!(file instanceof File)) fail(back, t.files.errors.empty);
  const problem = fileProblem(file.name, file.size);
  if (problem) fail(back, t.files.errors[problem]);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mismatch = contentProblem(file.name, bytes);
  if (mismatch) fail(back, t.files.errors[mismatch]);
  const { error } = await supabase.rpc("add_attachment", { p_kind: kind, p_ref: ref, p_athlete: athlete, p_name: file.name, p_data: toByteaHex(bytes) });
  if (error) fail(back, t.files.errors.generic);
  revalidatePath(back.split("?")[0]);
  done(back, t.files.uploaded);
}

export async function removeAttachment(formData: FormData) {
  const { supabase, t } = await requireProfile();
  const back = safeNext(str(formData, "back", 300), "/dashboard");
  const id = uuid(formData, "id");
  if (!id) fail(back, t.common.error);
  const { error } = await supabase.rpc("remove_attachment", { p_id: id });
  if (error) fail(back, t.files.errors.generic);
  revalidatePath(back.split("?")[0]);
  done(back, t.files.removed);
}
