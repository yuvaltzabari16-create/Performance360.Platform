import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Liveness check for the hosting platform and uptime monitors. Reveals nothing beyond "up" and whether setup is complete. */
export function GET() {
  return NextResponse.json({ status: "ok", configured: isSupabaseConfigured }, { headers: { "Cache-Control": "no-store" } });
}
