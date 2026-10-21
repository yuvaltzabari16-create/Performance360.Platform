// Username + PIN logins for players. Accounts are created by the `player-login` edge function;
// under the hood the player's auth email is `${username}@${PLAYER_DOMAIN}` (never mailed).
import { supabase } from "./supabase";

export const PLAYER_DOMAIN = "player.performance360.example.com";
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
export const PIN_RE = /^\d{6}$/;

export interface PlayerLogin { player_id: string; club_id: string; user_id: string; username: string; created_at: string; pin_reset_at: string | null }

export const normalizeUsername = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ".");
export const playerEmail = (username: string) => `${normalizeUsername(username)}@${PLAYER_DOMAIN}`;
export const isPlayerEmail = (email: string | undefined | null) => !!email && email.endsWith("@" + PLAYER_DOMAIN);

export function isWeakPin(pin: string) {
  if (/^(\d)\1{5}$/.test(pin)) return true;
  const d = [...pin].map(Number);
  const step = d[1] - d[0];
  return Math.abs(step) === 1 && d.every((x, i) => i === 0 || x - d[i - 1] === step);
}

export function randomPin(): string {
  for (;;) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    const pin = String(a[0] % 1_000_000).padStart(6, "0");
    if (!isWeakPin(pin)) return pin;
  }
}

// Hebrew → Latin, enough to suggest a readable username from a Hebrew name.
const HE: Record<string, string> = {
  "א": "a", "ב": "b", "ג": "g", "ד": "d", "ה": "h", "ו": "v", "ז": "z", "ח": "ch", "ט": "t", "י": "y", "כ": "k", "ך": "k", "ל": "l", "מ": "m", "ם": "m",
  "נ": "n", "ן": "n", "ס": "s", "ע": "a", "פ": "p", "ף": "f", "צ": "tz", "ץ": "tz", "ק": "k", "ר": "r", "ש": "sh", "ת": "t",
};
export function suggestUsername(fullName: string, shirt?: number | null): string {
  const latin = [...fullName.trim().toLowerCase()].map((c) => HE[c] ?? c).join("");
  const parts = latin.split(/[^a-z0-9]+/).filter(Boolean);
  let u = parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0] ?? "player";
  u = u.replace(/^[^a-z0-9]+/, "").slice(0, 26);
  if (u.length < 3) u = (u + "player").slice(0, 8);
  return shirt != null && shirt !== undefined ? `${u}${shirt}`.slice(0, 30) : u;
}

/** Calls the edge function; throws Error(code) with the server's error code (username_taken, bad_pin, …). */
export async function playerLoginAction(body: { action: "create" | "reset_pin" | "remove"; player_id: string; username?: string; pin?: string }) {
  const { data, error } = await supabase.functions.invoke("player-login", { body });
  if (error) {
    let code = "failed";
    try { const j = await (error as { context?: Response }).context?.json(); code = j?.error ?? code; } catch { /* not JSON */ }
    if (data?.error) code = data.error;
    throw new Error(code);
  }
  if (data?.error) throw new Error(data.error);
  return data as { username?: string; ok?: boolean };
}
