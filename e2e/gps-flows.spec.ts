import { expect, test, type Browser, type Page } from "@playwright/test";

// GPS & wearables: import an export, look at the session table and heat map, and check who sees what.
const run = Date.now().toString(36);
const password = "correct-horse-42";
const people = {
  director: { name: "Gina Director", email: `gps.director.${run}@example.com` },
  hop: { name: "Hugo Performance", email: `gps.hop.${run}@example.com` },
  physio: { name: "Pia Physio", email: `gps.physio.${run}@example.com` },
  athlete: { name: "Alex Runner", email: `gps.athlete.${run}@example.com` },
};
const shots = process.env.E2E_SCREENSHOTS;
const invites: Record<string, string> = {};
let athleteCode = "";

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

/** Position readings for one athlete: a run up the right wing, 60 seconds at 2 readings per second. */
function samplesCsv(name: string) {
  const lines = ["athlete,time_s,x_m,y_m,speed_kmh,hr"];
  for (let i = 0; i <= 120; i++) lines.push(`${name},${i / 2},${Math.min(104, 50 + i * 0.4)},${60},${i % 40 < 12 ? 27 : 12},${150 + (i % 10)}`);
  return lines.join("\n");
}

async function upload(page: Page, csv: string) {
  await page.locator('input[type="file"]').setInputFiles({ name: "export.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
}

test.describe.serial("GPS", () => {
  test("set up a team with a head of performance, a physiotherapist and an athlete", async ({ page, browser }) => {
    await page.goto("/");
    await page.locator('[data-account-type="team"]').click();
    await page.waitForURL(/\/signup/);
    await signup(page, people.director);
    await page.getByRole("link", { name: /Create a team/ }).click();
    await page.getByLabel("Team or club name").fill("FC Tracking");
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
  });

  test("the head of performance imports a position-data export and sees the heat map", async ({ browser }) => {
    const page = await login(browser, people.hop);
    await page.getByRole("link", { name: "GPS" }).first().click();
    await expect(page.getByText("No GPS sessions yet")).toBeVisible();
    await expect(page.getByText("StatSports").first()).toBeVisible();
    await page.getByRole("link", { name: "Import session" }).first().click();
    await page.getByLabel("Session title").fill("Match vs Rivals");
    await page.getByLabel("File type").selectOption("samples");
    await upload(page, samplesCsv("Alex Runner") + "\n" + samplesCsv("Unknown Guest").split("\n").slice(1).join("\n"));
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByText("Session imported.")).toBeVisible();
    await expect(page.getByText(/no roster match: Unknown Guest/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Match vs Rivals" })).toBeVisible();
    await expect(page.getByTestId("pitch-heat-map")).toBeVisible();
    await expect(page.getByText("Distance by speed zone")).toBeVisible();
    await expect(page.getByRole("link", { name: "Alex Runner" })).toBeVisible();
  });

  test("a summary export imports without a heat map, and the sample session is labelled", async ({ browser }) => {
    const page = await login(browser, people.hop);
    await page.goto("/gps/import");
    await page.getByLabel("Session title").fill("Training summary");
    await upload(page, "Player,Total Distance (km),High Speed Running (m),Sprints,Max Speed\nAlex Runner,7.2,640,9,30.4\n");
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(page.getByText("Session imported.")).toBeVisible();
    await expect(page.getByText("7.2 km").first()).toBeVisible();
    await expect(page.getByText(/No position data in this import/).first()).toBeVisible();

    await page.goto("/gps");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Load sample session" }).click();
    await expect(page.getByText("Sample data").first()).toBeVisible();
    await expect(page.getByTestId("pitch-heat-map")).toBeVisible();
    if (shots) await page.screenshot({ path: `${shots}/gps-sample.png`, fullPage: true });
  });

  test("the athlete sees only their own numbers", async ({ browser }) => {
    const page = await login(browser, people.athlete);
    await page.getByRole("link", { name: "GPS" }).first().click();
    await expect(page.getByRole("link", { name: "Match vs Rivals" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Import session" })).toHaveCount(0);
    await page.getByRole("link", { name: "Match vs Rivals" }).click();
    await expect(page.getByTestId("pitch-heat-map")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete session" })).toHaveCount(0);
  });

  test("the physiotherapist imports, the director only reads", async ({ browser }) => {
    const physio = await login(browser, people.physio);
    await physio.goto("/gps");
    await expect(physio.getByRole("link", { name: "Match vs Rivals" })).toBeVisible();
    await expect(physio.getByRole("link", { name: "Import session" }).first()).toBeVisible(); // the physiotherapist imports too

    const director = await login(browser, people.director);
    const menu = director.getByRole("navigation").first();
    await expect(menu.getByRole("link", { name: "GPS" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Training Planner" })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Exercise Library" })).toHaveCount(0);
    await director.goto("/gps");
    await expect(director.getByRole("link", { name: "Match vs Rivals" })).toBeVisible();
    await expect(director.getByRole("link", { name: "Import session" })).toHaveCount(0);
    await director.getByRole("link", { name: "Match vs Rivals" }).click();
    await expect(director.getByRole("link", { name: "Alex Runner" })).toBeVisible();
    await expect(director.getByTestId("pitch-heat-map")).toBeVisible();
    for (const path of ["/training", "/exercises"]) {
      await director.goto(path);
      await expect(director).toHaveURL(/\/dashboard/);
    }
  });
});
