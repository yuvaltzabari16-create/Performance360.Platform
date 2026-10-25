import { expect, test, type Page } from "@playwright/test";

// Legal pages, consent at sign-up and parent / guardian consent for minors.
const run = Date.now().toString(36);
const password = "correct-horse-42";
const coach = { name: "Carla Coach", email: `consent.coach.${run}@example.com` };

async function signupFields(page: Page, who: { name: string; email: string }) {
  await page.getByLabel("Full name").fill(who.name);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(password);
}

test.describe.serial("Legal and consent", () => {
  test("the privacy policy and terms are public, in both languages, with the draft notice", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who can see what" })).toBeVisible();
    await expect(page.getByText(/working draft pending legal review/)).toBeVisible();
    await expect(page.getByText("Operator and contact")).toBeVisible();
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms of use", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Professional judgment and no medical advice" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Privacy policy" })).toBeVisible();

    await page.context().addCookies([{ name: "p360-locale", value: "he", url: "http://localhost:3000" }]);
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "מדיניות פרטיות", level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("sign-up needs the acceptance and links to both documents", async ({ page }) => {
    await page.goto("/signup");
    const box = page.getByLabel(/I agree to the/);
    await expect(box).not.toBeChecked();
    await expect(page.getByRole("link", { name: "Terms of use" }).first()).toHaveAttribute("href", "/terms");
    await expect(page.getByRole("link", { name: "Privacy policy" }).first()).toHaveAttribute("href", "/privacy");
    await signupFields(page, coach);
    await page.getByRole("button", { name: "Create account" }).click(); // blocked by the browser: the box is required
    await expect(page).toHaveURL(/\/signup/);
    await box.check();
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/onboarding/);
  });

  test("a minor without guardian consent is flagged until consent is recorded", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(coach.email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/onboarding/);
    await page.goto("/onboarding?type=independent");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/dashboard/);

    await page.goto("/athletes/new");
    await page.getByLabel("Name *").fill("Young Talent");
    await page.getByLabel("Date of birth").fill("2014-05-05");
    await page.getByRole("button", { name: /Save|Create|Add athlete/ }).last().click();
    await page.waitForURL(/\/athletes\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Parental consent missing").first()).toBeVisible();
    await expect(page.getByText(/under 18 and no parent or guardian consent/)).toBeVisible();
    const url = page.url();

    await page.goto("/athletes");
    await expect(page.getByText("Parental consent missing")).toBeVisible();

    await page.goto(`${url}/edit`);
    await page.getByLabel("Parent or guardian name").fill("Dana Parent");
    await page.getByLabel("Parent or guardian phone or email").fill("050-1234567");
    await page.getByLabel(/A parent or guardian has consented/).check();
    await page.getByRole("button", { name: /Save/ }).last().click();
    await page.waitForURL(/\/athletes\/[0-9a-f-]{36}/);
    await expect(page.getByText("Parental consent missing")).toHaveCount(0);
    await page.goto(`${url}/edit`);
    await expect(page.getByText(/Consent recorded on .*recorded by staff/)).toBeVisible();
  });
});
