/**
 * "Continue with Google" is shown only when the deployment turns it on (NEXT_PUBLIC_GOOGLE_LOGIN=1) after the Google
 * provider has been set up in Supabase. Passwords stay available unless NEXT_PUBLIC_PASSWORD_LOGIN=0.
 */
export const googleLoginEnabled = () => process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";
export const passwordLoginEnabled = () => process.env.NEXT_PUBLIC_PASSWORD_LOGIN !== "0";

/** "Email me a sign-in code" is shown only when the deployment turns it on (NEXT_PUBLIC_EMAIL_CODE_LOGIN=1) after the email templates carry the code. */
export const emailCodeEnabled = () => process.env.NEXT_PUBLIC_EMAIL_CODE_LOGIN === "1";

/**
 * True for an account created without the sign-up form (Google, or an email code) that has not accepted the terms yet.
 * Password accounts are not asked: they accepted on the sign-up form.
 */
export const needsTermsAcceptance = (
  user: { app_metadata?: { provider?: string }; user_metadata?: { otp_signup?: unknown } } | null,
  profile: { terms_version?: string | null } | null,
) => !profile?.terms_version && (user?.app_metadata?.provider === "google" || user?.user_metadata?.otp_signup === true);
