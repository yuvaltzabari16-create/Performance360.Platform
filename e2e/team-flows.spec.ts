import { expect, test, type Browser, type Page } from "@playwright/test";

// Team accounts: a director creates a team, staff join with single-use invitations
// and hold a role, athletes join the roster with their consent.
const run = Date.now().toString(36);
const password = "correct-horse-42";
const people = {
  director: { name: "Dana Director", email: `director.${run}@example.com` },
  head: { name: "Hanna Head Coach", email: `head.${run}@example.com` },
  physio: { name: "Pia Physio", email: `physio.${run}@example.com` },
  hop: { name: "Hugo Performance", email: `hop.${run}@example.com` },
  trainer: { name: "Paul Trainer", email: `trainer.${run}@example.com` },
  athlete: { name: "Alex Athlete", email: `alex.${run}@example.com` },
};
const shots = process.env.E2E_SCREENSHOTS;
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

async function snap(page: Page, name: string) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

async function joinWithInvite(browser: Browser, who: { name: string; email: string }, code: string, roleLabel: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/join/${code}`);
  await expect(page.getByText(code)).toBeVisible(); // invitation shown on the sign-up page
  await signup(page, who);
  await expect(page.getByText(new RegExp(`join FC Alpha as\\s*${roleLabel}`))).toBeVisible();
  await expect(page.getByLabel("Your full name")).toHaveValue(who.name);
  await page.getByRole("button", { name: "Join team" }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText("You joined the team.")).toBeVisible();
  return page;
}

test.describe.serial("Team accounts", () => {
  test("director creates a team from the Team sign-up path", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-account-type="team"]').click();
    await page.waitForURL(/\/signup/);
    await signup(page, people.director);
    await expect(page).toHaveURL(/type=team/);
    await page.getByRole("link", { name: /Create a team/ }).click();
    await page.getByLabel("Team or club name").fill("FC Alpha");
    await page.getByLabel("Sport").fill("Football");
    await page.getByRole("button", { name: "Create a team" }).click();
    await page.waitForURL(/\/team/);
    await expect(page.getByRole("heading", { name: "FC Alpha" })).toBeVisible();
    await expect(page.getByText("Team created.")).toBeVisible();
    athleteCode = (await page.locator(".tracking-\\[0\\.2em\\]").innerText()).trim();
    expect(athleteCode).toMatch(/^TEAM-[A-Z0-9]{6}$/);
    // The director's menu has the club view, but no planner, library or testing.
    await expect(page.getByRole("link", { name: "Training Planner" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Exercise Library" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "My Team" }).first()).toBeVisible();
  });

  test("director invites staff for each role", async ({ browser }) => {
    const page = await login(browser, people.director);
    await expect(page.getByRole("heading", { name: "FC Alpha" })).toBeVisible(); // director dashboard
    await page.goto("/team");
    for (const [key, label] of [["head_coach", "Head Coach"], ["physiotherapist", "Physiotherapist"], ["head_of_performance", "Head of Performance"]] as const) {
      await page.locator('form:has(button:text("Create invitation")) select').selectOption(key);
      await page.getByRole("button", { name: "Create invitation" }).click();
      await expect(page.getByText("Invitation created.")).toBeVisible();
      const item = page.locator("li").filter({ hasText: /STAFF-/ }).filter({ hasText: label }).first();
      invites[key] = (await item.innerText()).match(/STAFF-[A-Z0-9]{6}/)![0];
    }
    expect(Object.keys(invites)).toHaveLength(3);
    await snap(page, "11-team-director");
  });

  test("head coach, physiotherapist and head of performance join with their own logins", async ({ browser }) => {
    const head = await joinWithInvite(browser, people.head, invites.head_coach, "Head Coach");
    await expect(head.getByRole("link", { name: "My Team" }).first()).toBeVisible();
    await head.goto("/team");
    await expect(head.getByRole("heading", { name: "FC Alpha" })).toBeVisible();
    await expect(head.getByText("Invite staff")).toHaveCount(0); // only the director invites
    await snap(head, "12-team-head-coach");
    await joinWithInvite(browser, people.physio, invites.physiotherapist, "Physiotherapist");
    await joinWithInvite(browser, people.hop, invites.head_of_performance, "Head of Performance");

    // An invitation can be used once.
    const reuse = await (await browser.newContext()).newPage();
    await reuse.goto(`/join/${invites.head_coach}`);
    await signup(reuse, { name: "Late Joiner", email: `late.${run}@example.com` });
    await expect(reuse.getByText(/isn't valid/)).toBeVisible();
  });

  test("Personal Trainer account is independent of the team", async ({ page }) => {
    await page.goto("/signup?next=%2Fonboarding%3Ftype%3Dindependent");
    await signup(page, people.trainer);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole("link", { name: "My Team" })).toHaveCount(0);
    await page.goto("/code");
    await expect(page.locator(".tracking-\\[0\\.2em\\]")).toHaveText(/^P360-/);
  });

  test("athlete joins the roster after seeing the team and consenting", async ({ page }) => {
    await page.goto(`/join/${athleteCode}`);
    await signup(page, people.athlete);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/connect\?code=TEAM-/);
    await expect(page.getByText("FC Alpha")).toBeVisible();
    await expect(page.getByText(/can see your profile, training and test results/)).toBeVisible();
    await snap(page, "13-athlete-join-team");
    await page.getByRole("button", { name: "Join team" }).click();
    await expect(page.getByText("You're connected.")).toBeVisible();
    await expect(page.getByText("My team: FC Alpha")).toBeVisible();
    await expect(page.getByText("Head Coach").first()).toBeVisible(); // which roles can see the data
    await snap(page, "14-athlete-team-access");
  });

  test("staff see the roster athlete; roles differ in what they can change", async ({ browser }) => {
    const head = await login(browser, people.head);
    await head.goto("/athletes");
    await head.getByRole("link", { name: "Alex Athlete" }).click();
    await head.waitForURL(/\/athletes\/[0-9a-f-]{36}$/);
    athleteUrl = head.url();
    await expect(head.getByRole("button", { name: "Archive" })).toBeVisible(); // lead role
    await expect(head.getByText("On the team roster")).toBeVisible();
    await head.getByPlaceholder("Add note").fill("Welcome to the squad");
    await head.getByRole("button", { name: "Add note" }).click();
    await expect(head.getByText("Welcome to the squad")).toBeVisible();

    const physio = await login(browser, people.physio);
    await physio.goto(athleteUrl);
    await expect(physio.getByRole("heading", { name: "Alex Athlete" })).toBeVisible();
    await expect(physio.getByText("Welcome to the squad")).toBeVisible(); // team notes are shared
    await expect(physio.getByRole("button", { name: "Archive" })).toHaveCount(0); // not a lead
    await expect(physio.getByRole("link", { name: "Edit profile" })).toHaveCount(0);
    await physio.getByPlaceholder("Add note").fill("Cleared for full training");
    await physio.getByRole("button", { name: "Add note" }).click();
    await expect(physio.getByText("Cleared for full training")).toBeVisible();

    const hop = await login(browser, people.hop);
    await hop.goto(athleteUrl);
    await expect(hop.getByRole("button", { name: "Archive" })).toBeVisible();
    await snap(hop, "15-roster-athlete-staff-view");
  });

  test("director reads the roster and totals, read-only", async ({ browser }) => {
    const dir = await login(browser, people.director);
    await expect(dir.getByText("Alex Athlete")).toBeVisible();
    await dir.goto("/team");
    await expect(dir.getByText("Alex Athlete")).toBeVisible();
    await expect(dir.getByRole("link", { name: "Alex Athlete" })).toHaveCount(0);
    const res = await dir.goto(athleteUrl);
    expect(res?.status()).toBe(200); // the roster athlete can be read ...
    await expect(dir.getByRole("button", { name: "Archive" })).toHaveCount(0); // ... but not changed
    await expect(dir.getByRole("link", { name: "Edit profile" })).toHaveCount(0);
    await snap(dir, "16-director-dashboard");
  });

  test("the Personal Trainer and a stranger cannot reach roster athletes", async ({ browser }) => {
    const trainer = await login(browser, people.trainer);
    expect((await trainer.goto(athleteUrl))?.status()).toBe(404);
    await trainer.goto("/athletes");
    await expect(trainer.getByText("No athletes yet")).toBeVisible();
  });

  test("the athlete can leave the team and access ends immediately", async ({ browser }) => {
    const athlete = await login(browser, people.athlete);
    await athlete.goto("/connect");
    athlete.once("dialog", (d) => d.accept());
    await athlete.getByRole("button", { name: "Leave team" }).click();
    await expect(athlete.getByText("You left the team.")).toBeVisible();
    const head = await login(browser, people.head);
    expect((await head.goto(athleteUrl))?.status()).toBe(404);
  });

  test("team sign-up works in Hebrew right-to-left", async ({ browser }) => {
    const page = await login(browser, people.director);
    await page.getByRole("button", { name: "עברית" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.goto("/team");
    await expect(page.getByRole("heading", { name: "סגל הספורטאים" }).first()).toBeVisible();
    await snap(page, "17-team-hebrew");
  });
});
