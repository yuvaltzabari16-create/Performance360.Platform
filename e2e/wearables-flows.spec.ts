import { expect, test, type Browser, type Page } from "@playwright/test";

// Wearables: the athlete connects WHOOP (against the built-in test provider), imports Fitbit files and
// decides whether staff and the director see it. Requires the server to run with WEARABLES_MOCK=1.
const run = Date.now().toString(36);
const password = "correct-horse-42";
const people = {
  director: { name: "Dara Director", email: `wear.director.${run}@example.com` },
  hop: { name: "Hugo Performance", email: `wear.hop.${run}@example.com` },
  athlete: { name: "Wanda Wearable", email: `wear.athlete.${run}@example.com` },
};
const invites: Record<string, string> = {};
let athleteCode = "";
let athleteUrl = "";

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

test.describe.serial("Wearables", () => {
  test("set up a team", async ({ page, browser }) => {
    await page.goto("/");
    await page.locator('[data-account-type="team"]').click();
    await page.waitForURL(/\/signup/);
    await signup(page, people.director);
    await page.getByRole("link", { name: /Create a team/ }).click();
    await page.getByLabel("Team or club name").fill("FC Wear");
    await page.getByRole("button", { name: "Create a team" }).click();
    await page.waitForURL(/\/team/);
    athleteCode = (await page.locator(".tracking-\\[0\\.2em\\]").innerText()).trim();
    await page.locator('form:has(button:text("Create invitation")) select').selectOption("head_of_performance");
    await page.getByRole("button", { name: "Create invitation" }).click();
    await expect(page.getByText("Invitation created.")).toBeVisible();
    invites.hop = (await page.locator("li").filter({ hasText: /STAFF-/ }).first().innerText()).match(/STAFF-[A-Z0-9]{6}/)![0];
    const hop = await (await browser.newContext()).newPage();
    await hop.goto(`/join/${invites.hop}`);
    await signup(hop, people.hop);
    await hop.getByRole("button", { name: "Join team" }).click();
    await hop.waitForURL(/\/dashboard/);
    const ath = await (await browser.newContext()).newPage();
    await ath.goto(`/join/${athleteCode}`);
    await signup(ath, people.athlete);
    await ath.getByRole("button", { name: "Continue" }).click();
    await ath.waitForURL(/\/connect\?code=TEAM-/);
    await ath.getByRole("button", { name: "Join team" }).click();
    await expect(ath.getByText("You're connected.")).toBeVisible();
  });

  test("the athlete connects WHOOP; data is private until shared", async ({ browser }) => {
    const page = await login(browser, people.athlete);
    await page.getByRole("navigation").first().getByRole("link", { name: "Wearables" }).click();
    await expect(page.getByTestId("wearable-fitbit").getByText(/closes on 30 October 2026/)).toBeVisible();
    await expect(page.getByText("No data yet.")).toBeVisible();
    await page.getByRole("link", { name: "Connect WHOOP" }).click();
    await page.waitForURL(/\/wearables\?ok=/);
    await expect(page.getByText("WHOOP connected.")).toBeVisible();
    await expect(page.getByTestId("wearable-whoop").getByText("Connected")).toBeVisible();
    await expect(page.getByText("Latest day:")).toBeVisible();
    await expect(page.getByText("Recovery").first()).toBeVisible();
    await expect(page.getByText(/Only you can see this until you share it/)).toBeVisible();
    await page.getByRole("button", { name: "Sync now" }).click();
    await expect(page.getByText(/Synced \d+ days\./)).toBeVisible();
  });

  test("a forged or reused connection request is refused", async ({ browser }) => {
    const page = await login(browser, people.athlete);
    await page.goto("/api/wearables/whoop/callback?code=mock-code&state=forged.state");
    await expect(page.getByText(/connection request expired or did not match/)).toBeVisible();
  });

  test("staff see nothing until the athlete shares, then the numbers", async ({ browser }) => {
    const hop = await login(browser, people.hop);
    await hop.goto("/wearables");
    await expect(hop.getByText(/No athlete has shared wearable data with you yet/)).toBeVisible();
    await hop.goto("/athletes");
    await hop.getByRole("link", { name: "Wanda Wearable" }).click();
    await hop.waitForURL(/\/athletes\/[0-9a-f-]{36}$/);
    athleteUrl = hop.url();
    await expect(hop.getByText("This athlete has not shared wearable data.")).toBeVisible();

    const ath = await login(browser, people.athlete);
    await ath.goto("/wearables");
    await ath.getByLabel("Share with my coaching staff").check();
    await ath.getByTestId("wearable-whoop").getByRole("button", { name: "Save" }).click();
    await expect(ath.getByText("Sharing is on.").first()).toBeVisible();

    await hop.goto("/wearables");
    await expect(hop.getByRole("link", { name: "Wanda Wearable" })).toBeVisible();
    await hop.goto(athleteUrl);
    await expect(hop.getByText("Latest day:")).toBeVisible();

    const dir = await login(browser, people.director);
    await dir.goto("/wearables");
    await expect(dir.getByRole("link", { name: "Wanda Wearable" })).toBeVisible(); // the director reads, read-only
  });

  test("the athlete imports Fitbit export files", async ({ browser }) => {
    const page = await login(browser, people.athlete);
    await page.goto("/wearables");
    const sleep = JSON.stringify([{ dateOfSleep: "2026-09-01", minutesAsleep: 435, efficiency: 90, isMainSleep: true }]);
    const input = page.getByTestId("wearable-fitbit").locator('input[type="file"]');
    await input.setInputFiles([
      { name: "sleep-2026-09-01.json", mimeType: "application/json", buffer: Buffer.from(sleep) },
      { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
    ]);
    await page.getByTestId("wearable-fitbit").getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByText(/Imported 1 days\./)).toBeVisible();
    await expect(page.getByText(/Not recognized: notes\.txt/)).toBeVisible();
    await expect(page.getByTestId("wearable-fitbit").getByText("Connected")).toBeVisible();
  });

  test("disconnecting stops sharing immediately", async ({ browser }) => {
    const ath = await login(browser, people.athlete);
    await ath.goto("/wearables");
    ath.once("dialog", (d) => d.accept());
    await ath.getByTestId("wearable-whoop").getByRole("button", { name: "Disconnect" }).click();
    await expect(ath.getByText("Disconnected.")).toBeVisible();
    const hop = await login(browser, people.hop);
    await hop.goto("/wearables");
    await expect(hop.getByText(/No athlete has shared wearable data with you yet/)).toBeVisible();
  });
});
