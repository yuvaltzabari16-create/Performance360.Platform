import { expect, test, type Page } from "@playwright/test";

// Competitor-inspired features: AI workout assistant, calendar, athlete "today" view, quick assign.
// The AI call runs against the mock provider (server started with AI_PROVIDER=mock).
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

test.describe.serial("Assistant, calendar and today view", () => {
  test("the AI assistant previews a library-only workout and adds it", async ({ page }) => {
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

    await page.getByRole("button", { name: /Build with AI/ }).click();
    await page.getByLabel("Describe the session").fill("Lower body power, 60 minutes");
    await page.getByRole("button", { name: "Generate workout" }).click();
    await expect(page.getByText(/Matched 5 of 6 exercises/)).toBeVisible();   // the invented exercise is dropped
    await expect(page.getByText("An Invented Exercise")).toHaveCount(0);
    await page.getByRole("button", { name: "Add to this session" }).click();
    await expect(page.getByRole("link", { name: "Barbell Front Squat" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Box Jumps" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Reps\s*3x4/ }).first()).toBeVisible();
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
    await expect(athletePage.getByText("0 of 5 exercises done")).toBeVisible();
    await athletePage.getByRole("checkbox", { name: /Barbell Front Squat/ }).check();
    await athletePage.getByRole("checkbox", { name: /Box Jumps/ }).check();
    await expect(athletePage.getByText("2 of 5 exercises done")).toBeVisible();
    await athletePage.getByRole("button", { name: "Save" }).click();
    await expect(athletePage.getByText("Saved")).toBeVisible();

    await athletePage.goto("/calendar");
    await athletePage.locator('[role="gridcell"][aria-current="date"]').click();
    await expect(athletePage.getByText("Completed", { exact: true }).first()).toBeVisible();
  });
});
