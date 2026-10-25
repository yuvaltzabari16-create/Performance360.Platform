import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { STATE_COOKIE, connectWhoop, readState } from "@/lib/wearables/server";

/** WHOOP sends the athlete back here with a code. The state must match the cookie and this user. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const { supabase, user, t } = await getSession();
  const fail = (msg: string) => {
    const res = NextResponse.redirect(new URL(`/wearables?error=${encodeURIComponent(msg)}`, request.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/wearables" });
    return res;
  };
  if (!user) return NextResponse.redirect(new URL("/login?next=%2Fwearables", request.url));
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  const saved = (await cookies()).get(STATE_COOKIE)?.value;
  if (url.searchParams.get("error")) return fail(t.wearables.errors.denied);
  if (!code || !saved || saved !== state || !readState(state, user.id, "whoop")) return fail(t.wearables.errors.state);
  // Athletes created through the invitation flow already have a record; others get one now.
  await supabase.rpc("ensure_my_athlete_record");
  const result = await connectWhoop(supabase, code);
  if (!result.ok) return fail(t.wearables.errors.connect);
  const res = NextResponse.redirect(new URL(`/wearables?ok=${encodeURIComponent(t.wearables.connected)}`, request.url));
  res.cookies.delete({ name: STATE_COOKIE, path: "/api/wearables" });
  return res;
}
