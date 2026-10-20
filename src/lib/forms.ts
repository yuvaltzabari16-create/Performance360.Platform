import { redirect } from "next/navigation";

// Form helpers for server actions. Values arrive as strings from FormData;
// these normalise them before the database validates them again.

export function str(fd: FormData, key: string, max = 5000): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function num(fd: FormData, key: string): number | null {
  const v = str(fd, key, 50);
  if (v == null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function int(fd: FormData, key: string): number | null {
  const n = num(fd, key);
  return n == null ? null : Math.round(n);
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function lines(fd: FormData, key: string): string[] {
  return (str(fd, key) ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
}

export function csv(fd: FormData, key: string): string[] {
  return (str(fd, key) ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 30);
}

export function oneOf<T extends string>(fd: FormData, key: string, allowed: readonly T[], fallback: T): T {
  const v = str(fd, key, 100);
  return (allowed as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuid(fd: FormData, key: string): string | null {
  const v = str(fd, key, 64);
  return v && UUID_RE.test(v) ? v : null;
}
export function isUuid(v: string | null | undefined): v is string {
  return Boolean(v && UUID_RE.test(v));
}

/** Redirect back with a message shown by <FlashMessage>. */
export function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}
export function done(path: string, message = "saved"): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(message)}`);
}

/** Only allow same-site relative redirects (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
