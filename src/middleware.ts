import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { applySecurityHeaders, guardRequest, securityContext } from "@/lib/security";

/**
 * Request pipeline: transport + flood protection, then the auth session, then security headers.
 * Each step lives in its own module so it can be tested and changed on its own.
 */
export async function middleware(request: NextRequest) {
  const early = guardRequest(request);
  if (early) return early;
  const ctx = securityContext(request);
  const response = await updateSession(request, ctx.requestHeaders);
  return applySecurityHeaders(response, ctx);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
