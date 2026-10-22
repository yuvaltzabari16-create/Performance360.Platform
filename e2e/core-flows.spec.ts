import { expect, test, type Browser, type Page } from "@playwright/test";

// Unique per run so the suite can be re-run against the same database.
const run = Date.now().toString(36);
const coach = { name: "Coach Alpha", email: `coach.${run}@example.com` };
const other = { name: "Coach Beta", email: `beta.${run}@example.com` };
const athlete = { name: "Dana Athlete", email: `dana.${run}@example.com` };
const password = "correct-horse-42";
const shots = process.env.E2E_SCREENSHOTS;

let code = "";
let athleteRecordUrl = "";
let rosterUrl = "";
let programUrl = "";

async function signup(page: Page, who: { name: string; email: string }, startUrl = "/signup") {
  await page.goto(startUrl);
  await page.getByLabel("Full name").fill(who.name);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding/);
}

async function login(browser: Browser, who: { email: string }) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
  return page;
}

async function snap(page: Page, name: string) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

test.describe.serial("Performance360 core workflows", () => {
  test("unauthenticated users are sent to login", async ({ page }) => {
    await page.goto("/athletes");
    await expect(page).toHaveURL(/\/login\?next=%2Fathletes/);
  });

  test("coach registers as a Personal Trainer account and gets a personal code", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-account-type]")).toHaveCount(3); // Team, Personal Trainer, Athlete
    await page.locator('[data-account-type="independent"]').click();
    await page.waitForURL(/\/signup/);
    await expect(page.getByText("Account type")).toBeVisible();
    await signup(page, coach, page.url());
    await expect(page).toHaveURL(/type=independent/);
    await page.getByLabel("Your profession").selectOption("sc_coach");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByText("Active athletes")).toBeVisible();
    await snap(page, "01-coach-dashboard-empty");

    await page.goto("/code");
    code = (await page.locator(".tracking-\\[0\\.2em\\]").innerText()).trim();
    expect(code).toMatch(/^P360-[A-Z0-9]{6}$/);
    await expect(page.getByText(`/join/${code}`)).toBeVisible();
    await snap(page, "02-personal-code");
  });

  test("coach adds an athlete manually", async ({ browser }) => {
    const page = await login(browser, coach);
    await page.goto("/athletes/new");
    await page.getByLabel("Name *").fill("Roster Only");
    await page.getByLabel("Sport").fill("Football");
    await page.getByLabel("Position / event").fill("Winger");
    await page.getByLabel("Relevant limitations").fill("Avoid max-velocity sprints this week");
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForURL(/\/athletes\/[0-9a-f-]{36}$/);
    rosterUrl = page.url();
    await expect(page.getByRole("heading", { name: "Roster Only" })).toBeVisible();
    await expect(page.getByText("Avoid max-velocity sprints this week")).toBeVisible();
    await page.getByPlaceholder("Add note").fill("Good first session");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Good first session")).toBeVisible();
    await snap(page, "03-athlete-profile");
  });

  test("athlete joins with the invitation link and connects after confirming", async ({ page }) => {
    await page.goto(`/join/${code}`);
    await expect(page.getByText(code)).toBeVisible();
    await signup(page, athlete, page.url());
    await expect(page.getByLabel("Your full name")).toHaveValue("Dana Athlete");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/connect\?code=/);
    await expect(page.getByText("Coach Alpha")).toBeVisible();
    await snap(page, "04-connect-confirm");
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(page.getByText("You're connected.")).toBeVisible();
    await expect(page.getByText("Primary coach")).toBeVisible();
  });

  test("coach builds a program and assigns it", async ({ browser }) => {
    const page = await login(browser, coach);
    await expect(page.getByText("New athlete connected")).toHaveCount(0); // lives in notifications, not dashboard
    await page.goto("/notifications");
    await expect(page.getByText("New athlete connected")).toBeVisible();

    await page.goto("/athletes");
    await page.getByRole("link", { name: "Dana Athlete" }).click();
    await page.waitForURL(/\/athletes\/[0-9a-f-]{36}$/);
    athleteRecordUrl = page.url();

    await page.goto("/training/new");
    await page.getByLabel("Program title *").fill("Acceleration Block");
    await page.getByLabel("Number of weeks").fill("3");
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/training\/[0-9a-f-]{36}$/);
    programUrl = page.url();

    await page.getByPlaceholder("Lower body strength").fill("Speed day");
    await page.getByLabel("Planned duration (min)").fill("60");
    await page.getByRole("button", { name: "Add session" }).click();
    await expect(page.getByText("Day 1 · Speed day")).toBeVisible();

    await page.getByText("+ Add exercise").click();
    await page.locator('select[name="exercise_id"]').selectOption({ label: "Goblet Squat" });
    await page.locator('form:has(button:text("Add exercise")) input[name="sets"]').fill("6");
    await page.locator('form:has(button:text("Add exercise")) input[name="reps"]').fill("1");
    await page.locator('form:has(button:text("Add exercise")) input[name="rest_s"]').fill("120");
    await page.getByRole("button", { name: "Add exercise" }).click();
    await expect(page.getByText("6 × 1")).toBeVisible();

    await page.getByLabel("Copy this week to week").fill("2");
    await page.getByRole("button", { name: "Duplicate week" }).click();
    await page.waitForURL(/week=2/);
    await expect(page.getByText("Day 1 · Speed day")).toBeVisible();

    await page.goto(programUrl);
    await page.locator('select[name="athlete_ids"]').selectOption({ label: "Dana Athlete" });
    await page.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByText("Planned vs completed: 0/2")).toBeVisible();
    await page.getByRole("button", { name: "Save version" }).click();
    await expect(page.getByText("v1")).toBeVisible();
    await snap(page, "05-program-builder");
  });

  test("coach records a jump test with trials", async ({ browser }) => {
    const page = await login(browser, coach);
    await page.goto(`/testing/new?athlete=${athleteRecordUrl.split("/").pop()}`);
    await page.locator('select[name="r0_test"]').selectOption({ label: "Countermovement Jump (cm ↑)" });
    await page.getByLabel("Trial 1", { exact: true }).fill("38.1");
    await page.getByLabel("Trial 2", { exact: true }).fill("39.4");
    await page.getByLabel("Trial 3", { exact: true }).fill("38.9");
    await page.locator('input[name="r0_method"]').fill("Contact mat");
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForURL(/\/testing\?athlete=/);
    await expect(page.getByText("Countermovement Jump")).toBeVisible();
    await expect(page.locator("dd", { hasText: "39.4" }).first()).toBeVisible();
    await snap(page, "06-testing");
  });

  test("exercise library has the coach list with a video for every exercise", async ({ browser }) => {
    const page = await login(browser, coach);
    await page.goto("/exercises");
    await expect(page.getByText(/^(3[4-9]\d|[4-9]\d\d) videos$/)).toBeVisible();
    await page.getByPlaceholder("Search exercises…").fill("Zercher");
    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("link", { name: /Zercher Squat/ }).click();
    await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/EuDizUUiHEo"]')).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Open on YouTube ↗" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=EuDizUUiHEo");

    await page.goto("/exercises/feed?category=rehab");
    await expect(page.locator("iframe")).toHaveCount(0); // thumbnails only until tapped
    await page.getByRole("button", { name: /Tap to play: Knee Flexion Range of Motion/ }).click();
    await expect(page.locator('iframe[src*="kF_CyoZihCE"][src*="start=115"][src*="autoplay=1"]')).toHaveCount(1);
    await snap(page, "05b-video-feed");
  });

  test("athlete sees training, logs a session, checks in and sees results", async ({ browser }) => {
    const page = await login(browser, athlete);
    await expect(page.getByText("Speed day").first()).toBeVisible();
    await snap(page, "07-athlete-dashboard");
    await page.getByRole("link", { name: "Log session" }).first().click();
    await page.getByLabel("Session RPE (0–10)").fill("7");
    await page.getByLabel("Actual duration (min)").fill("55");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
    await expect(page.getByText("385 AU")).toBeVisible();

    await page.goto("/readiness");
    await page.getByLabel("Sleep (hours)").fill("7.5");
    for (const [label, value] of [["Sleep quality", "4"], ["Fatigue", "2"], ["Muscle soreness", "2"], ["Stress", "2"], ["Mood", "4"], ["Motivation", "5"]]) {
      await page.locator("fieldset", { has: page.getByText(label, { exact: true }) }).locator(`input[value="${value}"]`).check({ force: true });
    }
    await page.getByRole("button", { name: "Submit check-in" }).click();
    await expect(page.getByText("Check-in saved.")).toBeVisible();

    await page.goto("/testing");
    await expect(page.getByText("Countermovement Jump")).toBeVisible();
    await expect(page.getByRole("link", { name: "Record test" })).toHaveCount(0);

    // Athletes cannot reach coach-only screens.
    await page.goto("/athletes");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("coach sees the athlete's logged session and readiness", async ({ browser }) => {
    const page = await login(browser, coach);
    await page.goto(programUrl);
    await expect(page.getByText("Planned vs completed: 1/2")).toBeVisible();
    await page.goto("/readiness");
    await expect(page.getByRole("link", { name: "Dana Athlete" })).toBeVisible();
    await expect(page.getByText("No check-in today").first()).toBeVisible(); // the manual roster athlete
    await snap(page, "08-readiness-overview");
  });

  test("a different coach cannot see or open the first coach's athletes", async ({ page }) => {
    await signup(page, other, "/signup?next=%2Fonboarding%3Ftype%3Dindependent");
    await page.getByLabel("Your profession").selectOption("performance_coach");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/dashboard/);
    await page.goto("/athletes");
    await expect(page.getByText("No athletes yet")).toBeVisible();
    for (const url of [rosterUrl, athleteRecordUrl, programUrl]) {
      const res = await page.goto(url);
      expect(res?.status()).toBe(404);
    }
    const csv = await page.request.get(`/testing/export?athlete=${athleteRecordUrl.split("/").pop()}`);
    expect(csv.status()).toBe(404);
  });

  test("Hebrew switches the layout to right-to-left", async ({ browser }) => {
    const page = await login(browser, coach);
    await page.getByRole("button", { name: "עברית" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("ספורטאים פעילים")).toBeVisible();
    await snap(page, "09-dashboard-hebrew");
    await page.getByRole("button", { name: "English" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("mobile layout uses the menu instead of the sidebar", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(athlete.email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/);
    await page.getByText("Menu").click();
    await expect(page.getByRole("link", { name: "My Training" }).last()).toBeVisible();
    await snap(page, "10-mobile-menu");
  });
});
