import { expect, test, type Page } from "@playwright/test";

// Data export, richer settings, per-role login panels and the scheduled sync endpoint.
const run = Date.now().toString(36);
const password = "correct-horse-42";
const trainer = { name: "Pat Exporter", email: `pf.trainer.${run}@example.com` };

async function signupTrainer(page: Page) {
  await page.goto("/signup?next=%2Fonboarding%3Ftype%3Dindependent");
  await page.getByLabel("Full name").fill(trainer.name);
  await page.getByLabel("Email").fill(trainer.email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding/);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe.serial("Platform", () => {
  test("each login shows what it opens", async ({ page }) => {
    await page.goto("/login?as=head_coach");
    const panel = page.getByTestId("login-role-panel");
    await expect(panel).toContainText("Your squads only");
    await expect(panel).toContainText("Training Planner");
    await page.goto("/login?as=director");
    await expect(page.getByTestId("login-role-panel")).toContainText("read-only");
    await expect(page.getByTestId("login-role-panel")).not.toContainText("Training Planner");
    await page.goto("/login?as=athlete");
    await expect(page.getByTestId("login-role-panel")).toContainText("You decide what staff can see");
  });

  test("the scheduled sync endpoint needs its secret", async ({ request }) => {
    expect((await request.get("/api/cron/wearables-sync")).status()).toBe(401);
    expect((await request.get("/api/cron/wearables-sync", { headers: { authorization: "Bearer wrong-secret-value-0000000" } })).status()).toBe(401);
    const ok = await request.get("/api/cron/wearables-sync", { headers: { authorization: "Bearer e2e-cron-secret-0123456789" } });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toEqual({ due: expect.any(Number), synced: expect.any(Number), failed: expect.any(Number) });
  });

  test("a trainer exports CSV; formulas are defused; strangers get nothing", async ({ page, browser }) => {
    await signupTrainer(page);
    await page.goto("/athletes/new");
    await page.getByLabel("Name *").fill("=HYPERLINK(\"http://x\")");
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForURL(/\/athletes\/[0-9a-f-]{36}$/);
    await page.goto("/athletes/new");
    await page.getByLabel("Name *").fill("Plain Athlete");
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForURL(/\/athletes\/[0-9a-f-]{36}$/);

    const res = await page.request.get("/export/athletes");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["content-disposition"]).toContain("performance360-athletes-");
    const text = await res.text();
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("Plain Athlete");
    expect(text).toContain("'=HYPERLINK"); // never starts with =
    expect(text).not.toMatch(/(^|,|\n)=HYPERLINK/);
    expect((await page.request.get("/export/gps")).status()).toBe(200);
    expect((await page.request.get("/export/nonsense")).status()).toBe(404);

    const stranger = await (await browser.newContext()).newPage();
    const out = await stranger.request.get("/export/athletes", { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308, 401]).toContain(out.status());
  });

  test("settings: download list, notification categories, sign out everywhere", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(trainer.email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/);
    await page.goto("/settings");
    const list = page.getByTestId("export-list");
    await expect(list.getByRole("link", { name: "Athletes" })).toBeVisible();
    await expect(list.getByRole("link", { name: "GPS sessions" })).toBeVisible();

    await page.getByLabel("Injuries and return to play").uncheck();
    await page.locator("form", { has: page.getByLabel("Injuries and return to play") }).getByRole("button", { name: "Save" }).click();
    await page.waitForURL(/ok=/);
    await page.goto("/settings");
    await expect(page.getByLabel("Injuries and return to play")).not.toBeChecked();
    await expect(page.getByLabel("Messages")).toBeChecked();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Sign out on all devices" }).click();
    await page.waitForURL(/\/login/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
