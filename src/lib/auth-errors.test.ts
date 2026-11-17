import { describe, expect, it } from "vitest";
import { revealsExistingAccount } from "./auth-errors";

describe("revealsExistingAccount", () => {
  it("catches the errors that would reveal a registered email", () => {
    expect(revealsExistingAccount({ code: "user_already_exists", message: "User already registered" })).toBe(true);
    expect(revealsExistingAccount({ code: "email_exists" })).toBe(true);
    expect(revealsExistingAccount({ message: "User already registered" })).toBe(true);
    expect(revealsExistingAccount({ message: "A user with this email address has already been registered" })).toBe(true);
  });

  it("lets other errors through", () => {
    expect(revealsExistingAccount(null)).toBe(false);
    expect(revealsExistingAccount({ code: "weak_password", message: "Password should be at least 8 characters." })).toBe(false);
    expect(revealsExistingAccount({ code: "over_email_send_rate_limit", message: "Email rate limit exceeded" })).toBe(false);
  });
});
