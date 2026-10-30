/**
 * A passcode that stands in front of the app when it is served from a website (the page itself is public, but the
 * data in it belongs to whoever uses that browser). Only a salted PBKDF2 hash of the passcode is kept, in this browser.
 * It keeps casual visitors out of the screens; it does not encrypt the data stored by the browser, and there is no
 * recovery: forgetting the passcode means erasing the data.
 */

export interface LockRecord { v: 1; salt: string; hash: string; iterations: number }

const KEY = "performance360-lite-lock";
export const MIN_PASSCODE = 8;
const ITERATIONS = 210_000;

const toHex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b instanceof Uint8Array ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));

export const lockSupported = () => typeof crypto !== "undefined" && !!crypto.subtle && !!crypto.getRandomValues;

async function derive(pass: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return toHex(bits);
}

export const passcodeProblem = (p: string): "short" | null => (p.length < MIN_PASSCODE ? "short" : null);

export async function createLockRecord(pass: string): Promise<LockRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { v: 1, salt: toHex(salt), hash: await derive(pass, salt, ITERATIONS), iterations: ITERATIONS };
}

export async function checkPasscode(rec: LockRecord, pass: string): Promise<boolean> {
  const h = await derive(pass, fromHex(rec.salt), rec.iterations);
  // Same-length hex strings; a plain comparison is fine for a local screen lock.
  return h === rec.hash;
}

export function readLock(): LockRecord | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<LockRecord> | null;
    if (raw && raw.v === 1 && typeof raw.salt === "string" && typeof raw.hash === "string" && typeof raw.iterations === "number" && raw.iterations >= 1000 && raw.iterations <= 5_000_000) return raw as LockRecord;
  } catch { /* unreadable: treated as no passcode */ }
  return null;
}
export function writeLock(rec: LockRecord): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(rec)); return true; } catch { return false; }
}
export function clearLock() { try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ } }

/** After repeated wrong passcodes the screen asks the person to wait: 5 tries, then 30 seconds, doubling. */
export function waitSeconds(failures: number): number {
  if (failures < 5) return 0;
  return Math.min(30 * 2 ** (failures - 5), 15 * 60);
}
