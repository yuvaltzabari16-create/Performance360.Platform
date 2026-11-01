"use strict";
/* ============================================================================
   Performance360 Academy, one-file edition.
   Talks straight to the academy's Supabase project with the public (publishable) key. Every read and write is
   checked by the database's row-level security, exactly as in the full app, so this file holds no secrets.
   ============================================================================ */
const CONFIG = window.P360_CONFIG || {
  url: "https://bheprhssdyladsddalpy.supabase.co",
  key: "sb_publishable_XzN6bPpeGYD9WpB7vIupIA_Z1LUajyr",
  terms: "2026-10",
};
const sb = supabase.createClient(CONFIG.url, CONFIG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const L = window.P360; // the full app's own logic: assistant, calendar, payments, meals, progress, test maths

/* ---------------------------------------------------------------- helpers */
const S = { user: null, profile: null, org: null, athleteId: null, view: "dashboard", ui: {}, unread: 0, authStep: "email", authMode: "code", authEmail: "", busy: false };
const root = document.getElementById("root");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(2, "0");
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = () => isoLocal(new Date());
const addDays = (iso, n) => L.shiftDay(iso, n);
const fmtDate = (iso) => (iso ? new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: iso.slice(0, 4) === TODAY().slice(0, 4) ? undefined : "numeric" }) : "—");
const initials = (n) => String(n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const ui = (k, v) => (v === undefined ? S.ui[k] : (S.ui[k] = v));
const isStaff = () => S.profile?.role !== "athlete";
const isOwner = () => Boolean(S.org?.is_owner);
const ROLE = { head_coach: "Coach", physiotherapist: "Physiotherapist", director: "Coach", athlete: "Athlete" };
const roleLabel = () => (S.profile?.role === "athlete" ? "Athlete" : `${ROLE[S.org?.org_role] || "Coach"}${isOwner() ? " (owner)" : ""}`);
function toast(text, err = false) { const t = document.getElementById("toast"); t.textContent = text; t.className = "toast" + (err ? " err" : ""); t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), err ? 5200 : 2600); }
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* unavailable */ } } };

/** Runs a Supabase call and returns its data; shows a readable error and throws on failure. */
async function q(promise, msg) {
  const { data, error, count } = await promise;
  if (error) { console.error(error); toast(friendly(error, msg), true); throw error; }
  return count != null && data == null ? count : data;
}
function friendly(error, fallback) {
  const m = String(error?.message || "");
  if (/row-level security|not allowed|permission denied|42501/i.test(m)) return "You don't have permission to do that.";
  if (/at least one owner/i.test(m)) return "An academy needs at least one owner. Make another coach an owner first.";
  if (/rate limit|too many|security purposes/i.test(m)) return "Too many tries. Wait a minute and try again.";
  if (/token has expired|invalid.*(otp|token)|otp.*(expired|invalid)/i.test(m)) return "That code is wrong or has expired. Request a new one.";
  if (/invalid login credentials/i.test(m)) return "Email or password is wrong.";
  if (/email not confirmed/i.test(m)) return "Confirm your email first, or sign in with an email code.";
  return fallback || m || "Something went wrong. Please try again.";
}

/* ---------------------------------------------------------------- icons and charts */
const ICON = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  calendar: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  team: "M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8",
  plan: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  library: "M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8 1-3.9 15-3.8-1z",
  test: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  meal: "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.2 0-4 2.7-4 6v4h4",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  note: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  check: "M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14.1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10.3 5V5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V11a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};
const svg = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[k]}"/></svg>`;
const LOGO = `<svg viewBox="250 266 690 690" aria-hidden="true"><path d="M309 716A303 303 0 1 1 885 690" fill="none" stroke="var(--logo-deep)" stroke-width="53" stroke-linecap="round"/><path d="M848 774A303 303 0 0 1 416 856" fill="none" stroke="var(--logo-bright)" stroke-width="53"/><polygon points="355,812 453,803 378,908" fill="var(--logo-bright)"/><rect x="473" y="626" width="68" height="90" rx="14" fill="var(--logo-deep)"/><rect x="560" y="561" width="68" height="155" rx="14" fill="var(--logo-deep)"/><rect x="647" y="496" width="68" height="220" rx="14" fill="var(--logo-bright)"/></svg>`;
const logo = (short) => `<span class="logo">${LOGO}<span>Performance<b>360</b>${short ? "" : " <i>Academy</i>"}</span></span>`;

function niceStep(max) { const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
const tick = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-GB") : String(Math.round(v * 100) / 100));
function bars(data, key) {
  if (!data.length) return "";
  const W = 560, H = 180, pl = 44, pb = 26, pt = 10, max = Math.max(1, ...data.map((d) => d[key])), step = niceStep(max), top = Math.ceil(max / step) * step, bw = (W - pl - 6) / data.length;
  const y = (v) => pt + (H - pt - pb) * (1 - v / top);
  let g = ""; for (let v = 0; v <= top + 1e-9; v += step) g += `<line class="gl" x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${tick(v)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">${g}${data.map((d, i) => `<rect class="bar${d[key] ? "" : " zero"}" x="${pl + i * bw + bw * 0.18}" y="${y(d[key])}" width="${bw * 0.64}" height="${Math.max(0, y(0) - y(d[key]))}" rx="4"><title>${esc(d.label)}: ${d[key]}</title></rect><text x="${pl + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>`).join("")}</svg>`;
}
function line(points, higher) {
  if (points.length < 2) return "";
  const W = 520, H = 160, pl = 48, pr = 14, pb = 26, pt = 12, vals = points.map((p) => p.v);
  let lo = Math.min(...vals), hi = Math.max(...vals); const span = hi - lo || Math.abs(hi) * 0.05 || 1; lo -= span * 0.25; hi += span * 0.25;
  const x = (i) => pl + (W - pl - pr) * (i / (points.length - 1)), y = (v) => { const t = (v - lo) / (hi - lo); return pt + (H - pt - pb) * (higher ? 1 - t : t); };
  let g = ""; for (let k = 0; k <= 3; k++) { const v = lo + ((hi - lo) * k) / 3; g += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${tick(v)}</text>`; }
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.v)}`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend">${g}<path class="ln" d="${path}"/>${points.map((p, i) => `<circle class="pt" cx="${x(i)}" cy="${y(p.v)}" r="4"><title>${fmtDate(p.d)}: ${p.v}</title></circle><text x="${x(i)}" y="${H - 8}" text-anchor="middle">${fmtDate(p.d)}</text>`).join("")}</svg>`;
}

/* ---------------------------------------------------------------- small UI pieces */
const card = (title, body, action = "") => `<section class="card"><div class="card-h"><h2>${title}</h2>${action}</div><div class="card-b">${body}</div></section>`;
const stat = (label, v, hint = "") => `<div class="card stat"><span class="label">${label}</span><span class="v">${v}</span>${hint ? `<span class="tiny muted">${hint}</span>` : ""}</div>`;
const header = (title, sub = "", actions = "") => `<div class="head"><div><h1>${title}</h1>${sub ? `<p class="soft">${sub}</p>` : ""}</div>${actions ? `<div class="head-actions">${actions}</div>` : ""}</div>`;
const go = (v, extra = "") => `data-act="go" data-v="${v}" ${extra}`;
const empty = (t) => `<p class="empty">${t}</p>`;
const STATUS_PILL = { completed: '<span class="pill p-green">Done</span>', partial: '<span class="pill p-amber">Partly done</span>', skipped: '<span class="pill p-gray">Skipped</span>' };
const planned = '<span class="pill p-blue">Planned</span>';
function rich(text) {
  return esc(text).split("\n").map((l) => {
    const b = l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    return /^\s*[-•]\s+/.test(l) ? `<div style="padding-inline-start:14px;text-indent:-10px">• ${b.replace(/^\s*[-•]\s+/, "")}</div>` : `<div>${b || "&nbsp;"}</div>`;
  }).join("");
}

/* ============================================================================ boot and session */
async function boot() {
  applyTheme(store.get("p360a.theme") || "system");
  // The database library must not be called from inside its own auth callback, so work is deferred a tick.
  sb.auth.onAuthStateChange((event, session) => {
    setTimeout(() => {
      if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) { S.user = null; S.profile = null; S.org = null; render(); }
      else if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session && session.user.id !== S.user?.id) loadContext(session.user);
    }, 0);
  });
}
async function loadContext(user) {
  S.user = user;
  try {
    const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
    S.profile = profile;
    const { data: m } = await sb.from("organization_members").select("org_id, org_role, is_owner, organizations(name)").eq("user_id", user.id).eq("status", "active").maybeSingle();
    S.org = m ? { org_id: m.org_id, org_role: m.org_role, is_owner: Boolean(m.is_owner), name: m.organizations?.name || "" } : null;
    S.athleteId = null;
    if (profile?.role === "athlete") { const { data: a } = await sb.from("athletes").select("id").eq("user_id", user.id).maybeSingle(); S.athleteId = a?.id || null; }
    const { count } = await sb.from("direct_messages").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).is("read_at", null);
    S.unread = count || 0;
  } catch (e) { console.error(e); }
  const fromHash = location.hash.replace("#", "");
  if (fromHash && viewsFor().some((v) => v[0] === fromHash)) S.view = fromHash;
  render();
}

/* ============================================================================ sign in, terms, first-time setup */
function authFrame(inner) {
  return `<div class="auth"><div class="auth-top">${logo()}${themeSwitch()}</div><div class="auth-card fade">${inner}</div>
  <p class="tiny muted" style="text-align:center;margin-top:20px">Performance360 Academy supports professional judgment. It does not provide medical diagnosis or treatment.</p></div>`;
}
function viewSignIn() {
  const mode = S.authMode;
  const tabs = `<div class="seg" role="group" aria-label="Sign-in method"><button data-act="authMode" data-m="code" aria-pressed="${mode === "code"}">Email code</button><button data-act="authMode" data-m="password" aria-pressed="${mode === "password"}">Password</button></div>`;
  if (mode === "password") {
    return authFrame(`<div class="stack"><h1 style="font-size:26px">Sign in</h1><p class="soft small">For accounts created with a password.</p></div>${tabs}
      <form class="stack" data-form="password"><label class="field"><span>Email</span><input id="a-email" class="input" name="email" type="email" autocomplete="email" required value="${esc(S.authEmail)}"></label>
      <label class="field"><span>Password</span><input id="a-pass" class="input" name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn" ${S.busy ? "disabled" : ""}>Sign in</button></form>`);
  }
  if (S.authStep === "code") {
    return authFrame(`<div class="stack"><h1 style="font-size:26px">Enter your code</h1><p class="soft small">We sent a 6-digit code to <b>${esc(S.authEmail)}</b>. It works once and expires in 10 minutes.</p></div>
      <form class="stack" data-form="verify"><label class="field"><span>Code</span><input id="a-code" class="input code-input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required placeholder="••••••"></label>
      <button class="btn" ${S.busy ? "disabled" : ""}>Sign in</button></form>
      <div class="row"><button class="link" data-act="authBack">Use a different email</button><button class="link" data-act="resend">Send a new code</button></div>`);
  }
  return authFrame(`<div class="stack"><h1 style="font-size:26px">Sign in to Performance360 Academy</h1><p class="soft small">Enter your email and we'll send you a sign-in code. New here? The same code creates your account.</p></div>${tabs}
    <form class="stack" data-form="sendCode"><label class="field"><span>Email</span><input id="a-email" class="input" name="email" type="email" autocomplete="email" required value="${esc(S.authEmail)}"></label>
    <button class="btn" ${S.busy ? "disabled" : ""}>Email me a code</button></form>`);
}
function viewTerms() {
  return authFrame(`<div class="stack"><h1 style="font-size:26px">Welcome</h1><p class="soft small">Before you start, please accept the terms. Performance360 Academy stores training, testing, nutrition and payment records for your academy; who sees what is decided by your role and enforced by the database.</p></div>
    <form class="stack" data-form="terms"><label class="check"><input type="checkbox" name="ok" required> I agree to the Terms of use and the Privacy policy.</label><button class="btn">Continue</button></form>
    <button class="link" data-act="logout">Sign out</button>`);
}
function viewOnboarding() {
  const mode = ui("ob");
  const back = `<button class="link" data-act="ob" data-m="">← Back</button>`;
  if (mode === "create") return authFrame(`${back}<h1 style="font-size:24px">Create your academy</h1><p class="soft small">You join as a coach and become the academy's owner: you invite coaches and physiotherapists, and athletes join with the academy code.</p>
    <form class="stack" data-form="createOrg"><label class="field"><span>Academy name</span><input class="input" name="name" required maxlength="120"></label><label class="field"><span>Sport</span><input class="input" name="sport" maxlength="80" placeholder="Football"></label><label class="field"><span>Your full name</span><input class="input" name="full_name" required maxlength="120" value="${esc(S.profile?.full_name || "")}"></label><button class="btn">Create academy</button></form>`);
  if (mode === "staff") return authFrame(`${back}<h1 style="font-size:24px">Join as a coach or physiotherapist</h1><p class="soft small">Use the invitation code (STAFF-…) your academy's owner gave you.</p>
    <form class="stack" data-form="joinStaff"><label class="field"><span>Invitation code</span><input class="input" name="code" required maxlength="12" placeholder="STAFF-XXXXXX" style="text-transform:uppercase"></label><label class="field"><span>Your full name</span><input class="input" name="full_name" required maxlength="120" value="${esc(S.profile?.full_name || "")}"></label><button class="btn">Join academy</button></form>`);
  if (mode === "athlete") return authFrame(`${back}<h1 style="font-size:24px">Join as an athlete</h1><p class="soft small">Enter your name and the academy code (TEAM-…) from your coach.</p>
    <form class="stack" data-form="joinAthlete"><label class="field"><span>Your full name</span><input class="input" name="full_name" required maxlength="120" value="${esc(S.profile?.full_name || "")}"></label><label class="field"><span>Academy code</span><input class="input" name="code" maxlength="12" placeholder="TEAM-XXXXXX" style="text-transform:uppercase"></label><p class="tiny muted">No code yet? Leave it empty and join later from "Join the Academy".</p><button class="btn">Continue</button></form>`);
  const opt = (m, title, body) => `<button class="choice" data-act="ob" data-m="${m}"><b>${title}</b><span class="soft small">${body}</span></button>`;
  return authFrame(`<div class="stack"><h1 style="font-size:24px">How will you use Performance360 Academy?</h1><p class="soft small">This sets up your dashboard and permissions.</p></div>
    ${opt("create", "Create an academy", "You become the owner. You invite staff and share the academy code with athletes.")}
    ${opt("staff", "Join as a coach or physiotherapist", "With an invitation code from your academy's owner.")}
    ${opt("athlete", "Join as an athlete", "Follow your workouts, calendar, progress and nutrition.")}
    <button class="link" data-act="logout">Sign out</button>`);
}

