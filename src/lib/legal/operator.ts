/**
 * Who operates the service, for the legal pages and the version of the legal texts users accept.
 * Details come from environment variables; nothing is invented when they are missing.
 */
export const TERMS_VERSION = "2026-10";

export interface OperatorDetails {
  name: string | null;
  email: string | null;
  address: string | null;
  privacyEmail: string | null;
  /** True once counsel has reviewed the texts (LEGAL_REVIEWED=1); until then pages show a draft notice. */
  reviewed: boolean;
}

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export function operatorDetails(): OperatorDetails {
  const email = clean(process.env.OPERATOR_EMAIL);
  return {
    name: clean(process.env.OPERATOR_NAME),
    email,
    address: clean(process.env.OPERATOR_ADDRESS),
    privacyEmail: clean(process.env.PRIVACY_EMAIL) ?? email,
    reviewed: process.env.LEGAL_REVIEWED === "1",
  };
}
