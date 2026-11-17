/**
 * Keeps what a person typed when a form submission fails.
 *
 * Server actions report failure by redirecting back with `?error=…` (see `fail()` in forms.ts), which reloads
 * the page and would empty the form. Just before submitting, the browser keeps the visible field values for that
 * page in sessionStorage (this tab only); if the page comes back with an error, they are put back and the copy is
 * deleted. Passwords, one-time codes, hidden fields and files are never kept.
 */

export const FORM_MEMORY_KEY = "p360.form-memory";

/** Input types whose values are never stored. */
const NEVER_TYPES = new Set(["password", "hidden", "file", "submit", "button", "reset", "image"]);
/** Field names that hold secrets or one-time values, whatever their input type. */
const NEVER_NAMES = /pass|token|code|otp|secret|csrf|captcha|turnstile|cf-/i;

export interface FieldValue {
  name: string;
  type: string;
  value: string;
  checked?: boolean;
}

export interface FormMemory {
  /** Page the form was on (pathname only). */
  path: string;
  /** Index of the form on that page, so two forms on one page don't mix. */
  form: number;
  fields: FieldValue[];
  /** Time saved; old entries are ignored. */
  at: number;
}

/** Entries older than this are not restored (a stale tab coming back later). */
export const MAX_AGE_MS = 10 * 60 * 1000;

/** Whether a field may be stored at all. */
export function keepable(field: { name: string; type: string; dataset?: Record<string, string | undefined> }): boolean {
  if (!field.name || NEVER_TYPES.has(field.type) || NEVER_NAMES.test(field.name)) return false;
  return field.dataset?.noMemory === undefined;
}

/** Fields worth storing, from the form's controls in order. */
export function pickFields(fields: { name: string; type: string; value: string; checked?: boolean; dataset?: Record<string, string | undefined> }[]): FieldValue[] {
  return fields
    .filter(keepable)
    .map((f) => (f.type === "checkbox" || f.type === "radio" ? { name: f.name, type: f.type, value: f.value, checked: Boolean(f.checked) } : { name: f.name, type: f.type, value: f.value }));
}

/** True when the URL's query says the last submission failed. */
export function failedSubmission(search: string): boolean {
  return new URLSearchParams(search).has("error");
}

/** The stored entry to restore for this page, or null. */
export function entryToRestore(raw: string | null, path: string, search: string, now = Date.now()): FormMemory | null {
  if (!raw || !failedSubmission(search)) return null;
  try {
    const entry = JSON.parse(raw) as FormMemory;
    if (entry.path !== path || !Array.isArray(entry.fields) || now - entry.at > MAX_AGE_MS) return null;
    return entry;
  } catch {
    return null;
  }
}
