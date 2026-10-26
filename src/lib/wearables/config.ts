import { parseKey } from "./crypto";

/**
 * Environment for wearable connections. In test mode (WEARABLES_MOCK=1) the app talks to its own fake
 * provider under /api/mock/whoop so the whole flow can be exercised without WHOOP credentials.
 */
export const MOCK = process.env.WEARABLES_MOCK === "1";

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const WHOOP_SCOPES = "offline read:recovery read:sleep read:cycles";

export interface WhoopConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  apiBase: string;
  redirectUri: string;
}

/**
 * Null when live WHOOP is switched off, or its credentials or the token key are missing (the connect button is then
 * disabled and the sync jobs do nothing). Live WHOOP stays off until the operator sets WHOOP_LIVE=1, which is done only
 * after WHOOP has approved the developer app; importing a WHOOP export file works regardless.
 */
export function whoopConfig(): WhoopConfig | null {
  if (!tokenKey()) return null;
  if (MOCK) {
    return {
      clientId: "mock-client", clientSecret: "mock-secret",
      authUrl: `${site()}/api/mock/whoop/oauth/auth`, tokenUrl: `${site()}/api/mock/whoop/oauth/token`,
      apiBase: `${site()}/api/mock/whoop/developer/v2`, redirectUri: `${site()}/api/wearables/whoop/callback`,
    };
  }
  const clientId = process.env.WHOOP_CLIENT_ID?.trim();
  const clientSecret = process.env.WHOOP_CLIENT_SECRET?.trim();
  if (process.env.WHOOP_LIVE !== "1" || !clientId || !clientSecret) return null;
  return {
    clientId, clientSecret,
    authUrl: "https://api.prod.whoop.com/oauth/oauth2/auth", tokenUrl: "https://api.prod.whoop.com/oauth/oauth2/token",
    apiBase: "https://api.prod.whoop.com/developer/v2", redirectUri: `${site()}/api/wearables/whoop/callback`,
  };
}

/** 32-byte key for token encryption and OAuth state signing (WEARABLE_TOKEN_KEY). Test mode has a fixed fallback. */
export function tokenKey(): Buffer | null {
  return parseKey(process.env.WEARABLE_TOKEN_KEY) ?? (MOCK ? Buffer.alloc(32, 7) : null);
}
