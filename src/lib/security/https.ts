/**
 * Enforces encrypted transport: in production every plain-http request is redirected to https.
 * Local development (localhost) is exempt so the dev server keeps working.
 */

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export interface HttpsCheck {
  /** Value of x-forwarded-proto (set by the hosting proxy) or the URL protocol without the colon. */
  proto: string | null;
  host: string;
  nodeEnv?: string;
}

/** True when the request arrived over plain http on a non-local host in production. */
export function needsHttpsRedirect({ proto, host, nodeEnv = process.env.NODE_ENV }: HttpsCheck): boolean {
  if (nodeEnv !== "production") return false;
  if (LOCAL_HOST.test(host)) return false;
  return (proto ?? "").split(",")[0].trim().toLowerCase() === "http";
}

/** True when the visitor reached us over https (used to decide on HSTS and upgrade-insecure-requests). */
export function isHttps(proto: string | null): boolean {
  return (proto ?? "").split(",")[0].trim().toLowerCase() === "https";
}

/** The https version of a request URL. */
export function httpsUrl(url: URL): URL {
  const next = new URL(url);
  next.protocol = "https:";
  next.port = "";
  return next;
}
