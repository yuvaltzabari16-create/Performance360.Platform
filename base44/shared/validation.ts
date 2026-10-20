// Pure input-validation helpers shared by backend functions.
// No SDK imports: everything here is unit-tested with `bun test`.

export class ValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(value: unknown): boolean {
  const v = normalizeEmail(value);
  return v.length > 3 && v.length <= 254 && EMAIL_RE.test(v);
}

/** Case-insensitive email equality; empty values never match. */
export function sameEmail(a: unknown, b: unknown): boolean {
  const x = normalizeEmail(a);
  return x !== '' && x === normalizeEmail(b);
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export function requireId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ID_RE.test(value)) {
    throw new ValidationError(`${field} is required and must be a valid id`);
  }
  return value;
}

export function optionalText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new ValidationError(`${field} must be text`);
  const v = value.trim();
  if (v.length > max) throw new ValidationError(`${field} must be at most ${max} characters`);
  return v || undefined;
}

export function requireText(value: unknown, field: string, max: number): string {
  const v = optionalText(value, field, max);
  if (!v) throw new ValidationError(`${field} is required`);
  return v;
}

/** Finite number within [min, max]; strings like "12.5" are accepted. */
export function optionalNumber(value: unknown, field: string, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new ValidationError(`${field} must be a number`);
  if (n < min || n > max) throw new ValidationError(`${field} must be between ${min} and ${max}`);
  return n;
}

export function requireNumber(value: unknown, field: string, min: number, max: number): number {
  const n = optionalNumber(value, field, min, max);
  if (n === undefined) throw new ValidationError(`${field} is required`);
  return n;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Validates a calendar date string (YYYY-MM-DD) that actually exists. */
export function isValidDateString(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2200) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function requireDate(value: unknown, field: string): string {
  if (!isValidDateString(value)) throw new ValidationError(`${field} must be a date in YYYY-MM-DD format`);
  return value as string;
}

/**
 * Rejects dates more than `toleranceDays` after `today` (a YYYY-MM-DD string).
 * Tolerance covers users whose local date is ahead of the server's UTC date.
 */
export function requireNotFuture(date: string, today: string, field: string, toleranceDays = 1): string {
  const d = Date.parse(date + 'T00:00:00Z');
  const t = Date.parse(today + 'T00:00:00Z');
  if (d - t > toleranceDays * 86400000) throw new ValidationError(`${field} cannot be in the future`);
  return date;
}

export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}
