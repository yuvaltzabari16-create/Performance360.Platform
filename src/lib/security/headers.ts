/**
 * Security response headers and the Content-Security-Policy builder.
 *
 * The CSP is the main defence against XSS: scripts only run when they carry the per-request
 * nonce (Next.js adds it to its own scripts), so injected markup cannot execute code.
 * Pure functions only, so the policy is easy to unit test.
 */

export interface CspOptions {
  /** Random per-request value; scripts without it are blocked. */
  nonce: string;
  /** Supabase project origin, allowed for browser connections. */
  supabaseUrl?: string;
  /** Development needs eval for React refresh and websockets for HMR. */
  isDev?: boolean;
  /** Add `upgrade-insecure-requests` (only meaningful when the site is served over https). */
  upgradeInsecure?: boolean;
  /** Allow the Cloudflare Turnstile bot challenge widget (only when it is configured). */
  turnstile?: boolean;
}

/** Third-party origins the app is allowed to load, with the reason for each. */
export const ALLOWED_ORIGINS = {
  /** Video thumbnails for the exercise library. */
  images: ["https://i.ytimg.com"],
  /** Embedded demonstration videos (privacy-enhanced YouTube domain). */
  frames: ["https://www.youtube-nocookie.com"],
} as const;

const originOf = (url?: string) => {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
};

/** Builds the Content-Security-Policy header value. */
export function buildCsp({ nonce, supabaseUrl, isDev = false, upgradeInsecure = false, turnstile = false }: CspOptions): string {
  const supabase = originOf(supabaseUrl);
  const connect = ["'self'", ...(supabase ? [supabase, supabase.replace(/^http/, "ws")] : []), ...(isDev ? ["ws:", "http://localhost:*"] : [])];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'strict-dynamic' lets nonce-trusted scripts load their own chunks; no inline script without the nonce.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // Tailwind/Next emit small inline style blocks; styles cannot execute code.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...ALLOWED_ORIGINS.images],
    "font-src": ["'self'"],
    "connect-src": connect,
    "frame-src": [...ALLOWED_ORIGINS.frames, ...(turnstile ? ["https://challenges.cloudflare.com"] : [])],
    "media-src": ["'self'", "https:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (upgradeInsecure) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** Headers added to every response besides the CSP. */
export function staticSecurityHeaders({ https }: { https: boolean }): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    // payment=() documents that card entry never happens in this app (external checkout only).
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    // HSTS is only valid over https; it tells browsers to refuse plain http for a year.
    ...(https ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
  };
}

/** A fresh random nonce for one response. */
export function generateNonce(): string {
  return btoa(crypto.randomUUID());
}
