import { NextResponse } from "next/server";
import { MOCK } from "@/lib/wearables/config";

/** Test-mode stand-in for WHOOP's consent screen: approves immediately. Does not exist unless WEARABLES_MOCK=1. */
export function GET(request: Request) {
  if (!MOCK) return new NextResponse("Not found", { status: 404 });
  const u = new URL(request.url);
  const redirect = u.searchParams.get("redirect_uri");
  const state = u.searchParams.get("state");
  if (!redirect || !state) return new NextResponse("Bad request", { status: 400 });
  const target = new URL(redirect);
  if (u.searchParams.get("deny")) target.searchParams.set("error", "access_denied");
  else target.searchParams.set("code", "mock-code");
  target.searchParams.set("state", state);
  return NextResponse.redirect(target);
}
