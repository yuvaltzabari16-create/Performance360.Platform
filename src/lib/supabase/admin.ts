import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for scheduled server jobs only (never for a request made by a person).
 * It bypasses row-level security, so use it through the narrow service-only database functions.
 */
export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
