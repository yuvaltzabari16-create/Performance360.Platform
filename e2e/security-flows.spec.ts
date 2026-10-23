import { expect, test, type Browser, type Page } from "@playwright/test";
import { totp } from "./helpers/totp";

// Security and account features: headers, bot trap, two-factor sign-in, auto sign-out, account deletion.
const run = Date.now().toString(36);
const password = "correct-horse-42";
const user = (tag: string) => ({ name: `Sec ${tag}`, email: `sec.${tag}.${run}@example.com` });

/** Registers a Personal Trainer account and lands on the dashboard. */
async function register(page: Page, who: { name: string; email: string }) {
  await page.goto("/");
  await page.locator('[data-account-type="independent"]').click();
  await page.waitForURL(/\/signup/);
  await page.getByLabel("Full name").fill(who.name);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByLabel("Your profession").selectOption("sc_coach");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/dashboard/);
}

/** The visible error/notice box (Next.js adds its own empty route-announcer alert). */
const alertBox = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

async function passwordLogin(browser: Browser, who: { email: string }) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  return page;
}

test.describe.serial("Security features", () => {
  const mfaUser = user("mfa");
  let secret = "";

  test("responses carry the security headers and a nonce-based CSP", async ({ request }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("the hidden honeypot field blocks automated sign-ins", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("bot@example.com");
    await page.getByLabel("Password").fill("whatever-123");
    await page.locator('input[name="website"]').evaluate((el: HTMLInputElement) => { el.value = "http://spam.example"; });
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(alertBox(page)).toContainText("couldn't verify this form");
  });

  test("a user turns on two-factor authentication", async ({ page }) => {
    await register(page, mfaUser);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Set up two-factor authentication" }).click();
    await expect(page.getByText("Scan this QR code")).toBeVisible();
    secret = (await page.locator("code.select-all").innerText()).trim();
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Confirm and turn on" }).click();
    await expect(alertBox(page)).toContainText("isn't right");
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Confirm and turn on" }).click();
    await expect(page.getByText("Two-factor authentication is on.")).toBeVisible();
  });

  test("sign-in then asks for the code, and a password alone cannot reach the app", async ({ browser }) => {
    const page = await passwordLogin(browser, mfaUser);
    await page.waitForURL(/\/login\/mfa/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\/mfa\?next=%2Fdashboard/);
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(alertBox(page)).toContainText("isn't right");
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Verify" }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByText("Active athletes")).toBeVisible();
  });

  test("automatic sign-out after inactivity", async ({ browser }) => {
    const who = user("idle");
    const page = await (await browser.newContext()).newPage();
    await register(page, who);
    // Pretend the last activity was longer ago than the default limit.
    await page.evaluate(() => localStorage.setItem("p360:lastActivity", String(Date.now() - 2 * 60 * 60 * 1000)));
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByText("signed out after a period of inactivity")).toBeVisible();
  });

  test("account deletion needs the email and password, then removes the account", async ({ browser }) => {
    const who = user("del");
    const page = await (await browser.newContext()).newPage();
    await register(page, who);
    await page.goto("/settings");
    page.on("dialog", (d) => d.accept());
    const card = page.locator("form:has(input[name=confirm_email])");
    await card.getByLabel("Type your email address to confirm").fill("someone.else@example.com");
    await card.getByLabel("Current password").fill(password);
    await card.getByRole("button", { name: "Delete my account permanently" }).click();
    await expect(alertBox(page)).toContainText("doesn't match");
    await card.getByLabel("Type your email address to confirm").fill(who.email);
    await card.getByLabel("Current password").fill("wrong-password-1");
    await card.getByRole("button", { name: "Delete my account permanently" }).click();
    await expect(alertBox(page)).toContainText("password is incorrect");
    await card.getByLabel("Type your email address to confirm").fill(who.email);
    await card.getByLabel("Current password").fill(password);
    await card.getByRole("button", { name: "Delete my account permanently" }).click();
    await page.waitForURL(/\/login/);
    await expect(page.getByText("Your account has been deleted.")).toBeVisible();
    // The credentials no longer work.
    await page.getByLabel("Email").fill(who.email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(alertBox(page)).toContainText("incorrect");
  });
});