/* ============================================================================ app shell */
const STAFF_VIEWS = [["dashboard", "Dashboard", "home"], ["athletes", "My Athletes", "users"], ["assistant", "AI Assistant", "sparkle"], ["calendar", "Training Calendar", "calendar"], ["messages", "Messages", "chat"], ["staff", "Staff", "team"], ["planner", "Workout Planner", "plan"], ["nutrition", "Nutrition", "meal"], ["library", "Exercise Library", "library"], ["testing", "Testing", "test"]];
const ATHLETE_VIEWS = [["dashboard", "Dashboard", "home"], ["calendar", "Training Calendar", "calendar"], ["messages", "Messages", "chat"], ["tracker", "Workout Tracker", "check"], ["notes", "Coach Notes", "note"], ["progress", "My Progress", "trend"], ["nutrition", "Nutrition", "meal"], ["join", "Join the Academy", "link"]];
function viewsFor() {
  if (!S.profile) return [];
  const base = S.profile.role === "athlete" ? ATHLETE_VIEWS : isOwner() ? [...STAFF_VIEWS, ["payments", "Payments", "card"]] : STAFF_VIEWS;
  return [...base, ["settings", "Settings", "settings"]];
}
function themeSwitch() {
  const cur = store.get("p360a.theme") || "system";
  return `<span class="theme-switch" role="group" aria-label="Appearance">${[["system", "Auto"], ["light", "Light"], ["dark", "Dark"]].map(([k, l]) => `<button data-act="theme" data-t="${k}" aria-pressed="${cur === k}">${l}</button>`).join("")}</span>`;
}
function applyTheme(t) { if (t === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t); }
function shell(content) {
  const views = viewsFor(), name = S.profile.full_name || S.user.email;
  const nav = views.map(([k, l, i]) => `<button ${go(k)} ${S.view === k ? 'aria-current="page"' : ""}>${svg(i)}<span>${l}</span>${k === "messages" && S.unread ? `<span class="badge">${S.unread}</span>` : ""}</button>`).join("");
  const tabs = views.slice(0, 4).map(([k, l, i]) => `<button ${go(k)} ${S.view === k ? 'aria-current="page"' : ""}>${svg(i)}<span>${l}</span></button>`).join("") + `<button data-act="more" ${views.slice(4).some((v) => v[0] === S.view) ? 'aria-current="page"' : ""}>${svg("more")}<span>Menu</span></button>`;
  return `<div class="app">
    <aside class="side"><div class="side-in">${logo()}<nav class="nav" aria-label="Main">${nav}</nav>
      <div class="who"><div class="who-row"><span class="avatar">${initials(name)}</span><div style="min-width:0"><div class="ell" style="font-weight:600">${esc(name)}</div><div class="ell tiny muted">${esc(roleLabel())}${S.org ? " · " + esc(S.org.name) : ""}</div></div></div>
      <div class="who-actions">${themeSwitch()}<button class="link" data-act="logout">Sign out</button></div></div></div></aside>
    <div class="topbar">${logo(true)}<span class="avatar sm" title="${esc(name)}">${initials(name)}</span></div>
    <main id="main" tabindex="-1"><div class="wrap fade" id="view"><div class="loading">Loading…</div></div></main>
    <nav class="tabbar" aria-label="Main">${tabs}</nav>
    ${ui("sheet") ? `<div class="sheet" data-act="closeSheet"><div class="sheet-in" data-stop="1"><nav class="nav">${nav}</nav><div class="who">${themeSwitch()}<button class="btn sec" data-act="logout">Sign out</button></div></div></div>` : ""}
  </div>`;
}

/* ============================================================================ render */
let renderSeq = 0;
async function render(scrollTop = false) {
  if (!S.user) { root.innerHTML = viewSignIn(); return; }
  if (!S.profile) { root.innerHTML = authFrame(`<p>Your profile could not be loaded.</p><button class="btn" data-act="reload">Try again</button><button class="link" data-act="logout">Sign out</button>`); return; }
  if (!S.profile.terms_version) { root.innerHTML = viewTerms(); return; }
  if (!S.profile.role) { root.innerHTML = viewOnboarding(); return; }
  if (!viewsFor().some((v) => v[0] === S.view)) S.view = "dashboard";
  const seq = ++renderSeq;
  const keep = document.getElementById("view") && root.querySelector(".app") && !scrollTop;
  root.innerHTML = shell("");
  try {
    const html = await VIEWS[S.view]();
    if (seq !== renderSeq) return;
    document.getElementById("view").innerHTML = html;
    afterRender();
  } catch (e) { if (seq === renderSeq) document.getElementById("view").innerHTML = `<div class="notice err">This page could not be loaded. ${esc(friendly(e))}</div>`; }
  if (scrollTop && !keep) window.scrollTo(0, 0);
}
function afterRender() { const t = document.getElementById("thread"); if (t) t.scrollTop = t.scrollHeight; }

/* ============================================================================ shared data */
async function myAthletes() { return q(sb.from("athletes").select("id, full_name, sport, position, user_id, short_term_goals, long_term_goals, date_of_birth").eq("status", "active").order("full_name").limit(1000)); }
async function scheduleFor(athleteId) {
  let aq = sb.from("program_assignments").select("id, program_id, athlete_id, start_date, athletes(full_name), training_programs(title)").eq("status", "active").limit(2000);
  if (athleteId) aq = aq.eq("athlete_id", athleteId);
  const assignments = await q(aq);
  const ids = [...new Set(assignments.map((a) => a.program_id))];
  const sessions = ids.length ? await q(sb.from("training_sessions").select("id, program_id, week_number, day_number, title, planned_duration_min").in("program_id", ids).limit(5000)) : [];
  const events = [];
  for (const a of assignments) for (const s of sessions.filter((x) => x.program_id === a.program_id)) events.push({ a, s, date: L.sessionDate(a.start_date, s.week_number, s.day_number) });
  return events.sort((x, y) => x.date.localeCompare(y.date));
}
const testDefs = async () => (ui("defs") || ui("defs", await q(sb.from("test_definitions").select("id, name, unit, higher_is_better, category").order("name"))));

/* ============================================================================ views */
const VIEWS = {};

