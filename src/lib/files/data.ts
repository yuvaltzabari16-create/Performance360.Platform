import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttachmentKind } from "./rules";

export interface AttachmentRow {
  id: string;
  kind: AttachmentKind;
  ref_id: string;
  file_name: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
}

/** File list (never the file contents) for records of one kind. Row-level security decides what is visible. */
export async function loadAttachments(supabase: SupabaseClient, kind: AttachmentKind, refIds: string[]): Promise<AttachmentRow[]> {
  if (refIds.length === 0) return [];
  const { data } = await supabase
    .from("attachments")
    .select("id, kind, ref_id, file_name, size_bytes, uploaded_by, created_at")
    .eq("kind", kind)
    .in("ref_id", refIds)
    .order("created_at", { ascending: true })
    .limit(500);
  return (data ?? []) as AttachmentRow[];
}
