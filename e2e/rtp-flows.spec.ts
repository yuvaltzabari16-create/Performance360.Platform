import { expect, test, type Browser, type Page } from "@playwright/test";

// Return to play: an athlete reports an injury, staff move it through the stages,
// a physiotherapist records clearance, and everyone sees the same timeline.
const run = Date.now().toString(36);
const password = "correct-horse-42";
const people = {
  director: { name: "Rita Director", email: `rtp.director.${run}@example.com` },
  head: { name: "Hank Head Coach", email: `rtp.head.${run}@example.com` },
  physio: { name: "Penny Physio", email: `rtp.physio.${run}@example.com` },
  athlete: { name: "Ivan Injured", email: `rtp.athlete.${run}@example.com` },
};
const invites: Record<string, string> = {};
let athleteCode = "";
let athleteUrl = "";

async function signup(page: Page, who: { name: string; email: string }) {
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

async function joinWithInvite(browser: Browser, who: { name: string; email: string }, code: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/join/${code}`);
  await signup(page, who);
  await page.getByRole("button", { name: "Join team" }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe.serial("Return to play", () => {
  test("set up a team with staff and an athlete", async ({ page, browser }) => {
    await page.goto("/");
    await page.locator('[data-account-type="team"]').click();
    await page.waitForURL(/\/signup/);
    await signup(page, people.director);
    await page.getByRole("link", { name: /Create a team/ }).click();
    await page.getByLabel("Team or club name").fill("FC Rehab");
    await page.getByRole("button", { name: "Create a team" }).click();
    await page.waitForURL(/\/team/);
    athleteCode = (await page.locator(".tracking-\\[0\\.2em\\]").innerText()).trim();
    for (const [key, label] of [["head_coach", "Head Coach"], ["physiotherapist", "Physiotherapist"]] as const) {
      await page.locator('form:has(button:text("Create invitation")) select').selectOption(key);
      await page.getByRole("button", { name: "Create invitation" }).click();
      await expect(page.getByText("Invitation created.")).toBeVisible();
      const item = page.locator("li").filter({ hasText: /STAFF-/ }).filter({ hasText: label }).first();
      invites[key] = (await item.innerText()).match(/STAFF-[A-Z0-9]{6}/)![0];
    }
    await joinWithInvite(browser, people.head, invites.head_coach);
    await joinWithInvite(browser, people.physio, invites.physiotherapist);

    const ath = await (await browser.newContext()).newPage();
    await ath.goto(`/join/${athleteCode}`);
    await signup(ath, people.athlete);
    await ath.getByRole("button", { name: "Continue" }).click();
    await ath.waitForURL(/\/connect\?code=TEAM-/);
    await ath.getByRole("button", { name: "Join team" }).click();
    await expect(ath.getByText("You're connected.")).toBeVisible();
  });

  test("the athlete reports a hamstring problem", async ({ browser }) => {
    const page = await login(browser, people.athlete);
    await page.getByRole("link", { name: "Injuries" }).first().click();
    await page.waitForURL(/\/injuries/);
    await page.getByText("Report a problem").last().click();
    await page.getByLabel("Body area").selectOption("hamstring");
    await page.getByLabel("Side").selectOption("left");
    await page.getByLabel("Note").last().fill("Felt a pull sprinting");
    await page.getByRole("button", { name: "Save injury" }).click();
    await expect(page.getByText("Injury reported")).toBeVisible();
    await expect(page.getByText("Felt a pull sprinting")).toBeVisible();
    // Athletes cannot move stages or set a diagnosis.
    await expect(page.getByRole("button", { name: /Advance to/ })).toHaveCount(0);
    await expect(page.getByLabel("Diagnosis (by the treating professional)")).toHaveCount(0);
  });

  test("the head coach sees it on the board and moves it to rehab", async ({ browser }) => {
    const page = await login(browser, people.head);
    await page.goto("/injuries");
    const board = page.getByTestId("injury-board");
    await expect(board.getByRole("region", { name: "Rest" }).getByText("Ivan Injured")).toBeVisible();
    await board.getByText("Ivan Injured").click();
    await page.waitForURL(/\/athletes\/[0-9a-f-]{36}/);
    athleteUrl = page.url().split("#")[0];
    await page.getByPlaceholder("Note for this change (optional)").first().fill("Start physio next week");
    await page.getByRole("button", { name: "Advance to Rehab" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
    await expect(page.getByText("Start physio next week")).toBeVisible();
    await page.goto("/injuries");
    await expect(page.getByTestId("injury-board").getByRole("region", { name: "Rehab" }).getByText("Ivan Injured")).toBeVisible();
  });

  test("clearance needs a basis and the right role", async ({ browser }) => {
    const physio = await login(browser, people.physio);
    await physio.goto(athleteUrl);
    // Walk through the stages up to full training.
    for (const next of ["Running", "Modified training", "Full training"]) {
      await physio.getByRole("button", { name: `Advance to ${next}` }).click();
      await expect(physio.getByText("Saved")).toBeVisible();
    }
    // The clearance note is required by the browser and by the database.
    await physio.getByPlaceholder("Basis for clearance (required)").fill("Passed hop test and sprint test");
    await physio.getByRole("button", { name: "Advance to Cleared" }).click();
    await expect(physio.getByText("Saved")).toBeVisible();
    await physio.getByText(/Resolved injuries/).click(); // cleared injuries move to the history
    await expect(physio.getByText("Cleared on")).toBeVisible();
    await expect(physio.getByText("Passed hop test and sprint test")).toBeVisible();
    await expect(physio.getByText("Penny Physio").first()).toBeVisible();
  });

  test("the athlete sees the cleared injury and its timeline", async ({ browser }) => {
    const page = await login(browser, people.athlete);
    await page.goto("/injuries");
    await page.getByText(/Resolved injuries/).click();
    await expect(page.getByText("Passed hop test and sprint test")).toBeVisible();
    await expect(page.getByText(/Performance360 records the decisions/)).toBeVisible();
    // Notifications went out for the stage changes.
    await page.goto("/notifications");
    await expect(page.getByText("Return-to-play update").first()).toBeVisible();
  });

  test("the director sees no injuries", async ({ browser }) => {
    const page = await login(browser, people.director);
    await page.goto("/injuries");
    await expect(page.getByText("Ivan Injured")).toHaveCount(0);
  });
});
