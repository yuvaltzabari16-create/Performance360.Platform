import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/forgot-password", "/auth", "/join", "/setup", "/accessibility", "/disclosure", "/licenses", "/privacy", "/terms", "/api/health", "/api/mock"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/")));
}

/** Refreshes the auth session cookie and redirects anonymous visitors away from private pages. */
export async function updateSession(request: NextRequest, requestHeaders?: Headers) {
  const forward = requestHeaders ? { headers: requestHeaders } : undefined;
  if (!isSupabaseConfigured) {
    if (request.nextUrl.pathname === "/setup") return NextResponse.next({ request: forward });
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request: forward ?? request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: forward ?? request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  // A password-only session of an account with two-factor authentication must not reach the app:
  // everything except the verification step itself is sent to it.
  if (user && !pathname.startsWith("/login/mfa") && !pathname.startsWith("/auth/callback")) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const url = request.nextUrl.clone();
      url.pathname = "/login/mfa";
      url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
      return NextResponse.redirect(url);
    }
  }
  return response;
}
