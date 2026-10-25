import { expect, test, type Page } from "@playwright/test";

// Legal pages, accessibility basics, external-only billing and autosave.
const run = Date.now().toString(36);
const who = (tag: string) => ({ name: "Comp Coach", email: `comp.${tag}.${run}@example.com` });
const password = "correct-horse-42";

async function registerCoach(page: Page, tag: string) {
  const me = who(tag);
  await page.goto("/");
  await page.locator('[data-account-type="independent"]').click();
  await page.waitForURL(/\/signup/);
  await page.getByLabel("Full name").fill(me.name);
  await page.getByLabel("Email").fill(me.email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByLabel("Your profession").selectOption("sc_coach");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe.serial("Compliance and autosave", () => {
  test("public legal pages are reachable without signing in", async ({ page }) => {
    await page.goto("/accessibility");
    await expect(page.getByRole("heading", { name: "Accessibility statement", level: 1 })).toBeVisible();
    await expect(page.getByText("WCAG) 2.1 at level AA")).toBeVisible();
    await page.goto("/disclosure");
    await expect(page.getByRole("heading", { name: "Affiliate links" })).toBeVisible();
    await expect(page.getByText("never receives, sees or stores card numbers")).toBeVisible();
    await page.goto("/licenses");
    await expect(page.getByRole("heading", { name: "Fonts", exact: true })).toBeVisible();
    await expect(page.getByText("No font files are bundled or downloaded", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("MIT:").first()).toBeVisible();
  });

  test("login page has the skip link and legal footer links", async ({ page }) => {
    await page.goto("/login");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await expect(page.getByRole("link", { name: "Accessibility statement" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Disclosures" })).toBeVisible();
  });

  test("billing sends people to the external provider only", async ({ page }) => {
    await registerCoach(page, "bill");
    await page.goto("/billing");
    await expect(page.getByText("never sees or stores them")).toBeVisible();
    await expect(page.getByText("Billing is not set up yet.")).toBeVisible();
    // No card fields anywhere on the page.
    await expect(page.locator('input[autocomplete^="cc-"]')).toHaveCount(0);
  });

  test("session details autosave and a note draft survives a reload", async ({ page }) => {
    await registerCoach(page, "auto");
    await page.goto("/training/new");
    await page.getByLabel("Program title *").fill("Autosave Block");
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/training\/[0-9a-f-]{36}$/);
    await page.getByPlaceholder("Lower body strength").fill("Autosave day");
    await page.getByRole("button", { name: "Add session" }).click();
    await expect(page.getByRole("heading", { name: /Autosave day/ })).toBeVisible();

    await page.getByText("Edit / Copy session").click();
    const title = page.locator("details", { hasText: "Edit / Copy session" }).locator('input[maxlength="160"]').first();
    await title.fill("Renamed by autosave");
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 8000 });
    await page.reload();
    await expect(page.getByRole("heading", { name: /Renamed by autosave/ })).toBeVisible();

    // Draft protection on the athlete note box.
    await page.goto("/athletes/new");
    await page.getByLabel("Name *").fill("Draft Athlete");
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForURL(/\/athletes\/[0-9a-f-]{36}$/);
    const note = page.getByPlaceholder("Add note");
    await note.fill("Unsent thought about hamstrings");
    await page.reload();
    await expect(page.getByPlaceholder("Add note")).toHaveValue("Unsent thought about hamstrings");
    await expect(page.getByText("Draft restored")).toBeVisible();
  });
});
