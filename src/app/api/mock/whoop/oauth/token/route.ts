import { NextResponse } from "next/server";
import { MOCK } from "@/lib/wearables/config";

/** Test-mode token endpoint (WEARABLES_MOCK=1 only). */
export async function POST(request: Request) {
  if (!MOCK) return new NextResponse("Not found", { status: 404 });
  const form = new URLSearchParams(await request.text());
  const grant = form.get("grant_type");
  if (grant === "authorization_code" && form.get("code") !== "mock-code") return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  if (grant === "refresh_token" && !form.get("refresh_token")?.startsWith("mock-refresh")) return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  return NextResponse.json({ access_token: `mock-access-${Date.now()}`, refresh_token: "mock-refresh-1", expires_in: 3600, scope: "offline read:recovery read:sleep read:cycles", token_type: "bearer" });
}