/* ---------- dashboards */
VIEWS.dashboard = () => (isStaff() ? staffDashboard() : athleteDashboard());
async function staffDashboard() {
  const t = TODAY();
  const [nAth, nProg, n30, n7, recent, upcoming, payments] = await Promise.all([
    q(sb.from("athletes").select("id", { count: "exact", head: true }).eq("status", "active")),
    q(sb.from("training_programs").select("id", { count: "exact", head: true }).eq("coach_id", S.user.id).eq("status", "active")),
    q(sb.from("test_results").select("id", { count: "exact", head: true }).gte("tested_on", addDays(t, -30))),
    q(sb.from("workout_completions").select("id", { count: "exact", head: true }).gte("completed_on", addDays(t, -7)).neq("status", "skipped")),
    q(sb.from("test_results").select("id, athlete_id, tested_on, trials, test_definitions(name, unit, higher_is_better), athletes(full_name)").order("created_at", { ascending: false }).limit(6)),
    q(sb.from("program_assignments").select("id, start_date, athletes(full_name), training_programs(title)").eq("status", "active").gte("start_date", t).order("start_date").limit(6)),
    isOwner() ? q(sb.from("athlete_payments").select("athlete_id, amount, currency, due_date, paid_on").limit(2000)) : Promise.resolve(null),
  ]);
  const money = payments && L.summarize(payments, t);
  const first = (S.profile.full_name || "").split(" ")[0];
  return header(`Welcome back${first ? ", " + esc(first) : ""}`, `${esc(roleLabel())} · ${esc(S.org?.name || "")}`, `<button class="btn sec" ${go("testing")}>Record test</button><button class="btn sec" ${go("planner")}>New program</button><button class="btn" ${go("athletes")}>My Athletes</button>`)
    + `<div class="grid g4">${stat("Active athletes", nAth)}${stat("Active programs", nProg, "built by you")}${stat("Sessions logged", n7, "last 7 days")}${stat("Tests recorded", n30, "last 30 days")}</div>`
    + (money ? card("Payments", `<div class="grid g3"><div><span class="label">Outstanding</span><div class="num" style="font-weight:700;font-size:19px">${L.formatMoneyTotals(money.outstanding, "en")}</div></div><div><span class="label">Overdue</span><div>${money.overdueCount ? `<span class="pill p-red">${money.overdueCount} late · ${L.formatMoneyTotals(money.overdue, "en")}</span>` : "Nothing overdue."}</div></div><div><span class="label">Collected this month</span><div class="num" style="font-weight:700;font-size:19px">${L.formatMoneyTotals(money.collectedThisMonth, "en")}</div></div></div>`, `<button class="link" ${go("payments")}>Open</button>`) : "")
    + `<div class="grid g2">`
    + card("Programs starting soon", upcoming.length ? `<div class="list">${upcoming.map((a) => `<div class="row"><div><div class="ell" style="font-weight:600">${esc(a.training_programs?.title)}</div><div class="tiny muted ell">${esc(a.athletes?.full_name)}</div></div><span class="num tiny muted">${fmtDate(a.start_date)}</span></div>`).join("")}</div>` : `<p class="muted small">No program starts in the coming days.</p>`, `<button class="link" ${go("calendar")}>Training Calendar</button>`)
    + card("AI Assistant", `<p class="soft small">Ask the assistant to plan a week, explain a test, or set up a testing season.</p><div class="row" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn sec sm" ${go("planner")}>Workout Planner</button><button class="btn sec sm" ${go("library")}>Exercise Library</button><button class="btn sm" ${go("assistant")}>AI Assistant</button></div>`)
    + `</div>`
    + card("Recent test results", recent.length ? `<div class="list">${recent.map((r) => `<div class="row"><div><div style="font-weight:600">${esc(r.athletes?.full_name)}</div><div class="tiny muted">${esc(r.test_definitions?.name)} · ${fmtDate(r.tested_on)}</div></div><span class="num" style="font-weight:600">${L.bestTrial(r.trials, r.test_definitions?.higher_is_better)} ${esc(r.test_definitions?.unit)}</span></div>`).join("")}</div>` : `<p class="muted small">No tests recorded yet.</p>`, `<button class="link" ${go("testing")}>Testing</button>`)
    + (nAth === 0 ? `<div class="notice ok">No athletes yet. ${isOwner() ? 'Share the academy code from <button class="link" data-act="go" data-v="staff">Staff</button> with your athletes.' : "Ask your academy's owner for the academy code to share with athletes."}</div>` : "");
}
async function athleteDashboard() {
  const t = TODAY(), first = (S.profile.full_name || "").split(" ")[0];
  if (!S.athleteId) return header(`Hi${first ? " " + esc(first) : ""}`) + `<div class="notice ok">You're not on an academy roster yet. <button class="link" ${go("join")}>Join the Academy</button> with the code from your coach.</div>`;
  const [events, completions, notes, tests, meals] = await Promise.all([
    scheduleFor(S.athleteId),
    q(sb.from("workout_completions").select("session_id, status, completed_on").eq("athlete_id", S.athleteId)),
    q(sb.from("athlete_notes").select("body, created_at, author_id").eq("athlete_id", S.athleteId).eq("shared_with_athlete", true).order("created_at", { ascending: false }).limit(1)),
    q(sb.from("test_results").select("tested_on, trials, test_definitions(name, unit, higher_is_better)").eq("athlete_id", S.athleteId).order("tested_on", { ascending: false }).limit(4)),
    q(sb.from("meal_logs").select("calories, protein_g, carbs_g, fat_g, water_ml").eq("athlete_id", S.athleteId).eq("eaten_on", t)),
  ]);
  const done = new Map(completions.map((c) => [c.session_id + c.completed_on, c.status])), doneAny = new Set(completions.filter((c) => c.status !== "skipped").map((c) => c.session_id));
  const today = events.filter((e) => e.date === t), next = events.filter((e) => e.date > t).slice(0, 3);
  const tot = L.dayTotals(meals);
  return header(`Hi${first ? " " + esc(first) : ""}`, esc(S.org?.name || ""))
    + `<section class="card" style="background:var(--brand-50)"><div class="card-b"><span class="label" style="color:var(--brand-700)">Today's workout</span>
      ${today.length ? today.map(({ a, s }) => `<div class="row" style="flex-wrap:wrap"><div><div style="font-size:19px;font-weight:700">${esc(s.title)}</div><div class="small soft">${esc(a.training_programs?.title)}${s.planned_duration_min ? ` · ${s.planned_duration_min} min` : ""}</div></div>${done.get(s.id + t) ? STATUS_PILL[done.get(s.id + t)] : `<button class="btn" data-act="openSession" data-s="${s.id}">Start and log</button>`}</div>`).join("") : `<div class="row" style="flex-wrap:wrap"><p class="soft">Nothing scheduled for today.</p><button class="btn sec sm" ${go("calendar")}>Open calendar</button></div>`}</div></section>`
    + `<div class="grid g3">`
    + card("Coming up", next.length ? `<div class="list">${next.map(({ s, date }) => `<div class="row"><div><div style="font-weight:600">${esc(s.title)}</div><div class="tiny muted">${fmtDate(date)}</div></div>${doneAny.has(s.id) ? STATUS_PILL.completed : planned}</div>`).join("")}</div>` : `<p class="muted small">No training assigned yet.</p>`, `<button class="link" ${go("tracker")}>Workout Tracker</button>`)
    + card("Today's meals", `<p class="soft small">${tot.meals} logged today${tot.calories ? ` · ${tot.calories} kcal` : ""}</p><div><button class="btn sm" ${go("nutrition")}>Log a meal</button></div>`, `<button class="link" ${go("nutrition")}>Nutrition</button>`)
    + card("Latest coach note", notes.length ? `<p class="small" style="white-space:pre-line">${esc(notes[0].body)}</p><p class="tiny muted">${fmtDate(notes[0].created_at)}</p>` : `<p class="muted small">No notes yet.</p>`, `<button class="link" ${go("notes")}>Coach Notes</button>`)
    + `</div>`
    + card("Recent results", tests.length ? `<div class="list">${tests.map((r) => `<div class="row"><div><div style="font-weight:600">${esc(r.test_definitions?.name)}</div><div class="tiny muted">${fmtDate(r.tested_on)}</div></div><span class="num" style="font-weight:600">${L.bestTrial(r.trials, r.test_definitions?.higher_is_better)} ${esc(r.test_definitions?.unit)}</span></div>`).join("")}</div>` : `<p class="muted small">No results yet.</p>`, `<button class="link" ${go("progress")}>My Progress</button>`);
}

/* ---------- my athletes */
VIEWS.athletes = async () => {
  const sel = ui("athlete");
  if (sel) return athleteDetail(sel);
  const list = await myAthletes(), qy = (ui("aq") || "").toLowerCase();
  const rows = list.filter((a) => !qy || `${a.full_name} ${a.sport || ""} ${a.position || ""}`.toLowerCase().includes(qy));
  return header("My Athletes", `${list.length} active athlete${list.length === 1 ? "" : "s"}.`)
    + `<label class="field" style="max-width:340px"><span>Search</span><input id="aq" class="input" data-input="aq" placeholder="Name, sport or position" value="${esc(ui("aq") || "")}"></label>`
    + `<section class="card"><div class="table-wrap"><table><thead><tr><th>Athlete</th><th>Sport</th><th>Position</th><th>Account</th></tr></thead><tbody>
      ${rows.map((a) => `<tr class="click" data-act="athlete" data-a="${a.id}" tabindex="0"><td><div class="row" style="justify-content:flex-start"><span class="avatar sm">${initials(a.full_name)}</span><b>${esc(a.full_name)}</b></div></td><td>${esc(a.sport || "—")}</td><td>${esc(a.position || "—")}</td><td>${a.user_id ? '<span class="pill p-green">Connected</span>' : '<span class="pill p-gray">No account</span>'}</td></tr>`).join("") || `<tr><td colspan="4">${empty(list.length ? "No athletes match." : "No athletes yet. Athletes join with the academy code.")}</td></tr>`}
    </tbody></table></div></section>`;
};
async function athleteDetail(id) {
  const [a, notes, results, completions, assignments, defs] = await Promise.all([
    q(sb.from("athletes").select("*").eq("id", id).maybeSingle()),
    q(sb.from("athlete_notes").select("id, body, shared_with_athlete, created_at, author_id").eq("athlete_id", id).order("created_at", { ascending: false }).limit(50)),
    q(sb.from("test_results").select("test_id, tested_on, trials").eq("athlete_id", id).order("tested_on").limit(500)),
    q(sb.from("workout_completions").select("completed_on, status, session_rpe, duration_min, training_sessions(title)").eq("athlete_id", id).order("completed_on", { ascending: false }).limit(6)),
    q(sb.from("program_assignments").select("start_date, training_programs(title, num_weeks)").eq("athlete_id", id).eq("status", "active")),
    testDefs(),
  ]);
  if (!a) return `<button class="link" data-act="athlete" data-a="">← All athletes</button>` + empty("This athlete isn't available.");
  const authorIds = [...new Set(notes.map((n) => n.author_id))];
  const authors = authorIds.length ? await q(sb.from("profiles").select("id, full_name").in("id", authorIds)) : [];
  const nameOf = (u) => authors.find((p) => p.id === u)?.full_name || "Staff";
  const byTest = defs.map((d) => ({ d, r: results.filter((x) => x.test_id === d.id) })).filter((x) => x.r.length);
  const first = esc(a.full_name.split(" ")[0]);
  return `<div><button class="link" data-act="athlete" data-a="">← All athletes</button></div>`
    + header(esc(a.full_name), [a.sport, a.position].filter(Boolean).map(esc).join(" · "), `${a.user_id ? `<button class="btn sec" data-act="messageTo" data-u="${a.user_id}">Message</button>` : ""}<button class="btn sec" data-act="openMeals" data-a="${a.id}">Nutrition</button>`)
    + `<div class="grid g3">`
    + card("Goals", `<div><span class="label">This season</span><p>${esc(a.short_term_goals || "—")}</p></div><div><span class="label">Long term</span><p>${esc(a.long_term_goals || "—")}</p></div>`)
    + card("Programs", assignments.length ? `<div class="list">${assignments.map((p) => `<div><div style="font-weight:600">${esc(p.training_programs?.title)}</div><div class="tiny muted">from ${fmtDate(p.start_date)} · ${p.training_programs?.num_weeks || "?"} weeks</div></div>`).join("")}</div>` : `<p class="muted small">No programs assigned.</p>`)
    + card("Recent sessions", completions.length ? `<div class="list">${completions.map((c) => `<div class="row"><div><div style="font-weight:600">${esc(c.training_sessions?.title || "Session")}</div><div class="tiny muted">${fmtDate(c.completed_on)}${c.session_rpe != null ? ` · RPE ${c.session_rpe}` : ""}${c.duration_min ? ` · ${c.duration_min} min` : ""}</div></div>${STATUS_PILL[c.status] || ""}</div>`).join("")}</div>` : `<p class="muted small">Nothing logged yet.</p>`)
    + `</div><div class="grid g2">`
    + card("Test results", byTest.length ? byTest.map(({ d, r }) => { const pts = r.map((x) => ({ d: x.tested_on, v: L.bestTrial(x.trials, d.higher_is_better) })); const ch = L.percentChange(pts.at(-1).v, pts[0].v); const good = ch == null ? null : d.higher_is_better ? ch > 0 : ch < 0;
        return `<div class="stack"><div class="row"><b>${esc(d.name)}</b><span class="num small">${pts.at(-1).v} ${esc(d.unit)} ${r.length > 1 && ch != null ? `<span class="pill ${good ? "p-green" : "p-red"}">${ch > 0 ? "+" : ""}${ch.toFixed(1)}%</span>` : ""}</span></div>${line(pts, d.higher_is_better)}</div>`; }).join("") : `<p class="muted small">No tests yet.</p>`, `<button class="link" ${go("testing")}>Record a test</button>`)
    + card("Notes", `<form class="stack" data-form="note" data-a="${a.id}"><textarea class="textarea" name="body" required maxlength="5000" placeholder="Write a note about ${first}"></textarea><div class="row"><label class="check"><input type="checkbox" name="shared" checked> Share with ${first}</label><button class="btn sm">Add note</button></div></form>
      <div class="list">${notes.map((n) => `<div class="stack" style="gap:4px"><p class="small" style="white-space:pre-line">${esc(n.body)}</p><div class="row"><span class="tiny muted">${esc(nameOf(n.author_id))} · ${fmtDate(n.created_at)} · ${n.shared_with_athlete ? '<span class="pill p-green">Shared</span>' : '<span class="pill p-gray">Staff only</span>'}</span>${n.author_id === S.user.id ? `<button class="btn danger sm" data-act="delNote" data-n="${n.id}">Delete</button>` : ""}</div></div>`).join("")}</div>`)
    + `</div>`;
}

/* ---------- AI assistant (the full app's knowledge base, inside this file) */
const STARTERS = {
  head_coach: ["How do I plan a training week for a U15 squad with three sessions and a match?", "How can I give feedback to a young player who is losing confidence?", "How do I build a workout in the planner?"],
  physiotherapist: ["How do I explain graded loading to a player who wants to rush back?", "Which criteria would you use for progressing a hamstring return-to-run, in general terms?", "How should I use strength asymmetry tests?"],
  team_staff: ["How do I record a test in the app?", "Which tests should the academy run each season, and how often?", "How should I structure a development pathway across age groups?"],
};
VIEWS.assistant = async () => {
  const role = L.assistantRole(S.profile.role, S.org?.org_role || null), log = ui("chat") || [];
  const starters = STARTERS[role] || STARTERS.team_staff;
  return header("AI Assistant", "Ask about training, testing and running the academy. Answers come from a built-in library written for your role, inside the app.")
    + `<section class="card"><div class="card-b"><div class="thread" id="thread" aria-live="polite">${log.length ? log.map((m) => `<div class="bubble ${m.me ? "me" : "them"}">${m.me ? esc(m.text) : rich(m.text)}</div>`).join("") : `<div class="stack"><p class="soft small">Try one of these:</p>${starters.map((s) => `<button class="choice" data-act="ask" data-q="${esc(s)}"><span>${esc(s)}</span></button>`).join("")}</div>`}</div>
      <form class="row" data-form="ask" style="align-items:flex-end"><label class="field" style="flex:1"><span class="sr">Question</span><input id="ask" class="input" name="q" placeholder="Type your question" maxlength="3000" autocomplete="off"></label><button class="btn">Ask</button></form>
      <div class="row"><p class="tiny muted">It does not diagnose or clear anyone to play; a qualified professional decides.</p>${log.length ? '<button class="link" data-act="clearChat">Clear</button>' : ""}</div></div></section>`;
};

