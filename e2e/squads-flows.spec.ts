import { expect, test, type Browser, type Page } from "@playwright/test";

// Squads: a head coach sees only the athletes of the squad assigned to them.
const run = Date.now().toString(36);
const password = "correct-horse-42";
const people = {
  director: { name: "Dora Director", email: `sq.director.${run}@example.com` },
  coachA: { name: "Carl Coach", email: `sq.carl.${run}@example.com` },
  coachB: { name: "Cora Coach", email: `sq.cora.${run}@example.com` },
  ann: { name: "Ann Under19", email: `sq.ann.${run}@example.com` },
  ben: { name: "Ben Seniors", email: `sq.ben.${run}@example.com` },
};
const invites: string[] = [];
let athleteCode = "";

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

async function joinAsAthlete(browser: Browser, who: { name: string; email: string }) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/join/${athleteCode}`);
  await signup(page, who);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/connect\?code=TEAM-/);
  await page.getByRole("button", { name: "Join team" }).click();
  await expect(page.getByText("You're connected.")).toBeVisible();
}

test.describe.serial("Squads", () => {
  test("set up: team, two head coaches, two athletes", async ({ page, browser }) => {
    await page.goto("/");
    await page.locator('[data-account-type="team"]').click();
    await page.waitForURL(/\/signup/);
    await signup(page, people.director);
    await page.getByRole("link", { name: /Create a team/ }).click();
    await page.getByLabel("Team or club name").fill("Squad FC");
    await page.getByLabel("Sport").fill("Football");
    await page.getByRole("button", { name: "Create a team" }).click();
    await page.waitForURL(/\/team/);
    athleteCode = (await page.locator(".tracking-\\[0\\.2em\\]").innerText()).trim();
    for (let i = 0; i < 2; i++) {
      await page.locator('form:has(button:text("Create invitation")) select').selectOption("head_coach");
      await page.getByRole("button", { name: "Create invitation" }).click();
      await expect(page.locator("li").filter({ hasText: /STAFF-/ })).toHaveCount(i + 1);
    }
    const codes = (await page.locator("li").filter({ hasText: /STAFF-/ }).allInnerTexts()).map((x) => x.match(/STAFF-[A-Z0-9]{6}/)![0]);
    invites.push(...new Set(codes));
    expect(invites).toHaveLength(2);

    for (const [who, code] of [[people.coachA, invites[0]], [people.coachB, invites[1]]] as const) {
      const p = await (await browser.newContext()).newPage();
      await p.goto(`/join/${code}`);
      await signup(p, who);
      await p.getByRole("button", { name: "Join team" }).click();
      await p.waitForURL(/\/dashboard/);
    }
    await joinAsAthlete(browser, people.ann);
    await joinAsAthlete(browser, people.ben);
  });

  test("before any squad exists every coach sees the whole roster", async ({ browser }) => {
    const coach = await login(browser, people.coachA);
    await coach.goto("/athletes");
    await expect(coach.getByText("Ann Under19")).toBeVisible();
    await expect(coach.getByText("Ben Seniors")).toBeVisible();
  });

  test("the director creates squads, assigns coaches and athletes", async ({ browser }) => {
    const dir = await login(browser, people.director);
    await dir.goto("/team");
    for (const name of ["Under 19", "Seniors"]) {
      await dir.getByLabel("Squad name").fill(name);
      await dir.getByRole("button", { name: "Add squad" }).click();
      await expect(dir.getByTestId("squads").getByText(name, { exact: true }).first()).toBeVisible();
    }
    // Coaches: Carl -> Under 19, Cora -> Seniors.
    const squads = dir.getByTestId("squads").locator("li");
    await squads.filter({ hasText: "Under 19" }).getByLabel("Carl Coach").check();
    await squads.filter({ hasText: "Under 19" }).getByRole("button", { name: "Save" }).click();
    await squads.filter({ hasText: "Seniors" }).getByLabel("Cora Coach").check();
    await squads.filter({ hasText: "Seniors" }).getByRole("button", { name: "Save" }).click();
    // Athletes.
    await dir.getByLabel("Squad: Ann Under19").selectOption({ label: "Under 19" });
    await dir.locator("tr", { hasText: "Ann Under19" }).getByRole("button", { name: "Save" }).click();
    await dir.getByLabel("Squad: Ben Seniors").selectOption({ label: "Seniors" });
    await dir.locator("tr", { hasText: "Ben Seniors" }).getByRole("button", { name: "Save" }).click();
    await expect(dir.getByLabel("Squad: Ben Seniors")).toHaveValue(/.+/);
  });

  test("each head coach sees only their squad", async ({ browser }) => {
    const a = await login(browser, people.coachA);
    await a.goto("/athletes");
    await expect(a.getByText("Ann Under19")).toBeVisible();
    await expect(a.getByText("Ben Seniors")).toHaveCount(0);
    await a.goto("/team");
    await expect(a.getByTestId("my-squads")).toContainText("Under 19");
    await expect(a.getByText("Ben Seniors")).toHaveCount(0);

    const b = await login(browser, people.coachB);
    await b.goto("/athletes");
    await expect(b.getByText("Ben Seniors")).toBeVisible();
    await expect(b.getByText("Ann Under19")).toHaveCount(0);
  });
});
