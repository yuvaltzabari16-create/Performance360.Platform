import { expect, test, type Browser, type Page } from "@playwright/test";

// Files in every category: injuries, messages, testing, athlete documents, training programs and GPS sessions.
const run = Date.now().toString(36);
const password = "correct-horse-42";
const people = {
  director: { name: "Dina Director", email: `files.director.${run}@example.com` },
  hop: { name: "Hugo Performance", email: `files.hop.${run}@example.com` },
  physio: { name: "Pia Physio", email: `files.physio.${run}@example.com` },
  athlete: { name: "Alma Athlete", email: `files.athlete.${run}@example.com` },
  outsider: { name: "Otto Outsider", email: `files.outsider.${run}@example.com` },
};
const invites: Record<string, string> = {};
let athleteCode = "";
let athleteUrl = "";
let programUrl = "";
let gpsUrl = "";
let injuryFileHref = "";

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

/** Attaches a small file inside one category's file panel. */
async function attach(page: Page, kind: string, name: string, content = "hello file") {
  const panel = page.getByTestId(`files-${kind}`).first();
  await panel.locator('input[type="file"]').setInputFiles({ name, mimeType: "application/octet-stream", buffer: Buffer.from(content) });
  await panel.getByRole("button", { name: "Attach file" }).click();
  await expect(page.getByText("File attached.")).toBeVisible();
  await expect(page.getByTestId(`files-${kind}`).first().getByRole("link", { name })).toBeVisible();
}

