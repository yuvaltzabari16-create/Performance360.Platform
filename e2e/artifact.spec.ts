import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";

// The shared page is published as an Artifact, where `window.claude` supplies the store (db) and the viewer (user).
// These tests build it, wrap it in a minimal document and give it a stand-in for that platform, kept in localStorage.
const DIR = join("dist-artifact", "test");
const FILE = pathToFileURL(join(DIR, "index.html")).href;

const STUB = `(() => {
  const KEY = "stub-store";
  const read = () => JSON.parse(localStorage.getItem(KEY) || "{}");
  const write = (o) => localStorage.setItem(KEY, JSON.stringify(o));
  const listeners = [];
  const direct = (col, path) => path.startsWith(col + "/") && path.slice(col.length + 1).split("/").length === 1;
  const snap = (col) => ({ docs: Object.entries(read()).filter(([p]) => direct(col, p)).map(([p, d]) => ({ id: p.slice(col.length + 1), data: () => d })) });
  const notify = (path) => listeners.filter((l) => path.startsWith(l.col + "/")).forEach((l) => l.fn(snap(l.col)));
  const db = {
    collection: (col) => ({ onSnapshot: (fn) => { const l = { col, fn }; listeners.push(l); setTimeout(() => fn(snap(col)), 0); return () => listeners.splice(listeners.indexOf(l), 1); } }),
    doc: (path) => ({
      set: async (d) => { const o = read(); o[path] = JSON.parse(JSON.stringify(d)); write(o); notify(path); },
      delete: async () => { const o = read(); delete o[path]; write(o); notify(path); },
    }),
  };
  const role = localStorage.getItem("stub-role") || "staff";
  const uid = localStorage.getItem("stub-uid") || "u_coach";
  const people = [{ id: "u_noa", name: "Noa Cohen" }, { id: "u_coach", name: "Coach" }];
  const user = {
    isOwner: async () => role === "staff", canEdit: async () => role === "staff", can: async () => true, id: async () => uid,
    me: async () => ({ id: uid, name: "", avatarUrl: "", color: "#000", email: null, isOwner: role === "staff", canEdit: role === "staff" }),
    search: async (q) => people.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    profiles: async (ids) => Object.fromEntries([].concat(ids).map((id) => [id, { id, name: (people.find((p) => p.id === id) || {}).name || "", avatarUrl: "", color: "#000", email: null, isMe: id === uid, guest: false }])),
  };
  const saved = [];
  window.__saved = saved;
  const downloads = { save: async (r) => { saved.push(r); return { status: "saved" }; } };
  window.claude = { use: async (n) => (localStorage.getItem("stub-nodb") === "1" && n === "db" ? null : { db, user, downloads }[n] || null) };
})();`;

const store = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("stub-store") || "{}") as Record<string, unknown>);
const nav = (page: Page, name: string) => page.getByLabel("Main").getByRole("button", { name, exact: true });

test.describe.serial("Performance360 shared page", () => {
  test.beforeAll(() => {
    execSync("npm run build:artifact", { stdio: "pipe" });
    mkdirSync(DIR, { recursive: true });
    const fragment = readFileSync(join("dist-artifact", "performance360.html"), "utf8");
    writeFileSync(join(DIR, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${fragment}</body></html>`);
  });

  test("a coach works with shared data, links an athlete, and the athlete sees only their own check-in", async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(STUB);
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

    // coach: add an athlete and link an account
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await nav(page, "Athletes").click();
    await page.getByRole("button", { name: "Add athlete" }).click();
    await page.getByLabel("Name").fill("Ari Athlete");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Linked account" })).toBeVisible();
    await page.getByLabel("Search people by name").fill("Noa");
    await page.getByRole("button", { name: "Link", exact: true }).click();
    await expect(page.getByText("Linked to Noa Cohen")).toBeVisible();

    // coach saves a check-in for today
    await page.getByLabel("Sleep (hours)").fill("7");
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await expect.poll(async () => Object.keys(await store(page)).filter((k) => k.startsWith("checkins/u_noa/months/")).length, { timeout: 5000 }).toBe(1);
    const keys = Object.keys(await store(page));
    expect(keys.some((k) => k.startsWith("athletes/"))).toBe(true);
    expect(keys).toContain("checkins/u_noa/link/me");

    // the linked athlete opens the page with their own account
    await page.evaluate(() => { localStorage.setItem("stub-role", "athlete"); localStorage.setItem("stub-uid", "u_noa"); });
    await page.reload();
    await expect(page.getByRole("heading", { name: "My check-in" })).toBeVisible();
    await expect(page.getByText("Hello Ari Athlete")).toBeVisible();
    await expect(page.getByLabel("Main")).toHaveCount(0);           // no coach navigation
    await expect(page.getByText("Linked account")).toHaveCount(0);
    await page.getByLabel("Sleep (hours)").fill("8");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(async () => JSON.stringify((await store(page))["checkins/u_noa/months/" + new Date().toISOString().slice(0, 7)] ?? "").includes('"sleepHours":8'), { timeout: 5000 }).toBe(true);

    // an account that is not linked is told to wait
    await page.evaluate(() => { localStorage.setItem("stub-uid", "u_other"); });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Waiting for your coach" })).toBeVisible();

    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await ctx.close();
  });

  test("without the shared store the page shows example data and saves nothing", async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(STUB);
    await ctx.addInitScript(() => localStorage.setItem("stub-nodb", "1"));
    const page = await ctx.newPage();
    await page.goto(FILE);
    await expect(page.getByText(/Example data\. You are not signed in/)).toBeVisible();
    await nav(page, "Athletes").click();
    await expect(page.getByRole("button", { name: /Example: Dana/ })).toBeVisible();
    expect(Object.keys(await store(page))).toEqual([]);
    await ctx.close();
  });

  test("Hebrew is right-to-left and exports go through the viewer's save prompt", async ({ browser }) => {
    const ctx = await browser.newContext({ locale: "he-IL" });
    await ctx.addInitScript(STUB);
    const page = await ctx.newPage();
    await page.goto(FILE);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.getByLabel("Main").getByRole("button").last().click();
    await page.getByRole("button", { name: "ייצוא גיבוי (JSON)" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __saved: { filename: string }[] }).__saved.length)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await ctx.close();
  });
});
