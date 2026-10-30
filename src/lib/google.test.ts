import { afterEach, describe, expect, it, vi } from "vitest";
import { googleLoginEnabled, needsTermsAcceptance, passwordLoginEnabled } from "./google";

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

describe("needsTermsAcceptance", () => {
  const google = { app_metadata: { provider: "google" } };
  it("asks a Google account that has not accepted yet", () => {
    expect(needsTermsAcceptance(google, { terms_version: null })).toBe(true);
    expect(needsTermsAcceptance(google, null)).toBe(true);
  });
  it("lets through accounts that accepted, and email accounts (they accepted on the sign-up form)", () => {
    expect(needsTermsAcceptance(google, { terms_version: "2026-10" })).toBe(false);
    expect(needsTermsAcceptance({ app_metadata: { provider: "email" } }, { terms_version: null })).toBe(false);
    expect(needsTermsAcceptance(null, null)).toBe(false);
  });
});