test.describe.serial("Files in every category", () => {
  test("set up a team", async ({ page, browser }) => {
    await page.goto("/");
    await page.locator('[data-account-type="team"]').click();
    await page.waitForURL(/\/signup/);
    await signup(page, people.director);
    await page.getByRole("link", { name: /Create a team/ }).click();
    await page.getByLabel("Team or club name").fill("FC Files");
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
    const out = await (await browser.newContext()).newPage();
    await out.goto("/signup?next=%2Fonboarding%3Ftype%3Dindependent");
    await signup(out, people.outsider);
    await out.getByRole("button", { name: "Continue" }).click();
    await out.waitForURL(/\/dashboard/);
  });

  test("the athlete reports an injury and attaches a medical report", async ({ browser }) => {
    const page = await login(browser, people.athlete);
    await page.goto("/injuries");
    await page.getByText("Report a problem").last().click();
    await page.getByLabel("Body area").selectOption("ankle");
    await page.getByRole("button", { name: "Save injury" }).click();
    await expect(page.getByText("Injury reported")).toBeVisible();
    await attach(page, "injury", "mri-report.pdf", "%PDF-1.4 mri");
    injuryFileHref = (await page.getByTestId("files-injury").first().getByRole("link", { name: "mri-report.pdf" }).getAttribute("href"))!;
    // A file type outside the list is refused with a clear message.
    const panel = page.getByTestId("files-injury").first();
    await panel.locator('input[type="file"]').setInputFiles({ name: "run.exe", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
    await panel.getByRole("button", { name: "Attach file" }).click();
    await expect(page.getByText(/file type is not allowed/)).toBeVisible();
    // Download: the right bytes, always as an attachment.
    const res = await page.request.get(injuryFileHref);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toContain("attachment");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(await res.text()).toBe("%PDF-1.4 mri");
  });

  test("staff read it, add their own file, and set up the other categories", async ({ browser }) => {
    const physio = await login(browser, people.physio);
    await physio.goto("/athletes");
    await physio.getByRole("link", { name: "Alma Athlete" }).click();
    await physio.waitForURL(/\/athletes\/[0-9a-f-]{36}$/);
    athleteUrl = physio.url();
    await expect(physio.getByTestId("files-injury").first().getByRole("link", { name: "mri-report.pdf" })).toBeVisible();
    await attach(physio, "injury", "rehab-plan.docx", "plan");
    await attach(physio, "athlete", "consent-form.pdf", "%PDF consent");

    const hop = await login(browser, people.hop);
    await hop.goto("/training/new");
    await hop.getByLabel("Program title *").fill("Speed Block");
    await hop.getByLabel("Number of weeks").fill("2");
    await hop.getByRole("button", { name: "Create" }).click();
    await hop.waitForURL(/\/training\/[0-9a-f-]{36}$/);
    programUrl = hop.url();
    await attach(hop, "training", "periodization.xlsx", "sheet");

    await hop.goto("/gps/import");
    await hop.getByLabel("Session title").fill("Files session");
    await hop.locator('input[type="file"]').setInputFiles({ name: "export.csv", mimeType: "text/csv", buffer: Buffer.from("Player,Total Distance (m)\nAlma Athlete,5000\n") });
    await hop.getByRole("button", { name: "Import", exact: true }).click();
    await expect(hop.getByText("Session imported.")).toBeVisible();
    gpsUrl = hop.url().split("?")[0];
    await attach(hop, "gps", "match-report.pdf", "%PDF gps");

    // Testing documents for one athlete.
    const athleteId = athleteUrl.split("/").pop()!;
    await hop.goto(`/testing?athlete=${athleteId}`);
    await attach(hop, "test", "cmj-protocol.csv", "a,b");
  });

  test("messages carry files too", async ({ browser }) => {
    const hop = await login(browser, people.hop);
    await hop.goto("/messages");
    const value = await hop.locator("select[name=with] option", { hasText: "Alma Athlete" }).getAttribute("value");
    await hop.locator("select[name=with]").selectOption(value!);
    await hop.getByRole("button", { name: "New message" }).click();
    await hop.waitForURL(/with=/);
    await hop.getByLabel("Write a message").fill("Your plan is attached.");
    await hop.locator('input[type="file"]').setInputFiles({ name: "plan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF msg") });
    await hop.getByRole("button", { name: "Send" }).click();
    await expect(hop.getByText("Message sent.")).toBeVisible();
    await expect(hop.getByTestId("thread").getByRole("link", { name: /plan\.pdf/ })).toBeVisible();

    const ath = await login(browser, people.athlete);
    await ath.goto("/messages");
    await ath.getByTestId("threads").getByRole("link").first().click();
    const href = await ath.getByTestId("thread").getByRole("link", { name: /plan\.pdf/ }).getAttribute("href");
    expect((await ath.request.get(href!)).status()).toBe(200);
    // Athletes see their testing documents but cannot add any.
    await ath.goto("/testing");
    await expect(ath.getByTestId("files-test").getByRole("link", { name: "cmj-protocol.csv" })).toBeVisible();
    await expect(ath.getByTestId("files-test").locator('input[type="file"]')).toHaveCount(0);
    await ath.goto("/gps");
    await ath.getByRole("link", { name: "Files session" }).click();
    await expect(ath.getByTestId("files-gps").getByRole("link", { name: "match-report.pdf" })).toBeVisible();
  });

  test("the director reads the files but cannot add; outsiders get nothing", async ({ browser }) => {
    const dir = await login(browser, people.director);
    await dir.goto(athleteUrl);
    await expect(dir.getByTestId("files-injury").first().getByRole("link", { name: "mri-report.pdf" })).toBeVisible();
    await expect(dir.getByTestId("files-athlete").getByRole("link", { name: "consent-form.pdf" })).toBeVisible();
    await expect(dir.getByTestId("files-athlete").locator('input[type="file"]')).toHaveCount(0);
    expect((await dir.request.get(injuryFileHref)).status()).toBe(200);
    await dir.goto(programUrl);
    await expect(dir).toHaveURL(/\/dashboard/); // the planner stays closed to the director

    const out = await login(browser, people.outsider);
    expect((await out.request.get(injuryFileHref)).status()).toBe(404);
    await out.goto(gpsUrl);
    await expect(out.getByTestId("files-gps")).toHaveCount(0);
  });

  test("a file can be removed by whoever attached it", async ({ browser }) => {
    const page = await login(browser, people.athlete);
    await page.goto("/injuries");
    await page.getByTestId("files-injury").first().getByRole("button", { name: /Remove/ }).first().click();
    await expect(page.getByText("File removed.")).toBeVisible();
  });
});
