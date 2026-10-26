import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { whoopConfig } from "@/lib/wearables/config";
import { STATE_COOKIE, STATE_COOKIE_MAX_AGE, makeState } from "@/lib/wearables/server";
import { authorizeUrl } from "@/lib/wearables/whoop";

/** Starts the WHOOP connection: sets a signed one-time state cookie and sends the athlete to WHOOP. A plain GET link. */
export async function GET(request: Request) {
  const { user, profile } = await getSession();
  const back = (msg: string) => NextResponse.redirect(new URL(`/wearables?error=${encodeURIComponent(msg)}`, request.url));
  if (!user) return NextResponse.redirect(new URL("/login?next=%2Fwearables", request.url));
  if (profile?.role !== "athlete") return back("Only athletes can connect a wearable.");
  const cfg = whoopConfig();
  const state = makeState(user.id, "whoop");
  if (!cfg || !state) return back("WHOOP is not set up on this server yet.");
  const res = NextResponse.redirect(authorizeUrl(cfg, state));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: request.url.startsWith("https:"), path: "/api/wearables", maxAge: STATE_COOKIE_MAX_AGE });
  return res;
}