/* ---------- training calendar */
VIEWS.calendar = async () => {
  const t = TODAY(), base = new Date(t + "T12:00:00"); base.setDate(1); base.setMonth(base.getMonth() + (ui("mo") || 0));
  const y = base.getFullYear(), m = base.getMonth() + 1;
  const [events, completions] = await Promise.all([scheduleFor(isStaff() ? null : S.athleteId), !isStaff() && S.athleteId ? q(sb.from("workout_completions").select("session_id, status").eq("athlete_id", S.athleteId)) : Promise.resolve([])]);
  if (!isStaff() && !S.athleteId) return header("Training Calendar") + `<div class="notice ok">Join your academy to see your training. <button class="link" ${go("join")}>Join the Academy</button></div>`;
  const doneIds = new Set(completions.filter((c) => c.status !== "skipped").map((c) => c.session_id));
  const grid = L.monthGrid(y, m, 0).flat(), pick = ui("calDay") || t;
  const group = (list) => { const g = new Map(); for (const e of list) { const k = e.s.id + e.date; const x = g.get(k) || { ...e, names: [] }; x.names.push(e.a.athletes?.full_name); g.set(k, x); } return [...g.values()]; };
  const dayList = group(events.filter((e) => e.date === pick));
  return header("Training Calendar", isStaff() ? "Every planned session for the athletes you work with." : "Your planned sessions.", `<div class="row"><button class="btn sec sm" data-act="mo" data-d="-1" aria-label="Previous month">←</button><b style="min-width:140px;text-align:center">${base.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b><button class="btn sec sm" data-act="mo" data-d="1" aria-label="Next month">→</button></div>`)
    + `<div class="grid split"><section class="card"><div class="card-b"><div class="cal">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<div class="dow">${d}</div>`).join("")}
      ${grid.map(({ iso, inMonth }) => { const ev = group(events.filter((e) => e.date === iso)); return `<button class="${inMonth ? "" : "out"} ${iso === t ? "today" : ""}" data-act="calDay" data-d="${iso}" aria-pressed="${iso === pick}" aria-label="${fmtDate(iso)}: ${ev.length} sessions"><span class="d">${+iso.slice(8)}</span>${ev.slice(0, 2).map((e) => `<span class="ev ${doneIds.has(e.s.id) ? "done" : ""}">${esc(e.s.title)}</span>`).join("")}${ev.length > 2 ? `<span class="tiny muted">+${ev.length - 2}</span>` : ""}</button>`; }).join("")}</div></div></section>`
    + card(fmtDate(pick) + (pick === t ? " · today" : ""), dayList.length ? `<div class="list">${dayList.map((e) => `<div class="stack" style="gap:4px"><div class="row"><b>${esc(e.s.title)}</b>${e.s.planned_duration_min ? `<span class="pill p-blue num">${e.s.planned_duration_min} min</span>` : ""}</div><div class="tiny muted">${esc(e.a.training_programs?.title)}${isStaff() ? " · " + e.names.map(esc).join(", ") : ""}</div>${!isStaff() ? (doneIds.has(e.s.id) ? STATUS_PILL.completed : `<div><button class="btn sm" data-act="openSession" data-s="${e.s.id}">Open and log</button></div>`) : ""}</div>`).join("")}</div>` : `<p class="muted small">No sessions on this day.</p>`) + `</div>`;
};

/* ---------- messages */
VIEWS.messages = async () => {
  const [contacts, msgs] = await Promise.all([q(sb.rpc("message_contacts")), q(sb.from("direct_messages").select("id, sender_id, recipient_id, body, created_at, read_at").order("created_at", { ascending: false }).limit(400))]);
  const me = S.user.id, lastWith = (u) => msgs.find((m) => m.sender_id === u || m.recipient_id === u);
  const sorted = [...contacts].sort((x, y) => (lastWith(y.user_id)?.created_at || "").localeCompare(lastWith(x.user_id)?.created_at || ""));
  const sel = sorted.some((c) => c.user_id === ui("chatWith")) ? ui("chatWith") : sorted[0]?.user_id;
  if (!sel) return header("Messages") + card("No contacts yet", `<p class="soft small">Messages work between people in the same academy.</p>`);
  const unreadFrom = (u) => msgs.filter((m) => m.sender_id === u && m.recipient_id === me && !m.read_at).length;
  if (unreadFrom(sel)) { sb.rpc("mark_messages_read", { p_with: sel }).then(() => { S.unread = Math.max(0, S.unread - unreadFrom(sel)); }); }
  const thread = msgs.filter((m) => (m.sender_id === sel && m.recipient_id === me) || (m.sender_id === me && m.recipient_id === sel)).reverse();
  const c = contacts.find((x) => x.user_id === sel), label = (l) => ROLE[l] || (l === "athlete" ? "Athlete" : "Staff");
  return header("Messages", "One-to-one messages with the people you work with.")
    + `<div class="grid msg-grid"><section class="card"><div class="card-b contacts">${sorted.map((x) => `<button data-act="chatWith" data-u="${x.user_id}" aria-current="${x.user_id === sel}"><span class="avatar sm">${initials(x.full_name)}</span><span style="min-width:0;flex:1"><span class="ell" style="display:block;font-weight:600">${esc(x.full_name)}</span><span class="ell tiny muted" style="display:block">${esc(lastWith(x.user_id)?.body || label(x.label))}</span></span>${unreadFrom(x.user_id) ? `<span class="pill p-red">${unreadFrom(x.user_id)}</span>` : ""}</button>`).join("")}</div></section>
      <section class="card"><div class="card-h"><h2>${esc(c.full_name)}</h2><span class="tiny muted">${label(c.label)}</span></div><div class="card-b"><div class="thread" id="thread">${thread.length ? thread.map((m) => `<div class="bubble ${m.sender_id === me ? "me" : "them"}">${esc(m.body)}<div class="tiny" style="opacity:.7;margin-top:2px">${new Date(m.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div></div>`).join("") : `<p class="muted small">No messages yet. Say hello.</p>`}</div>
      <form class="row" data-form="send" data-u="${sel}" style="align-items:flex-end"><label class="field" style="flex:1"><span class="sr">Message</span><textarea id="msg" class="textarea" name="body" rows="2" style="min-height:48px" maxlength="5000" placeholder="Write a message" required></textarea></label><button class="btn">Send</button></form></div></section></div>`;
};

/* ---------- staff */
VIEWS.staff = async () => {
  const owner = isOwner();
  const [summaryRows, members, roster, codes] = await Promise.all([
    q(sb.rpc("org_summary")), q(sb.from("organization_members").select("user_id, org_role, is_owner, joined_at").eq("org_id", S.org.org_id).eq("status", "active").order("joined_at")),
    q(sb.rpc("org_roster")), owner ? q(sb.from("organization_codes").select("id, kind, code, org_role, expires_at").eq("org_id", S.org.org_id).eq("status", "active").order("created_at", { ascending: false })) : Promise.resolve([]),
  ]);
  const sm = summaryRows?.[0] || {}, ids = members.map((m) => m.user_id);
  const people = ids.length ? await q(sb.from("profiles").select("id, full_name, email").in("id", ids)) : [];
  const person = (u) => people.find((p) => p.id === u) || {};
  const owners = members.filter((m) => m.is_owner).length, athleteCode = codes.find((c) => c.kind === "athlete"), invites = codes.filter((c) => c.kind === "staff" && (!c.expires_at || new Date(c.expires_at) > new Date()));
  return header(esc(S.org.name), `Your role: ${esc(roleLabel())}`)
    + `<div class="grid g4">${stat("Staff", sm.staff_count ?? members.length)}${stat("Athletes on roster", sm.roster_count ?? roster.length)}${stat("Tests (30 days)", sm.tests_30d ?? 0)}${stat("Sessions logged (7 days)", sm.sessions_7d ?? 0)}</div>`
    + `<section class="card"><div class="card-h"><h2>Staff</h2></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Joined</th><th></th></tr></thead><tbody>
      ${members.map((m) => { const p = person(m.user_id), self = m.user_id === S.user.id; return `<tr><td><div class="row" style="justify-content:flex-start"><span class="avatar sm">${initials(p.full_name || p.email)}</span><div><b>${esc(p.full_name || p.email || "—")}</b>${self ? ' <span class="tiny muted">(you)</span>' : ""}<div class="tiny muted">${esc(p.email || "")}</div></div></div></td>
        <td>${owner && !m.is_owner ? `<select class="select" style="width:auto;padding:6px 10px" data-change="setRole" data-u="${m.user_id}" aria-label="Role"><option value="head_coach" ${m.org_role === "head_coach" ? "selected" : ""}>Coach</option><option value="physiotherapist" ${m.org_role === "physiotherapist" ? "selected" : ""}>Physiotherapist</option></select>` : `<span class="pill p-blue">${ROLE[m.org_role] || "Staff"}</span>`} ${m.is_owner ? '<span class="pill p-green">Owner</span>' : ""}</td>
        <td class="num">${fmtDate(m.joined_at)}</td>
        <td style="text-align:end;white-space:nowrap">${owner && m.org_role === "head_coach" && !(m.is_owner && owners < 2) ? `<button class="btn sec sm" data-act="owner" data-u="${m.user_id}" data-on="${m.is_owner ? 0 : 1}">${m.is_owner ? "Remove owner" : "Make owner"}</button> ` : ""}${owner && !self && !m.is_owner ? `<button class="btn danger sm" data-act="removeMember" data-u="${m.user_id}">Remove</button>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div></section>`
    + `<section class="card"><div class="card-h"><h2>Athlete roster</h2><span class="tiny muted">${roster.length} athletes</span></div><div class="table-wrap"><table><thead><tr><th>Athlete</th><th>Sport</th><th>Position</th><th>Joined</th></tr></thead><tbody>
      ${roster.map((r) => `<tr class="click" data-act="athleteFromStaff" data-a="${r.athlete_id}"><td><b>${esc(r.full_name)}</b><div class="tiny muted">${r.has_account ? "Account connected" : "No account yet"}</div></td><td>${esc(r.sport || "—")}</td><td>${esc(r.position || "—")}</td><td class="num">${fmtDate(r.joined_at)}</td></tr>`).join("") || `<tr><td colspan="4">${empty("No athletes yet. Athletes join with the academy code.")}</td></tr>`}
    </tbody></table></div></section>`
    + (owner ? `<div class="grid g2">`
      + card("Invite staff", `<form class="row" data-form="invite" style="align-items:flex-end;flex-wrap:wrap"><label class="field" style="flex:1;min-width:170px"><span>Role</span><select class="select" name="role"><option value="head_coach">Coach</option><option value="physiotherapist">Physiotherapist</option></select></label><button class="btn">Create invitation</button></form>
          <p class="tiny muted">Single-use, valid for 14 days. The person signs in, chooses "Join as a coach or physiotherapist" and enters the code.</p>
          <div class="list">${invites.map((i) => `<div class="row"><div><code class="num" style="font-weight:700;letter-spacing:.1em">${esc(i.code)}</code> <span class="pill p-blue">${ROLE[i.org_role] || ""}</span><div class="tiny muted">Expires ${fmtDate(i.expires_at)}</div></div><span class="row" style="gap:6px"><button class="btn sec sm" data-act="copy" data-t="${esc(i.code)}">Copy</button><button class="btn danger sm" data-act="revoke" data-c="${i.id}">Revoke</button></span></div>`).join("") || `<p class="muted small">No open invitations.</p>`}</div>`)
      + card("Athlete code", `<p class="small soft">Athletes enter this code to join the roster. They see the academy name and give consent first.</p><div class="code-box">${esc(athleteCode?.code || "—")}</div><div class="row"><button class="btn sec sm" data-act="copy" data-t="${esc(athleteCode?.code || "")}">Copy code</button><button class="btn ghost sm" data-act="newCode">Generate new code</button></div>`)
      + `</div>` : `<p class="muted small">Only the academy's owners invite staff and manage the athlete code.</p>`);
};

/* ---------- workout planner */
VIEWS.planner = async () => {
  const sel = ui("prog");
  if (sel) return programDetail(sel);
  const progs = await q(sb.from("training_programs").select("id, title, num_weeks, status, coach_id, created_at").order("created_at", { ascending: false }).limit(300));
  const coachIds = [...new Set(progs.map((p) => p.coach_id))];
  const coaches = coachIds.length ? await q(sb.from("profiles").select("id, full_name").in("id", coachIds)) : [];
  const cname = (u) => (u === S.user.id ? "You" : coaches.find((c) => c.id === u)?.full_name || "A colleague");
  return header("Workout Planner", "Programs → weeks → sessions → exercises. A program is edited by the coach who built it.")
    + `<div class="grid split"><div class="grid g2" style="align-content:start">${progs.map((p) => `<section class="card"><div class="card-b"><div class="row"><h2 class="ell">${esc(p.title)}</h2><span class="pill ${p.status === "active" ? "p-green" : "p-gray"}">${esc(p.status)}</span></div><p class="tiny muted">${esc(cname(p.coach_id))} · ${p.num_weeks || "?"} weeks</p><div><button class="btn sec sm" data-act="prog" data-p="${p.id}">Open</button></div></div></section>`).join("") || `<section class="card">${empty("No programs yet. Create the first one.")}</section>`}</div>`
    + card("New program", `<form class="stack" data-form="newProg"><label class="field"><span>Title</span><input class="input" name="title" required maxlength="160" placeholder="U15 winter strength"></label><label class="field"><span>Weeks</span><input class="input" name="weeks" type="number" min="1" max="52" value="4"></label><label class="field"><span>Goal (optional)</span><input class="input" name="goal" maxlength="300"></label><button class="btn">Create program</button></form>`) + `</div>`;
};
async function programDetail(id) {
  const p = await q(sb.from("training_programs").select("*").eq("id", id).maybeSingle());
  if (!p) return `<button class="link" data-act="prog" data-p="">← All programs</button>` + empty("This program isn't available.");
  const mine = p.coach_id === S.user.id, week = ui("pw") || 1;
  const [sessions, assignments, athletes, library] = await Promise.all([
    q(sb.from("training_sessions").select("id, week_number, day_number, title, planned_duration_min").eq("program_id", id).order("week_number").order("day_number")),
    q(sb.from("program_assignments").select("id, athlete_id, start_date, athletes(full_name)").eq("program_id", id).eq("status", "active")),
    mine ? myAthletes() : Promise.resolve([]),
    mine ? (ui("lib") || ui("lib", await q(sb.from("exercises").select("id, name, category").eq("archived", false).order("name").limit(2000)))) : Promise.resolve([]),
  ]);
  const ws = sessions.filter((s) => s.week_number === week);
  const items = ws.length ? await q(sb.from("session_exercises").select("id, session_id, exercise_name, sets, reps, load_kg, rest_s, position").in("session_id", ws.map((s) => s.id)).order("position")) : [];
  const weeks = Math.max(p.num_weeks || 1, ...sessions.map((s) => s.week_number), 1);
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return `<div><button class="link" data-act="prog" data-p="">← All programs</button></div>`
    + header(esc(p.title), `${p.num_weeks || "?"} weeks${p.goal ? " · " + esc(p.goal) : ""}${mine ? "" : " · read-only (built by a colleague)"}`)
    + `<div class="chips" role="group" aria-label="Week">${Array.from({ length: weeks }, (_, i) => `<button data-act="pw" data-w="${i + 1}" aria-pressed="${week === i + 1}">Week ${i + 1}</button>`).join("")}</div>`
    + `<div class="grid split"><div class="grid" style="align-content:start">${ws.length ? ws.map((s) => { const its = items.filter((x) => x.session_id === s.id);
        return `<section class="card"><div class="card-h"><h2>${DAYS[(s.day_number || 1) - 1] || "Day " + s.day_number} · ${esc(s.title)}</h2>${s.planned_duration_min ? `<span class="pill p-blue num">${s.planned_duration_min} min</span>` : ""}</div>
          <div class="table-wrap"><table><thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Load</th>${mine ? "<th></th>" : ""}</tr></thead><tbody>${its.map((x) => `<tr><td><b>${esc(x.exercise_name)}</b></td><td class="num">${x.sets ?? "—"}</td><td class="num">${esc(x.reps || "—")}</td><td class="num">${x.load_kg != null ? x.load_kg + " kg" : "—"}</td>${mine ? `<td style="text-align:end"><button class="btn danger sm" data-act="rmEx" data-x="${x.id}">Remove</button></td>` : ""}</tr>`).join("") || `<tr><td colspan="5">${empty("No exercises yet.")}</td></tr>`}</tbody></table></div>
          ${mine ? `<div class="card-b" style="border-top:1px solid var(--line)"><form class="row" data-form="addEx" data-s="${s.id}" style="flex-wrap:wrap;align-items:flex-end"><label class="field" style="flex:2;min-width:200px"><span>Add exercise</span><select class="select" name="ex">${library.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join("")}</select></label><label class="field" style="width:76px"><span>Sets</span><input class="input" name="sets" type="number" min="1" max="20" value="3"></label><label class="field" style="width:96px"><span>Reps</span><input class="input" name="reps" value="8" maxlength="40"></label><label class="field" style="width:96px"><span>Load kg</span><input class="input" name="load" type="number" step="0.5" min="0"></label><button class="btn sec">Add</button></form></div>` : ""}</section>`; }).join("") : `<section class="card">${empty(`No sessions in week ${week}.${mine ? " Add one on the right." : ""}`)}</section>`}</div>
      <div class="grid" style="align-content:start">`
    + card("Assigned athletes", (assignments.length ? `<div class="list">${assignments.map((a) => `<div class="row"><div><b>${esc(a.athletes?.full_name)}</b><div class="tiny muted">from ${fmtDate(a.start_date)}</div></div>${mine ? `<button class="btn danger sm" data-act="unassign" data-x="${a.id}">Remove</button>` : ""}</div>`).join("")}</div>` : `<p class="muted small">Not assigned yet.</p>`)
        + (mine ? `<form class="stack" data-form="assign" data-p="${p.id}"><label class="field"><span>Athlete</span><select class="select" name="athlete" required>${athletes.filter((a) => !assignments.some((x) => x.athlete_id === a.id)).map((a) => `<option value="${a.id}">${esc(a.full_name)}</option>`).join("")}</select></label><label class="field"><span>Start date</span><input class="input" type="date" name="start" value="${TODAY()}" required></label><button class="btn sec sm" style="justify-self:start">Assign</button></form>` : ""))
    + (mine ? card(`Add a session to week ${week}`, `<form class="stack" data-form="addSess" data-p="${p.id}"><label class="field"><span>Title</span><input class="input" name="title" required maxlength="160" placeholder="Speed and agility"></label><div class="f2"><label class="field"><span>Day</span><select class="select" name="day">${DAYS.map((d, i) => `<option value="${i + 1}">${d}</option>`).join("")}</select></label><label class="field"><span>Minutes</span><input class="input" name="minutes" type="number" min="5" max="300" value="45"></label></div><button class="btn sm" style="justify-self:start">Add session</button></form>`) : "")
    + `</div></div>`;
}

/* ---------- exercise library */
VIEWS.library = async () => {
  const all = ui("libFull") || ui("libFull", await q(sb.from("exercises").select("id, name, category, equipment, difficulty, coaching_cues, video_url, description").eq("archived", false).order("name").limit(2000)));
  const cats = ["all", ...[...new Set(all.map((e) => e.category))].sort()], c = ui("cat") || "all", qy = (ui("lq") || "").toLowerCase();
  const rows = all.filter((e) => (c === "all" || e.category === c) && (!qy || `${e.name} ${(e.equipment || []).join(" ")}`.toLowerCase().includes(qy)));
  const nice = (s) => (s === "all" ? "All" : s.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase()));
  return header("Exercise Library", `${all.length} exercises with coaching cues and video links.`)
    + `<div class="row" style="flex-wrap:wrap;align-items:flex-end"><div class="chips" role="group" aria-label="Category">${cats.map((x) => `<button data-act="cat" data-c="${x}" aria-pressed="${x === c}">${nice(x)}</button>`).join("")}</div><label class="field" style="width:min(300px,100%)"><span>Search</span><input id="lq" class="input" data-input="lq" placeholder="Name or equipment" value="${esc(ui("lq") || "")}"></label></div>`
    + `<p class="tiny muted">${rows.length} shown</p><div class="grid g3">${rows.slice(0, 120).map((e) => `<section class="card"><div class="card-b" style="gap:6px"><div class="row"><b>${esc(e.name)}</b><span class="pill p-blue">${esc(nice(e.category))}</span></div><span class="tiny muted">${esc((e.equipment || []).join(", ") || "No equipment")} · ${esc(e.difficulty || "")}</span>${(e.coaching_cues || []).length ? `<p class="small soft">${esc(e.coaching_cues.slice(0, 2).join(" · "))}</p>` : ""}${e.video_url ? `<a class="link" href="${esc(e.video_url)}" target="_blank" rel="noopener noreferrer">Watch video ↗</a>` : ""}</div></section>`).join("") || `<p class="muted">No exercises match.</p>`}</div>${rows.length > 120 ? '<p class="tiny muted">Showing the first 120. Search to narrow it down.</p>' : ""}`;
};

/* ---------- testing */
VIEWS.testing = async () => {
  const defs = await testDefs(), tid = ui("test") || defs[0]?.id, t = defs.find((d) => d.id === tid);
  if (!t) return header("Testing") + empty("No tests are defined yet.");
  const [results, athletes] = await Promise.all([q(sb.from("test_results").select("athlete_id, tested_on, trials, athletes(full_name)").eq("test_id", tid).order("tested_on").limit(3000)), myAthletes()]);
  const byA = new Map(); for (const r of results) byA.set(r.athlete_id, [...(byA.get(r.athlete_id) || []), r]);
  return header("Testing", "Latest result, personal best and change since the first test.")
    + `<label class="field" style="max-width:380px"><span>Test</span><select class="select" data-change="test">${defs.map((d) => `<option value="${d.id}" ${d.id === tid ? "selected" : ""}>${esc(d.name)} (${esc(d.unit)})</option>`).join("")}</select></label>`
    + `<div class="grid split"><section class="card"><div class="table-wrap"><table><thead><tr><th>Athlete</th><th>Latest</th><th>Best</th><th>Since first</th><th>Tested</th></tr></thead><tbody>
      ${[...byA.values()].map((rs) => { const pts = rs.map((r) => L.bestTrial(r.trials, t.higher_is_better)).filter((v) => v != null); const last = pts.at(-1), bestV = t.higher_is_better ? Math.max(...pts) : Math.min(...pts), ch = rs.length > 1 ? L.percentChange(last, pts[0]) : null, good = ch == null ? null : t.higher_is_better ? ch > 0 : ch < 0;
        return `<tr><td><b>${esc(rs[0].athletes?.full_name)}</b></td><td class="num"><b>${last}</b> ${esc(t.unit)}</td><td class="num">${bestV} ${esc(t.unit)}</td><td>${ch != null ? `<span class="pill ${good ? "p-green" : "p-red"} num">${ch > 0 ? "+" : ""}${ch.toFixed(1)}%</span>` : "—"}</td><td class="num">${fmtDate(rs.at(-1).tested_on)}</td></tr>`; }).join("") || `<tr><td colspan="5">${empty("No results for this test yet.")}</td></tr>`}
      </tbody></table></div><p class="tiny muted" style="padding:0 16px 12px">${t.higher_is_better ? "Higher is better." : "Lower is better."}</p></section>`
    + card("Record a result", athletes.length ? `<form class="stack" data-form="result" data-t="${tid}"><label class="field"><span>Athlete</span><select class="select" name="athlete">${athletes.map((a) => `<option value="${a.id}">${esc(a.full_name)}</option>`).join("")}</select></label><div class="f2"><label class="field"><span>Trial 1 (${esc(t.unit)})</span><input class="input" name="t1" type="number" step="any" required></label><label class="field"><span>Trial 2</span><input class="input" name="t2" type="number" step="any"></label><label class="field"><span>Trial 3</span><input class="input" name="t3" type="number" step="any"></label><label class="field"><span>Date</span><input class="input" name="date" type="date" value="${TODAY()}" max="${TODAY()}"></label></div><button class="btn">Save result</button></form>` : `<p class="muted small">Add athletes to the roster first.</p>`) + `</div>`;
};

/* ---------- nutrition (photos are stored like the full app's meal photos) */
VIEWS.nutrition = async () => {
  const staff = isStaff();
  const athletes = staff ? await myAthletes() : [];
  const aid = staff ? (athletes.some((a) => a.id === ui("nA")) ? ui("nA") : athletes[0]?.id) : S.athleteId;
  if (!aid) return header("Nutrition") + (staff ? empty("No athletes yet.") : `<div class="notice ok">Join your academy to start logging meals. <button class="link" ${go("join")}>Join the Academy</button></div>`);
  const day = ui("nD") || TODAY(), from = addDays(day, -6);
  const week = await q(sb.from("meal_logs").select("id, eaten_on, meal_type, description, calories, protein_g, carbs_g, fat_g, water_ml, photo_id, coach_comment, created_at").eq("athlete_id", aid).gte("eaten_on", from).lte("eaten_on", day).order("created_at").limit(500));
  const meals = L.sortMeals(week.filter((m) => m.eaten_on === day)), tot = L.dayTotals(meals), series = L.dailySeries(week, day);
  const photos = await loadPhotos(meals.map((m) => m.photo_id).filter(Boolean));
  const T = { breakfast: "Breakfast", pre_training: "Before training", lunch: "Lunch", post_training: "After training", snack: "Snack", dinner: "Dinner" };
  const name = staff ? athletes.find((a) => a.id === aid)?.full_name.split(" ")[0] : "";
  const h = new Date().getHours(), defType = h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 21 ? "dinner" : "snack";
  return header("Nutrition", staff ? "Your athletes' meal logs. Leave a comment on a meal to give feedback." : "Log what you eat, with a photo if you like. Your coaches can see your meals and leave comments.")
    + (staff ? `<label class="field" style="max-width:320px"><span>Athlete</span><select class="select" data-change="nA">${athletes.map((a) => `<option value="${a.id}" ${a.id === aid ? "selected" : ""}>${esc(a.full_name)}</option>`).join("")}</select></label>` : "")
    + `<div class="row" style="justify-content:flex-start"><button class="btn sec sm" data-act="nD" data-d="${addDays(day, -1)}" aria-label="Previous day">←</button><b class="num" style="min-width:110px;text-align:center">${day === TODAY() ? "Today" : fmtDate(day)}</b>${day < TODAY() ? `<button class="btn sec sm" data-act="nD" data-d="${addDays(day, 1)}" aria-label="Next day">→</button><button class="btn ghost sm" data-act="nD" data-d="${TODAY()}">Today</button>` : ""}</div>`
    + `<div class="grid g4">${stat("Meals", tot.meals)}${stat("Calories", tot.calories, "kcal")}${stat("Protein", tot.protein, "grams")}${stat("Water", tot.water, "ml")}</div>`
    + `<div class="grid ${staff ? "" : "split"}"><div class="grid" style="align-content:start">`
    + (meals.length ? meals.map((m) => `<section class="card"><div class="card-b meal">${m.photo_id && photos[m.photo_id] ? `<img src="${photos[m.photo_id]}" alt="Photo of the meal">` : '<div class="ph">No photo</div>'}<div class="stack" style="min-width:0">
        <div class="row"><b>${T[m.meal_type] || esc(m.meal_type)}</b>${!staff ? `<button class="btn danger sm" data-act="delMeal" data-m="${m.id}">Delete</button>` : ""}</div><p class="small" style="white-space:pre-line">${esc(m.description)}</p>
        <p class="tiny muted num">${[m.calories != null && `${m.calories} kcal`, m.protein_g != null && `${+m.protein_g} g protein`, m.carbs_g != null && `${+m.carbs_g} g carbs`, m.fat_g != null && `${+m.fat_g} g fat`, m.water_ml != null && `${m.water_ml} ml water`].filter(Boolean).join(" · ") || "No numbers entered"}</p>
        ${staff ? `<form class="row" data-form="comment" data-m="${m.id}" style="align-items:flex-end"><label class="field" style="flex:1"><span class="sr">Comment</span><input class="input" name="c" value="${esc(m.coach_comment || "")}" maxlength="1000" placeholder="Feedback for ${esc(name)}"></label><button class="btn sec sm">Save</button></form>` : m.coach_comment ? `<p class="comment"><b>Coach comment:</b> ${esc(m.coach_comment)}</p>` : ""}</div></div></section>`).join("") : `<section class="card">${empty(`No meals logged ${day === TODAY() ? "today" : "on this day"}.`)}</section>`)
    + card("Calories, last 7 days", bars(series, "calories") + `<p class="tiny muted">Totals of the numbers entered; meals without numbers count as logged but add nothing.</p>`)
    + `</div>`
    + (!staff ? card("Log a meal", `<form class="stack" data-form="meal"><label class="field"><span>Meal</span><select class="select" name="type">${L.MEAL_TYPES.map((x) => `<option value="${x}" ${x === defType ? "selected" : ""}>${T[x]}</option>`).join("")}</select></label>
        <label class="field"><span>What did you eat?</span><textarea class="textarea" name="desc" required maxlength="1000" placeholder="Chicken, rice, salad and a glass of water"></textarea></label>
        <label class="field"><span>Photo (optional)</span><input class="input" name="photo" type="file" accept="image/png,image/jpeg,image/webp" capture="environment"></label>
        <div class="f2"><label class="field"><span>Calories</span><input class="input" name="kcal" type="number" min="0" max="10000"></label><label class="field"><span>Protein (g)</span><input class="input" name="p" type="number" min="0" max="1000" step="0.1"></label><label class="field"><span>Carbs (g)</span><input class="input" name="c" type="number" min="0" max="2000" step="0.1"></label><label class="field"><span>Fat (g)</span><input class="input" name="f" type="number" min="0" max="1000" step="0.1"></label><label class="field"><span>Water (ml)</span><input class="input" name="water" type="number" min="0" max="10000" step="50"></label></div>
        <button class="btn">Save meal</button></form>`) : "")
    + `</div>`;
};
const photoCache = {};
async function loadPhotos(ids) {
  const need = ids.filter((id) => !photoCache[id]);
  if (need.length) {
    const rows = await q(sb.from("attachments").select("id, mime_type, data").in("id", need));
    for (const r of rows) photoCache[r.id] = `data:${r.mime_type};base64,${hexToBase64(r.data)}`;
  }
  return photoCache;
}
function hexToBase64(hex) {
  const h = String(hex).replace(/^\\x/, ""); let bin = "";
  for (let i = 0; i < h.length; i += 2) bin += String.fromCharCode(parseInt(h.substr(i, 2), 16));
  return btoa(bin);
}
/** Scales a photo down in the browser (longest side 1280 px) and returns JPEG bytes, as the database stores them. */
function photoBytes(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(async (b) => (b ? resolve(new Uint8Array(await b.arrayBuffer())) : reject(new Error("photo"))), "image/jpeg", 0.85); };
    img.onerror = () => reject(new Error("photo")); img.src = url;
  });
}
const toHex = (bytes) => "\\x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/* ---------- payments (owners) */
VIEWS.payments = async () => {
  const t = TODAY(), f = ui("pf") || "all";
  const [rows, roster] = await Promise.all([q(sb.from("athlete_payments").select("id, athlete_id, description, amount, currency, due_date, paid_on, method, note").order("due_date", { ascending: false }).limit(3000)), q(sb.rpc("org_roster"))]);
  const nameOf = new Map(roster.map((r) => [r.athlete_id, r.full_name])), sm = L.summarize(rows, t), bal = L.balancesByAthlete(rows, t);
  const shown = rows.filter((p) => { const st = L.paymentStatus(p, t); return f === "all" || (f === "unpaid" ? st !== "paid" : st === f); });
  const M = { cash: "Cash", bank_transfer: "Bank transfer", card: "Card", app: "Payment app", cheque: "Cheque", other: "Other" }, PILL = { paid: '<span class="pill p-green">Paid</span>', overdue: '<span class="pill p-red">Overdue</span>', due: '<span class="pill p-amber">Due</span>' };
  const athleteOpts = roster.map((r) => `<option value="${r.athlete_id}">${esc(r.full_name)}</option>`).join("");
  return header("Payments", "Fees and charges per athlete. Only the academy's owners see this page.")
    + `<div class="grid g4">${stat("Outstanding", `<span style="font-size:20px">${L.formatMoneyTotals(sm.outstanding, "en")}</span>`, `${sm.unpaidCount} unpaid`)}${stat("Overdue", `<span style="font-size:20px">${L.formatMoneyTotals(sm.overdue, "en")}</span>`, `${sm.overdueCount} late`)}${stat("Collected this month", `<span style="font-size:20px">${L.formatMoneyTotals(sm.collectedThisMonth, "en")}</span>`)}${stat("Who owes", bal.length)}</div>`
    + `<div class="chips" role="group" aria-label="Filter">${[["all", "All"], ["unpaid", "Unpaid"], ["overdue", "Overdue"], ["paid", "Paid"]].map(([k, l]) => `<button data-act="pf" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div>`
    + `<section class="card"><div class="table-wrap"><table><thead><tr><th>Athlete</th><th>Description</th><th>Amount</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>
      ${shown.map((p) => { const st = L.paymentStatus(p, t); return `<tr><td style="white-space:nowrap"><b>${esc(nameOf.get(p.athlete_id) || "—")}</b></td><td>${esc(p.description)}${p.note ? `<div class="tiny muted">${esc(p.note)}</div>` : ""}</td><td class="num" style="font-weight:600;white-space:nowrap">${L.formatMoney(Number(p.amount), p.currency, "en")}</td><td class="num" style="white-space:nowrap">${fmtDate(p.due_date)}</td><td>${PILL[st]}${p.paid_on ? `<div class="tiny muted">${fmtDate(p.paid_on)}${p.method ? " · " + M[p.method] : ""}</div>` : ""}</td>
        <td><div class="row" style="justify-content:flex-end;flex-wrap:nowrap;gap:6px">${p.paid_on ? `<button class="btn sec sm" data-act="unpay" data-p="${p.id}">Mark unpaid</button>` : `<select class="select" id="pm-${p.id}" style="width:auto;padding:5px 8px;font-size:13px" aria-label="Method">${Object.entries(M).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select><button class="btn sm" data-act="pay" data-p="${p.id}">Mark paid</button>`}<button class="btn danger sm" data-act="delPay" data-p="${p.id}">Delete</button></div></td></tr>`; }).join("") || `<tr><td colspan="6">${empty(rows.length ? "No payments match this filter." : "No payments yet.")}</td></tr>`}
    </tbody></table></div></section>`
    + `<div class="grid g3">`
    + card("Who owes", bal.length ? `<div class="list">${bal.map((b) => `<div class="stack" style="gap:2px"><b>${esc(nameOf.get(b.athleteId) || "—")}</b><div class="row" style="justify-content:flex-start;flex-wrap:wrap">${b.overdueCount ? `<span class="pill p-red">Overdue: ${L.formatMoneyTotals(b.overdue, "en")}</span>` : ""}<span class="num small" style="font-weight:600">${L.formatMoneyTotals(b.outstanding, "en")}</span><span class="tiny muted">Last paid: ${b.lastPaid ? fmtDate(b.lastPaid) : "—"}</span></div></div>`).join("")}</div>` : `<p class="muted small">Nobody owes anything right now.</p>`)
    + card("Record a payment", roster.length ? `<form class="stack" data-form="payment"><label class="field"><span>Athlete</span><select class="select" name="athlete">${athleteOpts}</select></label><label class="field"><span>Description</span><input class="input" name="desc" required maxlength="120" placeholder="November fee"></label><div class="f2"><label class="field"><span>Amount</span><input class="input" name="amount" type="number" min="0.01" step="0.01" required></label><label class="field"><span>Currency</span><select class="select" name="currency">${L.CURRENCIES.map((c) => `<option>${c}</option>`).join("")}</select></label></div><label class="field"><span>Due date</span><input class="input" name="due" type="date" value="${t}" required></label><label class="check"><input type="checkbox" name="paid"> Already paid</label><label class="field"><span>Method</span><select class="select" name="method">${Object.entries(M).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label><label class="field"><span>Note</span><input class="input" name="note" maxlength="500"></label><button class="btn">Record payment</button></form>` : `<p class="muted small">Add athletes to the roster first.</p>`)
    + card("Charge the whole roster", roster.length ? `<form class="stack" data-form="charge"><p class="tiny muted">Creates the same charge for all ${roster.length} athletes on the roster.</p><label class="field"><span>Description</span><input class="input" name="desc" required maxlength="120" placeholder="December fee"></label><div class="f2"><label class="field"><span>Amount</span><input class="input" name="amount" type="number" min="0.01" step="0.01" required value="350"></label><label class="field"><span>Currency</span><select class="select" name="currency">${L.CURRENCIES.map((c) => `<option>${c}</option>`).join("")}</select></label></div><label class="field"><span>Due date</span><input class="input" name="due" type="date" value="${addDays(t, 30)}" required></label><label class="check"><input type="checkbox" name="confirm" required> Charge all ${roster.length} athletes</label><button class="btn sec">Create charges</button></form>` : `<p class="muted small">No athletes yet.</p>`)
    + `</div>`;
};

/* ---------- athlete: workout tracker */
VIEWS.tracker = async () => {
  if (!S.athleteId) return header("Workout Tracker") + `<div class="notice ok">Join your academy to see your workouts. <button class="link" ${go("join")}>Join the Academy</button></div>`;
  const t = TODAY(), [events, completions] = await Promise.all([scheduleFor(S.athleteId), q(sb.from("workout_completions").select("session_id, status, session_rpe, duration_min, completed_on").eq("athlete_id", S.athleteId))]);
  const open = ui("sess");
  const items = open ? await q(sb.from("session_exercises").select("exercise_name, exercise_id, sets, reps, load_kg, rest_s, notes").eq("session_id", open).order("position")) : [];
  const videos = items.some((x) => x.exercise_id) ? await q(sb.from("exercises").select("id, video_url, coaching_cues").in("id", items.map((x) => x.exercise_id).filter(Boolean))) : [];
  const compOf = (sid) => completions.filter((c) => c.session_id === sid).sort((a, b) => b.completed_on.localeCompare(a.completed_on))[0];
  const mon = addDays(t, -((new Date(t + "T12:00:00").getDay() + 6) % 7)), sun = addDays(mon, 6);
  const groups = [["This week", events.filter((e) => e.date >= mon && e.date <= sun)], ["Coming up", events.filter((e) => e.date > sun).slice(0, 8)], ["Earlier", events.filter((e) => e.date < mon).reverse().slice(0, 10)]];
  const row = ({ a, s, date }) => { const c = compOf(s.id); return `<div class="stack"><div class="row" style="flex-wrap:wrap"><div><b>${esc(s.title)}</b><div class="tiny muted">${fmtDate(date)}${date === t ? " · today" : ""}${s.planned_duration_min ? ` · ${s.planned_duration_min} min` : ""} · ${esc(a.training_programs?.title)}</div></div><div class="row" style="gap:6px">${c ? STATUS_PILL[c.status] + (c.session_rpe != null ? `<span class="tiny muted">RPE ${c.session_rpe}</span>` : "") : planned}<button class="btn ${!c && date <= t ? "" : "sec"} sm" data-act="openSession" data-s="${s.id}">${open === s.id ? "Close" : !c && date <= t ? "Log" : "Exercises"}</button></div></div>
    ${open === s.id ? `<div class="card" style="box-shadow:none"><div class="table-wrap"><table><thead><tr><th>Exercise</th><th>Sets × reps</th><th>Load</th></tr></thead><tbody>${items.map((x) => { const v = videos.find((y) => y.id === x.exercise_id); return `<tr><td><b>${esc(x.exercise_name)}</b>${v?.coaching_cues?.length ? `<div class="tiny muted">${esc(v.coaching_cues[0])}</div>` : ""}${v?.video_url ? ` <a class="link" href="${esc(v.video_url)}" target="_blank" rel="noopener noreferrer">Video ↗</a>` : ""}</td><td class="num">${x.sets ?? "—"} × ${esc(x.reps || "—")}</td><td>${x.load_kg != null ? x.load_kg + " kg" : "—"}</td></tr>`; }).join("") || `<tr><td colspan="3">${empty("No exercises in this session yet.")}</td></tr>`}</tbody></table></div>
      ${date <= t ? `<form class="card-b" data-form="log" data-s="${s.id}" data-d="${date}" style="border-top:1px solid var(--line)"><div class="f2"><label class="field"><span>How did it go?</span><select class="select" name="status"><option value="completed">Done</option><option value="partial">Partly done</option><option value="skipped">Skipped</option></select></label><label class="field"><span>Minutes</span><input class="input" name="minutes" type="number" min="0" max="600" value="${s.planned_duration_min || 45}"></label></div><label class="field"><span>Effort (RPE 0–10): <output id="rpe-out">6</output></span><input type="range" name="rpe" min="0" max="10" value="6" data-out="rpe-out"></label><label class="field"><span>How did it feel? (optional)</span><input class="input" name="feedback" maxlength="2000"></label><button class="btn" style="justify-self:start">${c ? "Update log" : "Save workout"}</button></form>` : ""}</div>` : ""}</div>`; };
  return header("Workout Tracker", "Your program sessions. Log each one as done, partly done or skipped, with your effort.")
    + groups.map(([title, list]) => card(title, list.length ? `<div class="list">${list.map(row).join("")}</div>` : `<p class="muted small">Nothing here.</p>`)).join("");
};

/* ---------- athlete: coach notes */
VIEWS.notes = async () => {
  if (!S.athleteId) return header("Coach Notes") + empty("Join your academy to see notes from your coaches.");
  const notes = await q(sb.from("athlete_notes").select("id, body, created_at, author_id").eq("athlete_id", S.athleteId).eq("shared_with_athlete", true).order("created_at", { ascending: false }).limit(200));
  const ids = [...new Set(notes.map((n) => n.author_id))], authors = ids.length ? await q(sb.from("profiles").select("id, full_name").in("id", ids)) : [];
  return header("Coach Notes", "Notes your coaches have shared with you, newest first.")
    + (notes.length ? `<div class="grid">${notes.map((n) => { const who = authors.find((a) => a.id === n.author_id)?.full_name || "Your coach"; return `<section class="card"><div class="card-b"><div class="row" style="justify-content:flex-start"><span class="avatar sm">${initials(who)}</span><div><b>${esc(who)}</b><div class="tiny muted">${fmtDate(n.created_at)}</div></div></div><p style="white-space:pre-line">${esc(n.body)}</p></div></section>`; }).join("")}</div>` : `<section class="card">${empty("No notes yet. When a coach shares a note with you, it appears here.")}</section>`);
};

/* ---------- athlete: my progress */
VIEWS.progress = async () => {
  if (!S.athleteId) return header("My Progress") + empty("Join your academy to see your progress.");
  const t = TODAY(), [comps, results, me, defs] = await Promise.all([
    q(sb.from("workout_completions").select("completed_on, status, session_rpe, duration_min").eq("athlete_id", S.athleteId).limit(3000)),
    q(sb.from("test_results").select("test_id, tested_on, trials").eq("athlete_id", S.athleteId).order("tested_on").limit(1000)),
    q(sb.from("athletes").select("short_term_goals, long_term_goals").eq("id", S.athleteId).maybeSingle()), testDefs()]);
  const st = L.workoutStats(comps, t), weeks = L.weeklyTraining(comps, t);
  const tests = defs.map((d) => ({ d, r: results.filter((x) => x.test_id === d.id) })).filter((x) => x.r.length).sort((a, b) => b.r.length - a.r.length).slice(0, 8);
  return header("My Progress", "Your workouts and test results over time, from what you and your coaches logged.")
    + `<div class="grid g4">${stat("Workouts", st.done30, "last 30 days")}${stat("Completed", st.completionRate30 == null ? "—" : st.completionRate30 + "%", "vs skipped, 30 days")}${stat("Average effort", st.avgRpe30 ?? "—", "RPE, 30 days")}${stat("Workouts in total", st.doneAll)}</div>`
    + `<div class="grid g2">${card("Workouts per week", st.doneAll ? bars(weeks, "workouts") : `<p class="muted small">Log your workouts to see your progress here.</p>`)}${card("Training load per week", st.doneAll ? bars(weeks, "load") + `<p class="tiny muted">Load is effort (RPE 0–10) × minutes.</p>` : `<p class="muted small">No workouts logged yet.</p>`)}</div>`
    + `<h2>Test results</h2>` + (tests.length ? `<div class="grid g2">${tests.map(({ d, r }) => { const pts = r.map((x) => ({ d: x.tested_on, v: L.bestTrial(x.trials, d.higher_is_better) })), vals = pts.map((p) => p.v), ch = pts.length > 1 ? L.percentChange(vals.at(-1), vals[0]) : null;
        return card(esc(d.name), `<div class="grid g3 small"><div><span class="label">Latest</span><div class="num" style="font-weight:700">${vals.at(-1)} ${esc(d.unit)}</div></div><div><span class="label">Best</span><div class="num" style="font-weight:700">${d.higher_is_better ? Math.max(...vals) : Math.min(...vals)} ${esc(d.unit)}</div></div><div><span class="label">Since first</span><div class="num" style="font-weight:700">${ch == null ? "—" : (ch > 0 ? "+" : "") + ch.toFixed(1) + "%"}</div></div></div>${line(pts, d.higher_is_better)}<p class="tiny muted">${d.higher_is_better ? "Higher is better." : "Lower is better; the chart is flipped so up means better."}</p>`); }).join("")}</div>` : `<p class="muted small">No test results yet. Your coaches record them after testing.</p>`)
    + card("My goals", `<div class="grid g2"><div><span class="label">This season</span><p>${esc(me?.short_term_goals || "—")}</p></div><div><span class="label">Long term</span><p>${esc(me?.long_term_goals || "—")}</p></div></div>`);
};

/* ---------- athlete: join the academy */
VIEWS.join = async () => header("Join the Academy", "Enter the academy code (TEAM-…) from your coach. You'll see the academy's name before you join.")
  + card("Academy code", `${ui("preview") ? `<div class="notice ok">You're about to join <b>${esc(ui("preview").org_name)}</b>. While you're on the roster, its coaches and physiotherapists can see your profile, training, test results and meals. You can leave at any time.</div><div class="row" style="justify-content:flex-start"><button class="btn" data-act="confirmJoin">Join ${esc(ui("preview").org_name)}</button><button class="btn ghost" data-act="cancelJoin">Cancel</button></div>` : `<form class="row" data-form="previewCode" style="align-items:flex-end;flex-wrap:wrap"><label class="field" style="flex:1;min-width:200px"><span>Code</span><input class="input" name="code" required maxlength="12" placeholder="TEAM-XXXXXX" style="text-transform:uppercase"></label><button class="btn">Check code</button></form>`}`);

/* ---------- settings */
VIEWS.settings = async () => header("Settings")
  + `<div class="grid g2">` + card("Profile", `<form class="stack" data-form="profile"><label class="field"><span>Full name</span><input class="input" name="full_name" required maxlength="120" value="${esc(S.profile.full_name || "")}"></label><div class="tiny muted">Email: ${esc(S.user.email)}</div><button class="btn sm" style="justify-self:start">Save</button></form>`)
  + card("Appearance and account", `<div>${themeSwitch()}</div><p class="tiny muted">Signed in as ${esc(roleLabel())}${S.org ? " at " + esc(S.org.name) : ""}.</p><div><button class="btn sec" data-act="logout">Sign out</button></div>`) + `</div>`;

/* ============================================================================ events */
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  if (el.dataset.act === "closeSheet" && e.target.closest("[data-stop]")) return; // a tap inside the menu sheet
  const d = el.dataset, act = d.act;
  try {
    switch (act) {
      case "go": S.view = d.v; ui("sheet", false); history.replaceState(null, "", "#" + d.v); return render(true);
      case "more": ui("sheet", true); return render();
      case "closeSheet": ui("sheet", false); return render();
      case "theme": store.set("p360a.theme", d.t); applyTheme(d.t); document.querySelectorAll(".theme-switch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.t === d.t))); return;
      case "logout": await sb.auth.signOut(); S.user = null; S.profile = null; S.ui = {}; S.authStep = "email"; return render();
      case "reload": return location.reload();
      case "authMode": S.authMode = d.m; S.authStep = "email"; return render();
      case "authBack": S.authStep = "email"; return render();
      case "resend": return sendCode(S.authEmail);
      case "ob": ui("ob", d.m || null); return render();
      case "athlete": ui("athlete", d.a || null); return render(true);
      case "athleteFromStaff": ui("athlete", d.a); S.view = "athletes"; return render(true);
      case "messageTo": ui("chatWith", d.u); S.view = "messages"; return render(true);
      case "openMeals": ui("nA", d.a); ui("nD", TODAY()); S.view = "nutrition"; return render(true);
      case "chatWith": ui("chatWith", d.u); return render();
      case "ask": return ask(d.q);
      case "clearChat": ui("chat", []); return render();
      case "mo": ui("mo", (ui("mo") || 0) + Number(d.d)); return render();
      case "calDay": ui("calDay", d.d); return render();
      case "openSession": ui("sess", ui("sess") === d.s && S.view === "tracker" ? null : d.s); S.view = "tracker"; return render();
      case "prog": ui("prog", d.p || null); ui("pw", 1); return render(true);
      case "pw": ui("pw", Number(d.w)); return render();
      case "cat": ui("cat", d.c); return render();
      case "nD": ui("nD", d.d); return render();
      case "pf": ui("pf", d.f); return render();
      case "copy": try { await navigator.clipboard.writeText(d.t); toast("Copied " + d.t); } catch { toast("Select and copy: " + d.t); } return;
      case "delNote": if (!(await confirmTap(el, "Delete note?"))) return; await q(sb.from("athlete_notes").delete().eq("id", d.n)); toast("Note deleted"); return render();
      case "rmEx": await q(sb.from("session_exercises").delete().eq("id", d.x)); toast("Exercise removed"); return render();
      case "unassign": if (!(await confirmTap(el, "Remove?"))) return; await q(sb.from("program_assignments").update({ status: "cancelled" }).eq("id", d.x)); toast("Assignment removed"); return render();
      case "delMeal": if (!(await confirmTap(el, "Delete meal?"))) return; await q(sb.from("meal_logs").delete().eq("id", d.m)); toast("Meal deleted"); return render();
      case "pay": await q(sb.rpc("set_payment_paid", { p_id: d.p, p_paid_on: TODAY(), p_method: document.getElementById("pm-" + d.p)?.value || "cash" })); toast("Marked paid"); return render();
      case "unpay": await q(sb.rpc("set_payment_paid", { p_id: d.p, p_paid_on: null, p_method: null })); toast("Marked unpaid"); return render();
      case "delPay": if (!(await confirmTap(el, "Delete payment?"))) return; await q(sb.rpc("delete_payment", { p_id: d.p })); toast("Payment deleted"); return render();
      case "owner": await q(sb.rpc("set_org_owner", { p_user: d.u, p_on: d.on === "1" })); toast(d.on === "1" ? "Made an owner" : "No longer an owner"); return render();
      case "removeMember": if (!(await confirmTap(el, "Remove from academy?"))) return; await q(sb.rpc("remove_org_member", { p_user: d.u })); toast("Removed from the academy"); return render();
      case "revoke": await q(sb.rpc("revoke_org_code", { p_code_id: d.c })); toast("Invitation revoked"); return render();
      case "newCode": if (!(await confirmTap(el, "New code? The old one stops working"))) return; await q(sb.rpc("regenerate_org_athlete_code")); toast("New athlete code created"); return render();
      case "confirmJoin": { const code = ui("joinCode"); const res = await q(sb.rpc("connect_with_org_code", { p_code: code })); ui("preview", null); if (res === "connected" || res === "already_connected") { toast("You joined the academy"); await loadContext(S.user); S.view = "dashboard"; return render(true); } toast(res === "invalid_code" ? "That code isn't valid. Check it with your coach." : "Could not join: " + res, true); return render(); }
      case "cancelJoin": ui("preview", null); return render();
    }
  } catch (err) { /* q() already showed the error */ }
});
/** Two-tap confirmation in place (the browser's confirm() is not used). */
function confirmTap(el, text) {
  if (el.dataset.armed) return Promise.resolve(true);
  const old = el.textContent; el.dataset.armed = "1"; el.textContent = text; setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = old; } }, 3500);
  return Promise.resolve(false);
}
document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr[data-act]")) { e.preventDefault(); e.target.click(); } });
let inputTimer;
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.out) { document.getElementById(t.dataset.out).textContent = t.value; return; }
  if (t.dataset.input) { ui(t.dataset.input, t.value); clearTimeout(inputTimer); inputTimer = setTimeout(async () => { const pos = t.selectionStart, id = t.id; await render(); const n = document.getElementById(id); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250); }
});
document.addEventListener("change", async (e) => {
  const t = e.target, c = t.dataset.change; if (!c) return;
  try {
    if (c === "setRole") { await q(sb.rpc("set_org_member_role", { p_user: t.dataset.u, p_org_role: t.value })); toast("Role changed"); return render(); }
    if (c === "test") { ui("test", t.value); return render(); }
    if (c === "nA") { ui("nA", t.value); return render(); }
  } catch { render(); }
});
document.addEventListener("submit", async (e) => {
  const f = e.target; e.preventDefault();
  const fd = new FormData(f), v = (k) => String(fd.get(k) ?? "").trim(), n = (k) => (v(k) === "" ? null : Number(v(k))), kind = f.dataset.form;
  const btn = f.querySelector("button:not([type=button])"); if (btn) btn.disabled = true;
  try {
    switch (kind) {
      case "sendCode": return await sendCode(v("email"));
      case "verify": return await verifyCode(v("code"));
      case "password": { S.busy = true; S.authEmail = v("email"); const { error } = await sb.auth.signInWithPassword({ email: v("email"), password: String(fd.get("password")) }); S.busy = false; if (error) { toast(friendly(error), true); return render(); } return; }
      case "terms": await q(sb.rpc("accept_terms", { p_version: CONFIG.terms })); await loadContext(S.user); return;
      case "createOrg": await q(sb.rpc("create_organization", { p_name: v("name"), p_sport: v("sport") || null, p_full_name: v("full_name") })); ui("ob", null); toast("Academy created"); await loadContext(S.user); S.view = "staff"; return render(true);
      case "joinStaff": { const res = await q(sb.rpc("join_organization", { p_code: v("code").toUpperCase(), p_full_name: v("full_name") })); if (res !== "joined") { toast(res === "already_member" ? "You're already in an academy." : res === "not_allowed" ? "An athlete account can't join as staff." : "That invitation isn't valid. It may have been used, revoked or expired.", true); return render(); } ui("ob", null); toast("You joined the academy"); await loadContext(S.user); return render(true); }
      case "joinAthlete": {
        await q(sb.rpc("complete_onboarding", { p_role: "athlete", p_full_name: v("full_name") })); ui("ob", null); await loadContext(S.user);
        if (v("code")) { S.view = "join"; ui("joinCode", v("code").toUpperCase()); const pv = await q(sb.rpc("preview_org_code", { p_code: v("code").toUpperCase() })); ui("preview", pv?.[0] || null); if (!pv?.length) toast("That academy code isn't valid. Check it with your coach.", true); }
        return render(true);
      }
      case "previewCode": { const code = v("code").toUpperCase(); const pv = await q(sb.rpc("preview_org_code", { p_code: code })); if (!pv?.length) { toast("That academy code isn't valid. Check it with your coach.", true); return render(); } ui("joinCode", code); ui("preview", pv[0]); return render(); }
      case "profile": await q(sb.from("profiles").update({ full_name: v("full_name") }).eq("id", S.user.id)); S.profile.full_name = v("full_name"); toast("Saved"); return render();
      case "ask": { const qq = v("q"); if (qq) ask(qq); return; }
      case "send": await q(sb.rpc("send_message", { p_to: f.dataset.u, p_body: v("body") })); await render(); document.getElementById("msg")?.focus(); return;
      case "note": await q(sb.from("athlete_notes").insert({ athlete_id: f.dataset.a, author_id: S.user.id, body: v("body"), shared_with_athlete: fd.get("shared") === "on" })); toast("Note added"); return render();
      case "invite": { const code = await q(sb.rpc("create_staff_invite", { p_org_role: v("role") })); toast("Invitation " + code + " created"); return render(); }
      case "newProg": { const row = await q(sb.from("training_programs").insert({ coach_id: S.user.id, title: v("title"), num_weeks: Math.min(52, Math.max(1, n("weeks") || 4)), goal: v("goal") || null, program_type: "block" }).select("id").single()); ui("prog", row.id); ui("pw", 1); toast("Program created"); return render(true); }
      case "addSess": await q(sb.from("training_sessions").insert({ program_id: f.dataset.p, week_number: ui("pw") || 1, day_number: n("day") || 1, title: v("title"), planned_duration_min: n("minutes") })); toast("Session added"); return render();
      case "addEx": {
        const ex = (ui("lib") || []).find((x) => x.id === v("ex")); if (!ex) return;
        const last = await q(sb.from("session_exercises").select("position").eq("session_id", f.dataset.s).order("position", { ascending: false }).limit(1));
        await q(sb.from("session_exercises").insert({ session_id: f.dataset.s, exercise_id: ex.id, exercise_name: ex.name, position: (last?.[0]?.position ?? -1) + 1, section: "strength", sets: n("sets"), reps: v("reps") || null, load_kg: n("load") }));
        toast("Exercise added"); return render();
      }
      case "assign": {
        await q(sb.from("program_assignments").insert({ program_id: f.dataset.p, athlete_id: v("athlete"), assigned_by: S.user.id, start_date: v("start") || TODAY() }));
        await sb.from("training_programs").update({ status: "active" }).eq("id", f.dataset.p).eq("status", "draft");
        toast("Assigned"); return render();
      }
      case "result": {
        const trials = ["t1", "t2", "t3"].map(n).filter((x) => x != null && !Number.isNaN(x)); if (!trials.length) return;
        await q(sb.from("test_results").insert({ athlete_id: v("athlete"), test_id: f.dataset.t, tested_on: v("date") || TODAY(), side: "both", trials, data_quality: "good", is_baseline: false, tester_id: S.user.id }));
        toast("Result saved"); return render();
      }
      case "comment": await q(sb.rpc("comment_on_meal", { p_meal: f.dataset.m, p_comment: v("c") })); toast(v("c") ? "Comment saved" : "Comment removed"); return render();
      case "meal": {
        const row = await q(sb.from("meal_logs").insert({ athlete_id: S.athleteId, eaten_on: ui("nD") || TODAY(), meal_type: v("type"), description: v("desc"), calories: n("kcal"), protein_g: n("p"), carbs_g: n("c"), fat_g: n("f"), water_ml: n("water") }).select("id").single());
        const file = fd.get("photo");
        if (file && file.size) {
          try {
            if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("type");
            const bytes = await photoBytes(file);
            if (bytes.length > 5 * 1024 * 1024) throw new Error("size");
            const { data: att, error } = await sb.rpc("add_attachment", { p_kind: "meal", p_ref: row.id, p_athlete: null, p_name: "meal.jpg", p_data: toHex(bytes) });
            if (error) throw error;
            const { error: e2 } = await sb.rpc("set_meal_photo", { p_meal: row.id, p_attachment: att }); if (e2) throw e2;
          } catch (err) { console.error(err); toast("The meal was saved, but the photo could not be added. Use a JPG, PNG or WebP photo.", true); return render(); }
        }
        toast("Meal saved"); return render();
      }
      case "log": await q(sb.from("workout_completions").upsert({ session_id: f.dataset.s, athlete_id: S.athleteId, completed_on: f.dataset.d > TODAY() ? TODAY() : f.dataset.d, status: v("status"), duration_min: n("minutes"), session_rpe: n("rpe"), athlete_feedback: v("feedback") || null, recorded_by: S.user.id }, { onConflict: "session_id,athlete_id,completed_on" })); ui("sess", null); toast("Workout saved"); return render();
      case "payment": {
        const paid = fd.get("paid") === "on";
        await q(sb.rpc("record_payment", { p_athlete: v("athlete"), p_description: v("desc"), p_amount: n("amount"), p_currency: v("currency"), p_due: v("due"), p_paid_on: paid ? TODAY() : null, p_method: paid ? v("method") : null, p_note: v("note") || null }));
        toast("Payment recorded"); return render();
      }
      case "charge": { const c = await q(sb.rpc("charge_roster", { p_description: v("desc"), p_amount: n("amount"), p_currency: v("currency"), p_due: v("due") })); toast(`${c} payments created`); return render(); }
    }
  } catch (err) { /* shown by q() */ } finally { if (btn && btn.isConnected) btn.disabled = false; }
});
function ask(text) {
  const role = L.assistantRole(S.profile.role, S.org?.org_role || null), log = ui("chat") || [];
  log.push({ me: true, text }, { me: false, text: L.answer(text, role, "en").text }); ui("chat", log); render().then(() => document.getElementById("ask")?.focus());
}
async function sendCode(email) {
  if (!email) return;
  S.busy = true; S.authEmail = email; render();
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { otp_signup: true } } });
  S.busy = false;
  if (error) { toast(friendly(error), true); S.authStep = "email"; return render(); }
  S.authStep = "code"; toast("Code sent. Check your email."); render(); document.getElementById("a-code")?.focus();
}
async function verifyCode(code) {
  S.busy = true; render();
  const { data, error } = await sb.auth.verifyOtp({ email: S.authEmail, token: code.replace(/\s/g, ""), type: "email" });
  S.busy = false;
  if (error) { toast(friendly(error), true); return render(); }
  S.authStep = "email"; if (data.user && data.user.id !== S.user?.id) await loadContext(data.user);
}
window.addEventListener("hashchange", () => { const h = location.hash.replace("#", ""); if (S.profile && viewsFor().some((v) => v[0] === h) && h !== S.view) { S.view = h; render(true); } });
boot();
