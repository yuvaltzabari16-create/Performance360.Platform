import { NextResponse } from "next/server";
import { isUuid } from "@/lib/forms";
import { fromByteaHex } from "@/lib/files/rules";
import { createClient } from "@/lib/supabase/server";

/** Downloads one attachment. Row-level security decides who may read it; it is always sent as a download. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Unauthorized", { status: 401 });
  const { data } = await supabase.from("attachments").select("file_name, mime_type, data").eq("id", id).maybeSingle();
  if (!data) return new NextResponse("Not found", { status: 404 });
  const bytes = fromByteaHex(data.data as string);
  const safeName = encodeURIComponent(data.file_name as string).replace(/['()]/g, escape);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": data.mime_type as string,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${safeName}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
