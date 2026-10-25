import { expect, test, type Browser, type Page } from "@playwright/test";

// Messages between a director, a head coach and a roster athlete; outsiders see nothing.
const run = Date.now().toString(36);
const password = "correct-horse-42";
const people = {
  director: { name: "Mia Director", email: `msg.director.${run}@example.com` },
  coach: { name: "Carl Coach", email: `msg.coach.${run}@example.com` },
  athlete: { name: "Anna Athlete", email: `msg.athlete.${run}@example.com` },
  outsider: { name: "Otto Outsider", email: `msg.outsider.${run}@example.com` },
};
let athleteCode = "";
let coachInvite = "";

async function signup(page: Page, who: { name: string; email: string }) {
  await page.getByLabel("Full name").fill(who.name);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel(/I agree to the/).check();
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

async function startConversation(page: Page, personName: string) {
  await page.goto("/messages");
  const value = await page.locator("select[name=with] option", { hasText: personName }).getAttribute("value");
  await page.locator("select[name=with]").selectOption(value!);
  await page.getByRole("button", { name: "New message" }).click();
  await page.waitForURL(/with=/);
}

test.describe.serial("Messages and the director's club view", () => {
  test("set up a team", async ({ page, browser }) => {
    await page.goto("/");
    await page.locator('[data-account-type="team"]').click();
    await page.waitForURL(/\/signup/);
    await signup(page, people.director);
    await page.getByRole("link", { name: /Create a team/ }).click();
    await page.getByLabel("Team or club name").fill("FC Talk");
    await page.getByRole("button", { name: "Create a team" }).click();
    await page.waitForURL(/\/team/);
    athleteCode = (await page.locator(".tracking-\\[0\\.2em\\]").innerText()).trim();
    await page.locator('form:has(button:text("Create invitation")) select').selectOption("head_coach");
    await page.getByRole("button", { name: "Create invitation" }).click();
    await expect(page.getByText("Invitation created.")).toBeVisible();
    coachInvite = (await page.locator("li").filter({ hasText: /STAFF-/ }).first().innerText()).match(/STAFF-[A-Z0-9]{6}/)![0];

    const coach = await (await browser.newContext()).newPage();
    await coach.goto(`/join/${coachInvite}`);
    await signup(coach, people.coach);
    await coach.getByRole("button", { name: "Join team" }).click();
    await coach.waitForURL(/\/dashboard/);

    const ath = await (await browser.newContext()).newPage();
    await ath.goto(`/join/${athleteCode}`);
    await signup(ath, people.athlete);
    await ath.getByRole("button", { name: "Continue" }).click();
    await ath.waitForURL(/\/connect\?code=TEAM-/);
    await ath.getByRole("button", { name: "Join team" }).click();
    await expect(ath.getByText("You're connected.")).toBeVisible();

    const out = await (await browser.newContext()).newPage();
    await out.goto("/signup?next=%2Fonboarding%3Ftype%3Dindependent");
    await signup(out, people.outsider);
    await out.getByRole("button", { name: "Continue" }).click();
    await out.waitForURL(/\/dashboard/);
  });

  test("the director's menu is the club view", async ({ browser }) => {
    const page = await login(browser, people.director);
    const menu = page.getByRole("navigation").first();
    for (const name of ["Dashboard", "My Team", "Athletes", "Groups", "Calendar", "Injuries", "Messages", "GPS", "Settings"]) {
      await expect(menu.getByRole("link", { name })).toBeVisible();
    }
    for (const name of ["Training Planner", "Exercise Library"]) {
      await expect(menu.getByRole("link", { name })).toHaveCount(0);
    }
    for (const name of ["Testing", "Readiness"]) await expect(menu.getByRole("link", { name })).toBeVisible();
    await page.getByRole("link", { name: "Athletes" }).first().click();
    await expect(page.getByRole("link", { name: "Anna Athlete" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add athlete" })).toHaveCount(0);
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar", level: 1 })).toBeVisible();
    await page.goto("/teams");
    await expect(page.getByRole("button", { name: "Create" })).toHaveCount(0); // squads are read-only for the director
  });

  test("the director writes to the athlete and the athlete answers", async ({ browser }) => {
    const dir = await login(browser, people.director);
    await startConversation(dir, "Anna Athlete");
    await dir.getByLabel("Write a message").fill("Welcome to FC Talk, Anna!");
    await dir.getByRole("button", { name: "Send" }).click();
    await expect(dir.getByText("Message sent.")).toBeVisible();
    await expect(dir.getByTestId("thread").getByText("Welcome to FC Talk, Anna!")).toBeVisible();

    const ath = await login(browser, people.athlete);
    await ath.getByRole("link", { name: "Notifications" }).first().click();
    await expect(ath.getByText(/New message from Mia Director/)).toBeVisible();
    await ath.goto("/messages");
    await expect(ath.getByTestId("threads").getByText("Welcome to FC Talk, Anna!")).toBeVisible();
    await ath.getByTestId("threads").getByRole("link").first().click();
    await ath.getByLabel("Write a message").fill("Thank you, happy to be here.");
    await ath.getByRole("button", { name: "Send" }).click();
    await expect(ath.getByTestId("thread").getByText("Thank you, happy to be here.")).toBeVisible();

    await dir.goto("/messages");
    await expect(dir.getByTestId("threads").getByText("Thank you, happy to be here.")).toBeVisible();
  });

  test("a third person and an outsider see none of it", async ({ browser }) => {
    const coach = await login(browser, people.coach);
    await coach.goto("/messages");
    await expect(coach.getByText("Welcome to FC Talk, Anna!")).toHaveCount(0);
    const out = await login(browser, people.outsider);
    await out.goto("/messages");
    await expect(out.getByText("No conversations yet")).toBeVisible();
    await expect(out.locator("select[name=with]")).toHaveCount(0); // nobody to write to
  });
});
