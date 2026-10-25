import { NextResponse } from "next/server";
import { MOCK } from "@/lib/wearables/config";
import { mockRecords } from "@/lib/wearables/mock-data";

/** Test-mode WHOOP sleep collection (WEARABLES_MOCK=1 only); requires a mock bearer token. */
export function GET(request: Request) {
  if (!MOCK) return new NextResponse("Not found", { status: 404 });
  if (!request.headers.get("authorization")?.startsWith("Bearer mock-access")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ records: mockRecords("sleep"), next_token: null });
}
