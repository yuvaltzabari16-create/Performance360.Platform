import { expect, test, type Browser, type Page } from "@playwright/test";

// Each login sees only its own part of the app: director (club), head of performance (training),
// physiotherapist (medical), independent personal trainer (everything for their own clients).
const run = Date.now().toString(36);
const password = "correct-horse-42";
const people = {
  director: { name: "Dora Director", email: `roles.director.${run}@example.com` },
  hop: { name: "Hugo Performance", email: `roles.hop.${run}@example.com` },
  physio: { name: "Pia Physio", email: `roles.physio.${run}@example.com` },
  trainer: { name: "Paul Trainer", email: `roles.trainer.${run}@example.com` },
};
const invites: Record<string, string> = {};

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

const nav = (page: Page) => page.getByRole("navigation").first();

test.describe.serial("Role logins", () => {
  test("set up a team with a head of performance and a physiotherapist", async ({ page, browser }) => {
    await page.goto("/");
    await page.locator('[data-account-type="team"]').click();
    await page.waitForURL(/\/signup/);
    await signup(page, people.director);
    await page.getByRole("link", { name: /Create a team/ }).click();
    await page.getByLabel("Team or club name").fill("FC Roles");
    await page.getByRole("button", { name: "Create a team" }).click();
    await page.waitForURL(/\/team/);
    for (const [key, label] of [["head_of_performance", "Head of Performance"], ["physiotherapist", "Physiotherapist"]] as const) {
      await page.locator('form:has(button:text("Create invitation")) select').selectOption(key);
      await page.getByRole("button", { name: "Create invitation" }).click();
      await expect(page.getByText("Invitation created.")).toBeVisible();
      const item = page.locator("li").filter({ hasText: /STAFF-/ }).filter({ hasText: label }).first();
      invites[key] = (await item.innerText()).match(/STAFF-[A-Z0-9]{6}/)![0];
    }
    for (const [who, code] of [[people.hop, invites.head_of_performance], [people.physio, invites.physiotherapist]] as const) {
      const p = await (await browser.newContext()).newPage();
      await p.goto(`/join/${code}`);
      await signup(p, who);
      await p.getByRole("button", { name: "Join team" }).click();
      await p.waitForURL(/\/dashboard/);
    }
  });

  test("the director sees the club but no performance content", async ({ browser }) => {
    const page = await login(browser, people.director);
    await expect(nav(page).getByRole("link", { name: "My Team" })).toBeVisible();
    for (const name of ["Exercise Library", "Training Planner", "Testing", "Readiness"]) {
      await expect(nav(page).getByRole("link", { name })).toHaveCount(0);
    }
    for (const name of ["Athletes", "Calendar", "Injuries", "Messages", "Groups", "GPS", "Settings"]) {
      await expect(nav(page).getByRole("link", { name })).toBeVisible();
    }
    for (const path of ["/exercises", "/training", "/testing"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  test("the head of performance has the performance tools", async ({ browser }) => {
    const page = await login(browser, people.hop);
    for (const name of ["Training Planner", "Exercise Library", "Testing", "Injuries", "Groups"]) {
      await expect(nav(page).getByRole("link", { name })).toBeVisible();
    }
    await page.goto("/exercises");
    await expect(page).toHaveURL(/\/exercises/);
  });

  test("the physiotherapist has the medical side, rehab programs and GPS", async ({ browser }) => {
    const page = await login(browser, people.physio);
    for (const name of ["Injuries", "Athletes", "Readiness", "Training Planner", "Exercise Library", "GPS", "Messages"]) {
      await expect(nav(page).getByRole("link", { name })).toBeVisible();
    }
    await expect(nav(page).getByRole("link", { name: "Testing" })).toBeVisible();
    await page.goto("/training");
    await expect(page).toHaveURL(/\/training/);
    await page.goto("/testing");
    await expect(page).toHaveURL(/\/testing/);
    await page.goto("/gps/import");
    await expect(page.getByRole("heading", { name: "Import GPS session" })).toBeVisible();
    await page.goto("/injuries");
    await expect(page.getByRole("heading", { name: "Injury board" })).toBeVisible();
  });

  test("sign-in options check that the account matches the chosen role", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/login?as=director");
    await expect(page.getByTestId("login-roles").getByRole("link", { name: "Physiotherapist" })).toBeVisible();
    await page.getByLabel("Email").fill(people.physio.email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/not a Director account/)).toBeVisible();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/); // the session was closed again

    await page.goto("/login?as=physiotherapist");
    await page.getByLabel("Email").fill(people.physio.email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test("an independent personal trainer has their own full login", async ({ page }) => {
    await page.goto("/signup?next=%2Fonboarding%3Ftype%3Dindependent");
    await signup(page, people.trainer);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/dashboard/);
    for (const name of ["Athletes", "Training Planner", "Exercise Library", "Injuries", "Personal Code"]) {
      await expect(nav(page).getByRole("link", { name })).toBeVisible();
    }
    await expect(nav(page).getByRole("link", { name: "My Team" })).toHaveCount(0);
  });
});
