import { expect, test, type Page } from "@playwright/test";

// Competitor-inspired features: AI workout assistant, calendar, athlete "today" view, quick assign.
// The session builder runs entirely inside the app: no outside service or special server settings are needed.
const run = Date.now().toString(36);
const password = "correct-horse-42";
const coach = { name: "Feature Coach", email: `feat.coach.${run}@example.com` };
const athlete = { name: "Feature Athlete", email: `feat.ath.${run}@example.com` };
let programUrl = "";
let inviteUrl = "";

async function signUpCoach(page: Page) {
  await page.goto("/");
  await page.locator('[data-account-type="independent"]').click();
  await page.waitForURL(/\/signup/);
  await page.getByLabel("Full name").fill(coach.name);
  await page.getByLabel("Email").fill(coach.email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel(/I agree to the/).check();
    await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByLabel("Your profession").selectOption("sc_coach");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/dashboard/);
}

/** Each test gets a fresh browser, so the coach signs in again. */
async function loginCoach(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(coach.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

let generated: string[] = [];
let generatedCount = 0;

test.describe.serial("Session builder, calendar and today view", () => {
  test("the session builder previews a library-only workout, offers another version and adds it", async ({ page }) => {
    await signUpCoach(page);
    await page.goto("/code");
    inviteUrl = (await page.locator(".tracking-\\[0\\.2em\\]").innerText()).trim();
    await page.goto("/training/new");
    await page.getByLabel("Program title *").fill("AI Block");
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/training\/[0-9a-f-]{36}$/);
    programUrl = page.url();
    await page.getByPlaceholder("Lower body strength").fill("AI day");
    await page.getByRole("button", { name: "Add session" }).click();
    await expect(page.getByRole("heading", { name: /AI day/ })).toBeVisible();

    await page.getByRole("button", { name: /Auto-build session/ }).click();
    await page.getByLabel("Describe the session").fill("Lower body power, 60 minutes");
    await page.getByRole("button", { name: "Generate workout" }).click();
    const preview = page.getByRole("region", { name: "Generated workout preview" });
    await expect(preview.getByText(/exercises from your library/)).toBeVisible();
    await expect(preview.getByText("Power session lower body · 60 min")).toBeVisible();
    const first = await preview.innerText();
    await page.getByRole("button", { name: "Another version" }).click();
    await expect.poll(async () => (await preview.innerText().catch(() => first)) !== first).toBe(true);   // a different pick from the same library
    await page.getByRole("button", { name: "Add to this session" }).click();
    const added = page.locator('a[href^="/exercises/"]');
    await expect(added.nth(1)).toBeVisible();
    generated = [(await added.nth(0).innerText()).trim(), (await added.nth(1).innerText()).trim()];
    generatedCount = await added.count();
    await expect(page.getByRole("button", { name: /Reps\s*\d+x\d+/ }).first()).toBeVisible();
  });

  test("the athlete joins, the coach assigns the program from the builder", async ({ browser, page }) => {
    // Athlete signs up through the coach's invitation link and confirms the connection.
    const athletePage = await (await browser.newContext()).newPage();
    await athletePage.goto(`/join/${inviteUrl}`);
    await athletePage.getByLabel("Full name").fill(athlete.name);
    await athletePage.getByLabel("Email").fill(athlete.email);
    await athletePage.getByLabel("Password").fill(password);
    await athletePage.getByLabel(/I agree to the/).check();
    await athletePage.getByRole("button", { name: "Create account" }).click();
    await athletePage.waitForURL(/\/onboarding/);
    await athletePage.getByRole("button", { name: "Continue" }).click();
    await athletePage.waitForURL(/\/connect\?code=/);
    await athletePage.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(athletePage.getByText("You're connected.")).toBeVisible();
    await athletePage.close();

    // Coach: the Assign button in the builder jumps to the assignment card.
    await loginCoach(page);
    await page.goto(programUrl);
    await page.getByRole("link", { name: /Assign/ }).first().click();
    await page.locator('select[name="athlete_ids"]').selectOption({ label: athlete.name });
    await page.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByText("Planned vs completed: 0/1")).toBeVisible();
  });

  test("the coach calendar shows the session on its day", async ({ page }) => {
    await loginCoach(page);
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar", level: 1 })).toBeVisible();
    const todayCell = page.locator('[role="gridcell"][aria-current="date"]');
    await expect(todayCell.getByText("AI day")).toBeVisible();
    await todayCell.click();
    await expect(page.getByRole("link", { name: "Open in planner" })).toBeVisible();
    await expect(page.getByText("Planned", { exact: true }).first()).toBeVisible();
  });

  test("the athlete sees today's workout, ticks exercises and logs it", async ({ browser }) => {
    const athletePage = await (await browser.newContext()).newPage();
    await athletePage.goto("/login");
    await athletePage.getByLabel("Email").fill(athlete.email);
    await athletePage.getByLabel("Password").fill(password);
    await athletePage.getByRole("button", { name: "Sign in" }).click();
    await athletePage.waitForURL(/\/dashboard/);
    await expect(athletePage.getByText("Today's workout")).toBeVisible();
    await athletePage.getByRole("link", { name: "Start workout" }).click();
    await expect(athletePage.getByText(`0 of ${generatedCount} exercises done`)).toBeVisible();
    await athletePage.getByRole("checkbox", { name: generated[0] }).check();
    await athletePage.getByRole("checkbox", { name: generated[1] }).check();
    await expect(athletePage.getByText(`2 of ${generatedCount} exercises done`)).toBeVisible();
    await athletePage.getByRole("button", { name: "Save" }).click();
    await expect(athletePage.getByText("Saved")).toBeVisible();

    await athletePage.goto("/calendar");
    await athletePage.locator('[role="gridcell"][aria-current="date"]').click();
    await expect(athletePage.getByText("Completed", { exact: true }).first()).toBeVisible();
  });
});
