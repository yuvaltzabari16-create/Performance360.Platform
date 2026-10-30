import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

// Performance360 Lite is one html file opened from disk: no server, no network. These tests build it and use it.
const FILE = pathToFileURL("dist-lite/performance360-lite.html").href;
const stored = (page: import("@playwright/test").Page) => page.evaluate(() => new Promise<{ programs: number; items: number } | null>((res) => {
  const r = indexedDB.open("performance360-lite", 1);
  r.onsuccess = () => {
    const g = r.result.transaction("kv").objectStore("kv").get("state");
    g.onsuccess = () => res(g.result ? { programs: g.result.programs.length, items: g.result.programs.flatMap((p: { sessions: { items: { values: { reps?: string } }[] }[] }) => p.sessions.flatMap((x) => x.items)).filter((i: { values: { reps?: string } }) => i.values.reps === "4x6").length } : null);
  };
}));
const nav = (page: import("@playwright/test").Page, name: string) => page.getByLabel("Main").getByRole("button", { name, exact: true });
const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

test.describe.serial("Performance360 Lite", () => {
  test.beforeAll(() => { execSync("npm run build:lite", { stdio: "pipe" }); });

  test("works from disk with no network, saves data, and survives a reload", async ({ browser }) => {
    const ctx = await browser.newContext({ acceptDownloads: true });
    const external: string[] = [];
    await ctx.route("**/*", (route) => {
      const u = route.request().url();
      if (u.startsWith("file:") || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
      external.push(u);
      return route.abort();
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(FILE);

    await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText("Start by adding your first athlete.")).toBeVisible();

    // athlete + check-in with pain
    await nav(page, "Athletes").click();
    await page.getByRole("button", { name: "Add athlete" }).click();
    await page.getByLabel("Name").fill("Ari Athlete");
    await page.getByLabel("Sport").fill("Football");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByLabel("Name")).toHaveValue("Ari Athlete");
    await page.getByLabel("Sleep (hours)").fill("7.5");
    for (const label of ["Sleep quality", "Mood", "Motivation"]) await page.getByLabel(label, { exact: true }).selectOption("4");
    for (const label of ["Fatigue", "Muscle soreness", "Stress"]) await page.getByLabel(label, { exact: true }).selectOption("2");
    await page.getByLabel("Any pain or discomfort?").check();
    await page.getByRole("button", { name: "Save" }).first().click();
    await expect(page.getByRole("cell", { name: day(0) })).toBeVisible();

    // injury: clearing needs a written basis
    await page.getByRole("tab", { name: "Injuries" }).click();
    await page.getByLabel("Body area").selectOption("hamstring");
    await page.getByRole("button", { name: "Report injury" }).click();
    await expect(page.getByRole("heading", { name: /Hamstring/ })).toBeVisible();
    await page.getByLabel("Move to stage", { exact: true }).selectOption("cleared");
    await page.getByRole("button", { name: "Move to stage" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Write the basis for clearing" })).toBeVisible();
    await page.getByPlaceholder("Note (required to clear)").fill("Cleared by the physio after the return-to-run tests");
    await page.getByRole("button", { name: "Move to stage" }).click();
    await expect(page.getByRole("heading", { name: /Hamstring/ })).toContainText("Cleared");

    // training load by CSV: a spike after four steady weeks
    await page.getByRole("tab", { name: "Load" }).click();
    const rows = ["athlete,date,load", ...Array.from({ length: 28 }, (_, i) => `Ari Athlete,${day(i + 7)},100`), ...Array.from({ length: 7 }, (_, i) => `Ari Athlete,${day(i)},200`)];
    await page.locator('input[type="file"]').setInputFiles({ name: "load.csv", mimeType: "text/csv", buffer: Buffer.from(rows.join("\n")) });
    await expect(page.getByRole("status")).toContainText("35 rows imported");
    await expect(page.getByText("High", { exact: true })).toBeVisible();

    // overview shows the workload flag and the wellness flag
    await nav(page, "Overview").click();
    await expect(page.getByText(/workload ratio 1\.6/)).toBeVisible();
    await expect(page.getByText(/Wellness flag today/)).toBeVisible();

    // auto-build a session and edit a value
    await nav(page, "Training").click();
    await page.getByLabel("Program title").fill("Block A");
    await page.getByRole("button", { name: "New program" }).click();
    await page.getByRole("button", { name: "New session" }).click();
    await page.getByRole("button", { name: "Auto-build session" }).click();
    await page.getByLabel("Describe the session").fill("Lower body power, 60 minutes, no barbell");
    await page.getByRole("button", { name: "Generate workout" }).click();
    const preview = page.getByRole("region", { name: "Generated workout preview" });
    await expect(preview.getByText(/exercises from your library/)).toBeVisible();
    const first = await preview.innerText();
    await page.getByRole("button", { name: "Another version" }).click();
    await expect.poll(async () => (await preview.innerText()) !== first).toBe(true);
    await page.getByRole("button", { name: "Add to this session" }).click();
    const firstRepsField = page.getByLabel("Reps", { exact: true }).first();
    await expect(firstRepsField).toBeVisible();
    await firstRepsField.fill("4x6");
    await firstRepsField.blur();
    const warm = await page.locator("li b").first().innerText();

    // reload: everything is still there (IndexedDB on file://)
    await expect.poll(() => stored(page)).toEqual({ programs: 1, items: 1 });
    await page.reload();
    await nav(page, "Training").click();
    await page.getByRole("button", { name: "Block A" }).click();
    await expect(page.locator("li b").first()).toHaveText(warm);
    await expect(page.getByLabel("Reps", { exact: true }).first()).toHaveValue("4x6");

    // assistant: knowledge base and answers from the local records
    await nav(page, "Assistant").click();
    await page.getByLabel("Type your question").fill("who has not checked in today");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("assistant-log")).toContainText("Checked in today: 1 of 1");
    await page.getByLabel("Type your question").fill("how do I warm up?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("assistant-log")).toContainText("Warm-up structure");

    // export, wipe, import
    await nav(page, "Settings").click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export backup (JSON)" }).click()]);
    const path = await download.path();
    const backup = JSON.parse(readFileSync(path, "utf8"));
    expect(backup.athletes).toHaveLength(1);
    expect(backup.programs[0].title).toBe("Block A");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete all data" }).click();
    await nav(page, "Athletes").click();
    await expect(page.getByText("No athletes yet.")).toBeVisible();
    await nav(page, "Settings").click();
    page.once("dialog", (d) => d.accept());
    await page.locator('input[aria-label="Import backup"]').setInputFiles(path);
    await expect(page.getByRole("status")).toContainText("Imported 1 athletes and 1 programs.");

    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await ctx.close();
  });

  test("Hebrew runs right to left and dark mode applies", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(FILE);
    await page.getByRole("button", { name: "Start" }).click();
    await nav(page, "Settings").click();
    await page.getByLabel("Language").selectOption("he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "הגדרות" })).toBeVisible();
    await page.getByLabel("מראה").selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    // no horizontal scroll at phone width
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Hebrew request in the builder
    await nav(page, "אימונים").click();
    await page.getByLabel("שם התוכנית").fill("תוכנית א");
    await page.getByRole("button", { name: "תוכנית חדשה" }).click();
    await page.getByRole("button", { name: "אימון חדש" }).click();
    await page.getByRole("button", { name: "בניית אימון אוטומטית" }).click();
    await page.getByRole("textbox").last().fill("אימון כוח פלג גוף תחתון 45 דקות");
    await page.getByRole("button", { name: /יצירת אימון|Generate/ }).click();
    await expect(page.getByText("אימון כוח פלג גוף תחתון · 45")).toBeVisible();
    await ctx.close();
  });
  test("the website copy asks for a passcode, locks again, and forgetting it erases the data", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(pathToFileURL("site-lite/index.html").href);

    // first visit: create a passcode (short and mismatching ones are refused)
    await expect(page.getByRole("heading", { name: "Create your passcode" })).toBeVisible();
    await page.getByLabel(/^Passcode/).fill("short");
    await page.getByLabel("Repeat the passcode").fill("short");
    await page.getByRole("button", { name: /Create passcode/ }).click();
    await expect(page.getByRole("heading", { name: "Create your passcode" })).toBeVisible();
    await page.getByLabel(/^Passcode/).fill("correct horse");
    await page.getByLabel("Repeat the passcode").fill("correct horses");
    await page.getByRole("button", { name: /Create passcode/ }).click();
    await expect(page.getByText("The two passcodes don't match.")).toBeVisible();
    await page.getByLabel("Repeat the passcode").fill("correct horse");
    await page.getByRole("button", { name: /Create passcode/ }).click();
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
    await page.getByRole("button", { name: "Start" }).click();

    // add an athlete, then lock from Settings
    await nav(page, "Athletes").click();
    await page.getByRole("button", { name: "Add athlete" }).click();
    await page.getByLabel("Name").fill("Locked Athlete");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => stored(page).then((v) => v !== null)).toBe(true);
    await nav(page, "Settings").click();
    await page.getByRole("button", { name: "Lock now" }).first().click();
    await expect(page.getByRole("heading", { name: "Enter your passcode" })).toBeVisible();
    await expect(page.getByText("Locked Athlete")).toHaveCount(0);

    // wrong passcode, then the right one; a reload asks again
    await page.getByLabel("Passcode").fill("not it at all");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByText("That passcode isn't right.")).toBeVisible();
    await page.getByLabel("Passcode").fill("correct horse");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(nav(page, "Athletes")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Enter your passcode" })).toBeVisible();

    // forgot: the data is erased and a new passcode can be made
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "I forgot my passcode" }).click();
    await expect(page.getByRole("heading", { name: "Create your passcode" })).toBeVisible();
    expect(await stored(page)).toBeNull();
    expect(errors).toEqual([]);
    await ctx.close();
  });
  test("as an artifact page the passcode works and the in-page dialog replaces the browser's confirm", async ({ browser }) => {
    const { mkdirSync, readFileSync, writeFileSync } = await import("node:fs");
    mkdirSync("dist-artifact/test-lite", { recursive: true });
    const fragment = readFileSync("dist-artifact/performance360-lite.html", "utf8");
    writeFileSync("dist-artifact/test-lite/index.html", `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${fragment}</body></html>`);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => { errors.push(`unexpected browser dialog: ${d.message()}`); void d.dismiss(); });
    await page.goto(pathToFileURL("dist-artifact/test-lite/index.html").href);
    await page.getByLabel(/^Passcode/).fill("artifact pass");
    await page.getByLabel("Repeat the passcode").fill("artifact pass");
    await page.getByRole("button", { name: /Create passcode/ }).click();
    await page.getByRole("button", { name: "Start" }).click();
    await nav(page, "Settings").click();
    await expect(page.getByLabel("Appearance")).toHaveCount(0);
    await page.getByRole("button", { name: "Lock now" }).first().click();
    await page.getByRole("button", { name: "I forgot my passcode" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Yes" }).click();
    await expect(page.getByRole("heading", { name: "Create your passcode" })).toBeVisible();
    expect(errors).toEqual([]);
    await ctx.close();
  });
});
