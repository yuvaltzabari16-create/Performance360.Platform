import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, generateNonce, staticSecurityHeaders } from "./headers";
import { httpsUrl, isHttps, needsHttpsRedirect } from "./https";
import { ruleFor, rateLimitDisabled } from "./policy";
import { MemoryRateLimiter, clientIp } from "./rate-limit";

const limiter = new MemoryRateLimiter();

/**
 * First line of defence, run before anything else in middleware.
 * Returns a response to send straight away (redirect to https, or 429), or null to continue.
 */
export function guardRequest(request: NextRequest): NextResponse | null {
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  if (needsHttpsRedirect({ proto, host })) {
    return NextResponse.redirect(httpsUrl(request.nextUrl), 308);
  }
  if (!rateLimitDisabled()) {
    const result = limiter.hit(clientIp(request.headers), ruleFor(request.method, request.nextUrl.pathname));
    if (!result.allowed) {
      return new NextResponse("Too many requests. Please wait a moment and try again.", {
        status: 429,
        headers: { "Retry-After": String(result.retryAfterSec), "Cache-Control": "no-store" },
      });
    }
  }
  return null;
}

/** Per-request security context: the CSP/nonce handed to Next.js and the headers added to the response. */
export function securityContext(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const https = isHttps(proto);
  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    isDev: process.env.NODE_ENV !== "production",
    upgradeInsecure: https && process.env.NODE_ENV === "production",
    turnstile: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY),
  });
  // Next.js reads the nonce from the request's CSP header and stamps it on its scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  requestHeaders.set("content-security-policy", csp);
  return { requestHeaders, csp, https };
}

/** Adds the CSP and the static security headers to a response. */
export function applySecurityHeaders(response: NextResponse, ctx: { csp: string; https: boolean }) {
  response.headers.set("Content-Security-Policy", ctx.csp);
  for (const [k, v] of Object.entries(staticSecurityHeaders({ https: ctx.https }))) response.headers.set(k, v);
  return response;
}
