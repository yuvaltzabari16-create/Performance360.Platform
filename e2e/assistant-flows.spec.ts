import { expect, test, type Browser, type Page } from "@playwright/test";

// The chat assistant is available to every role and speaks to each role's own scope (AI_PROVIDER=mock echoes the role).
const run = Date.now().toString(36);
const password = "correct-horse-42";
const people = {
  director: { name: "Dina Director", email: `ai.director.${run}@example.com` },
  hop: { name: "Hugo Performance", email: `ai.hop.${run}@example.com` },
  physio: { name: "Pia Physio", email: `ai.physio.${run}@example.com` },
  athlete: { name: "Ari Athlete", email: `ai.athlete.${run}@example.com` },
  trainer: { name: "Tom Trainer", email: `ai.trainer.${run}@example.com` },
};
const invites: Record<string, string> = {};
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

/** Opens the assistant, asks a question and checks the reply names the expected role. */
async function ask(page: Page, role: string, question: string) {
  const box = page.getByTestId("assistant");
  await expect(box).toHaveAttribute("data-role", role);
  await box.getByRole("button", { name: "Open the assistant" }).click();
  await expect(page.getByRole("dialog", { name: "Performance360 assistant" })).toBeVisible();
  await page.getByLabel("Type your question").fill(question);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByTestId("assistant-log").getByText(`[mock assistant · ${role}] ${question}`)).toBeVisible();
  if (process.env.E2E_SCREENSHOTS) await page.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/assistant-${role}.png` });
}

test.describe.serial("Assistant for every role", () => {
  test("set up a team and a trainer", async ({ page, browser }) => {
    await page.goto("/");
    await page.locator('[data-account-type="team"]').click();
    await page.waitForURL(/\/signup/);
    await signup(page, people.director);
    await page.getByRole("link", { name: /Create a team/ }).click();
    await page.getByLabel("Team or club name").fill("FC Chat");
    await page.getByRole("button", { name: "Create a team" }).click();
    await page.waitForURL(/\/team/);
    athleteCode = (await page.locator(".tracking-\\[0\\.2em\\]").innerText()).trim();
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
    const ath = await (await browser.newContext()).newPage();
    await ath.goto(`/join/${athleteCode}`);
    await signup(ath, people.athlete);
    await ath.getByRole("button", { name: "Continue" }).click();
    await ath.waitForURL(/\/connect\?code=TEAM-/);
    await ath.getByRole("button", { name: "Join team" }).click();
    await expect(ath.getByText("You're connected.")).toBeVisible();
    const tr = await (await browser.newContext()).newPage();
    await tr.goto("/signup?next=%2Fonboarding%3Ftype%3Dindependent");
    await signup(tr, people.trainer);
    await tr.getByRole("button", { name: "Continue" }).click();
    await tr.waitForURL(/\/dashboard/);
  });

  test("each role gets the assistant, in its own scope", async ({ browser }) => {
    await ask(await login(browser, people.director), "director", "What can I see?");
    await ask(await login(browser, people.hop), "head_of_performance", "How do I plan a block?");
    await ask(await login(browser, people.physio), "physiotherapist", "Stages of return to play?");
    await ask(await login(browser, people.athlete), "athlete", "How do I connect my WHOOP?");
    await ask(await login(browser, people.trainer), "personal_trainer", "How do athletes connect to me?");
  });

  test("starter questions, clearing and closing work; there is no assistant on public pages", async ({ browser, page }) => {
    const ath = await login(browser, people.athlete);
    await ath.getByTestId("assistant").getByRole("button", { name: "Open the assistant" }).click();
    await ath.getByRole("button", { name: "What does my recovery score mean?" }).click();
    await expect(ath.getByTestId("assistant-log").getByText(/\[mock assistant · athlete\] What does my recovery score mean\?/)).toBeVisible();
    await ath.getByRole("button", { name: "Clear" }).click();
    await expect(ath.getByRole("button", { name: "How do I report a pain or injury?" })).toBeVisible();
    await ath.keyboard.press("Escape");
    await expect(ath.getByRole("dialog")).toHaveCount(0);
    await page.goto("/privacy");
    await expect(page.getByTestId("assistant")).toHaveCount(0);
  });
});
