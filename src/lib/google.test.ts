import { afterEach, describe, expect, it, vi } from "vitest";
import { emailCodeEnabled, googleLoginEnabled, needsTermsAcceptance, passwordLoginEnabled } from "./google";

afterEach(() => vi.unstubAllEnvs());

describe("Google sign-in settings", () => {
  it("is off unless the deployment turns it on", () => {
    expect(googleLoginEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_LOGIN", "1");
    expect(googleLoginEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_LOGIN", "true");
    expect(googleLoginEnabled()).toBe(false);
  });

  it("keeps passwords unless they are switched off", () => {
    expect(passwordLoginEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_PASSWORD_LOGIN", "0");
    expect(passwordLoginEnabled()).toBe(false);
  });
});

describe("email code sign-in", () => {
  it("is off unless the deployment turns it on", () => {
    expect(emailCodeEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_EMAIL_CODE_LOGIN", "1");
    expect(emailCodeEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_EMAIL_CODE_LOGIN", "yes");
    expect(emailCodeEnabled()).toBe(false);
  });
});

describe("needsTermsAcceptance", () => {
  const google = { app_metadata: { provider: "google" } };
  it("asks a Google account that has not accepted yet", () => {
    expect(needsTermsAcceptance(google, { terms_version: null })).toBe(true);
    expect(needsTermsAcceptance(google, null)).toBe(true);
  });
  it("asks accounts created through an email code, but not password accounts", () => {
    const code = { app_metadata: { provider: "email" }, user_metadata: { otp_signup: true } };
    expect(needsTermsAcceptance(code, { terms_version: null })).toBe(true);
    expect(needsTermsAcceptance(code, { terms_version: "2026-10" })).toBe(false);
    expect(needsTermsAcceptance({ app_metadata: { provider: "email" }, user_metadata: {} }, { terms_version: null })).toBe(false);
  });
  it("lets through accounts that accepted, and email accounts (they accepted on the sign-up form)", () => {
    expect(needsTermsAcceptance(google, { terms_version: "2026-10" })).toBe(false);
    expect(needsTermsAcceptance({ app_metadata: { provider: "email" } }, { terms_version: null })).toBe(false);
    expect(needsTermsAcceptance(null, null)).toBe(false);
  });
});
