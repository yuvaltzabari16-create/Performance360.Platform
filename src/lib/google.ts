/**
 * "Continue with Google" is shown only when the deployment turns it on (NEXT_PUBLIC_GOOGLE_LOGIN=1) after the Google
 * provider has been set up in Supabase. Passwords stay available unless NEXT_PUBLIC_PASSWORD_LOGIN=0.
 */
export const googleLoginEnabled = () => process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";
export const passwordLoginEnabled = () => process.env.NEXT_PUBLIC_PASSWORD_LOGIN !== "0";

/** True for an account that signed in with Google and has not accepted the terms yet (it never saw a sign-up form). */
export const needsTermsAcceptance = (user: { app_metadata?: { provider?: string } } | null, profile: { terms_version?: string | null } | null) =>
  user?.app_metadata?.provider === "google" && !profile?.terms_version;
