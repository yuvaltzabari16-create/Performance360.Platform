"use strict";
/* Performance360 Academy — standalone web app on Supabase. Sign-in with an emailed one-time code.
   Access model (enforced by Postgres row-level security, not by this page):
   - owner (owner + coach): everything, including payments and academy settings.
   - coach / physiotherapist: read and manage every athlete in their academy.
   - athlete: only their own records; writes only their own logs, meals, messages, profile. */
const APP_VERSION = "1.0.0";
const TERMS_VERSION = "2026-11";
const DEFAULT_TESTS = [
  { id: "sprint10", name: "10 m sprint", unit: "s", better: "lower" },
  { id: "sprint30", name: "30 m sprint", unit: "s", better: "lower" },
  { id: "cmj", name: "Countermovement jump", unit: "cm", better: "higher" },
  { id: "broad", name: "Standing broad jump", unit: "cm", better: "higher" },
  { id: "cod505", name: "505 change of direction", unit: "s", better: "lower" },
  { id: "yoyo", name: "Yo-Yo IR1", unit: "m", better: "higher" },
  { id: "squat1rm", name: "Back squat 1RM", unit: "kg", better: "higher" },
  { id: "mass", name: "Body mass", unit: "kg", better: "none" },
];
const DEFAULT_TYPES = ["Strength", "Speed", "Conditioning", "Skills", "Rehab", "Recovery", "Testing", "Match"];
const MEAL_TYPES = [["breakfast", "Breakfast"], ["snack_am", "Morning snack"], ["lunch", "Lunch"], ["snack_pm", "Afternoon snack"], ["pre", "Pre-training"], ["post", "Post-training"], ["dinner", "Dinner"]];
const CURRENCIES = ["ILS", "USD", "EUR", "GBP", "CAD", "AUD"];
const ROLE_LABEL = { owner: "Owner · Coach", coach: "Coach", physio: "Physiotherapist", athlete: "Athlete" };

/* ---------- utilities ---------- */
const $ = (s) => document.querySelector(s);
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parseDay = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return iso(d); };
const fmtDay = (s, o = { weekday: "short", day: "numeric", month: "short" }) => (s ? parseDay(s).toLocaleDateString(LOC(), o) : "");
const fmtTs = (ts) => { if (!ts) return ""; const d = new Date(ts); return d.toLocaleString(LOC(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
const nowIso = () => new Date().toISOString();
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const clampStr = (s, n) => String(s ?? "").trim().slice(0, n);
function ago(ts) {
  if (!ts) return "";
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  if (s < 86400 * 7) return Math.floor(s / 86400) + " d ago";
  return fmtTs(ts);
}
function vals(obj) {
  return Object.entries(obj || {}).filter(([, v]) => v && typeof v === "object").map(([id, v]) => ({ ...v, id }));
}
function initials(n) { return String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?"; }
function weekStart(s) {
  const d = parseDay(s); const ws = (S.settings?.weekStart || "sun") === "mon" ? 1 : 0;
  d.setDate(d.getDate() - ((d.getDay() - ws + 7) % 7)); return iso(d);
}
function money(n, cur) {
  cur = cur || S.settings?.currency || "ILS";
  try { return new Intl.NumberFormat(LOC(), { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n || 0); }
  catch { return `${cur} ${(n || 0).toFixed(2)}`; }
}
function safeImg(src) { return typeof src === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : ""; }
function videoUrl(v) {
  if (!v) return "";
  if (v.startsWith("w:")) return "https://www.youtube.com/watch?v=" + encodeURIComponent(v.slice(2));
  if (v.startsWith("s:")) return "https://www.youtube.com/shorts/" + encodeURIComponent(v.slice(2));
  if (v.startsWith("u:")) { const u = v.slice(2); return /^https:\/\//.test(u) ? u : ""; }
  return /^https:\/\//.test(v) ? v : "";
}
function errText(e) {
  const c = e && e.code;
  if (c === "invalid_argument") return "You don't have permission to change this, or the entry is invalid.";
  if (c === "quota_exceeded") return "The academy's storage is full. Remove old meals or messages, then try again.";
  if (c === "resource_exhausted") return "Too many changes at once. Wait a moment and try again.";
  if (c === "unavailable") return "The data store isn't reachable right now. Try again in a moment.";
  if (c === "revoked") return "Your access to this academy was changed. Reload the page.";
  return (e && e.message) || "Something went wrong.";
}

/* ---------- state ---------- */
const S = {
  phase: "boot", db: null, user: null, uid: null, isOwner: false, isAdmin: false, viewerName: "",
  role: null, settings: null, staff: {}, athletes: {}, roster: {}, plan: {}, logs: {}, notes: {}, staffnotes: {},
  tests: {}, inbox: {}, payments: {}, programs: {}, staffroom: null, library: {}, prefs: {}, meals: {}, mealsFor: null,
  loaded: {}, slow: false, names: {}, view: "dashboard", sel: {}, modal: null, armed: null, chat: [], aiBusy: false,
  sample: null, downloads: null, edit: {}, dirty: new Set(), readOnly: false,
};
const unsubs = [];
let mealUnsub = null;

/* ---------- boot ---------- */
async function boot() {
  try { applyTheme(localPref("theme") || "system"); applyLang(); } catch {}
  const timer = setTimeout(() => { if (S.phase === "boot") { S.phase = "nodb"; render(); } }, 12000);
  const [db, user] = await Promise.all([claude.use("db"), claude.use("user")]).catch(() => [null, null]);
  clearTimeout(timer);
  if (!db || !user) { S.phase = "nodb"; return render(); }
  S.db = db; S.user = user;
  const [uid, isOwner, isAdmin, me] = await Promise.all([user.id(), user.isOwner(), user.canEdit(), user.me().catch(() => null)]);
  if (!uid) { S.phase = "nodb"; return render(); }
  S.uid = uid; S.signedIn = !!readSession(); S.isOwner = !!isOwner; S.isAdmin = !!isAdmin || !!isOwner; S.viewerName = (me && me.name) || "";
  claude.use("sample").then((s) => { S.sample = s; render(); });
  claude.use("downloads").then((d) => { S.downloads = d; });
  const t = location.hash.slice(1); if (t) S.view = t;
  window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (v && v !== S.view) go(v, false); });
  S.phase = "loading"; render();
  setTimeout(() => { if (!S.loaded.settings && !S.loaded.me) { S.slow = true; render(); } }, 10000);
  subscribeCommon();
  if (S.isAdmin) subscribeStaff(); else subscribeAthlete();
}

function onErr(key) { return (e) => { S.loaded[key] = true; if (e && e.code === "revoked") S.revoked = true; console.warn(key, e && e.code); schedule(); }; }
function watchDoc(path, apply, key) {
  unsubs.push(S.db.doc(path).onSnapshot((snap) => { apply(snap.exists ? snap.data() : null); S.loaded[key] = true; schedule(); }, onErr(key)));
}
function watchColl(path, key, q) {
  let ref = S.db.collection(path); if (q) ref = q(ref);
  unsubs.push(ref.onSnapshot((snap) => { const m = {}; snap.docs.forEach((d) => { m[d.id] = d.data(); }); S[key] = m; S.loaded[key] = true; schedule(); }, onErr(key)));
}
function subscribeCommon() {
  watchDoc("academy/settings", (d) => { S.settings = d; }, "settings");
  watchColl("staff", "staff");
  watchColl("library", "library");
  watchDoc(`data/users/${S.uid}/prefs`, (d) => { S.prefs = d || {}; if (S.prefs.theme && S.prefs.theme !== (document.documentElement.dataset.p360theme || "")) { applyTheme(S.prefs.theme); setLocalPref("theme", S.prefs.theme); } if ((S.prefs.lang === "he" || S.prefs.lang === "en") && S.prefs.lang !== LANG) setLang(S.prefs.lang); }, "prefs");
}
function subscribeStaff() {
  ["athletes", "roster", "plan", "logs", "notes", "staffnotes", "tests", "inbox", "programs"].forEach((c) => watchColl(c, c));
  watchDoc("staffroom/main", (d) => { S.staffroom = d; }, "staffroom");
  if (S.isOwner) watchColl("payments", "payments");
  watchDoc("staffonly/joincode", (d) => { S.joincode = d; }, "joincode");
  if (S.isOwner) watchDoc("ownerprivate/codes", (d) => { S.ownercodes = d; }, "ownercodes");
}
function subscribeAthlete() {
  const u = S.uid;
  const one = (c) => watchDoc(`${c}/${u}`, (d) => { S[c] = d ? { [u]: d } : {}; }, c === "athletes" ? "me" : c);
  ["athletes", "roster", "plan", "logs", "notes", "tests", "inbox"].forEach(one);
  watchMeals(u);
}
function watchMeals(uid) {
  if (S.mealsFor === uid) return;
  if (mealUnsub) mealUnsub();
  S.mealsFor = uid; S.meals = {}; S.loaded.meals = false;
  mealUnsub = S.db.collection(`meals/${uid}/items`).orderBy("date", "desc").limit(150).onSnapshot((snap) => {
    const m = {}; snap.docs.forEach((d) => { m[d.id] = d.data(); }); S.meals = m; S.loaded.meals = true; schedule();
  }, onErr("meals"));
}

/* ---------- role ---------- */
function computeRole() {
  if (S.isOwner) return "owner";
  if (S.isAdmin) { if (!S.loaded.staff) return null; const s = S.staff[S.uid]; return s ? (s.role === "physio" ? "physio" : "coach") : "staff-new"; }
  if (!S.loaded.me) return null;
  return S.athletes[S.uid] ? "athlete" : "athlete-new";
}
const isStaff = () => ["owner", "coach", "physio"].includes(S.role);

/* ---------- names ---------- */
let nameFetch = null;
function nameOf(uid) {
  if (!uid) return "Someone";
  return S.athletes[uid]?.name || S.staff[uid]?.name || S.names[uid] || (uid === S.uid ? S.viewerName || "You" : "Academy member");
}
function queueNames(ids) {
  const missing = ids.filter((i) => i && !S.athletes[i]?.name && !S.staff[i]?.name && !(i in S.names));
  if (!missing.length || nameFetch || !S.user) return;
  missing.forEach((i) => { S.names[i] = ""; });
  nameFetch = S.user.profiles(missing.slice(0, 60)).then((ps) => {
    for (const [id, p] of Object.entries(ps || {})) S.names[id] = p.name || "";
  }).catch(() => {}).finally(() => { nameFetch = null; schedule(); });
}

/* ---------- writes ---------- */
async function upsert(path, patch) {
  const ref = S.db.doc(path);
  try { await ref.update(patch); }
  catch (e) {
    if (e && e.code === "invalid_argument") {
      const g = await ref.get().catch(() => null);
      if (g && !g.exists) { await ref.set(patch); return; }
    }
    throw e;
  }
}
async function act(fn, ok) {
  try { await fn(); if (ok) toast(ok); return true; }
  catch (e) { console.warn(e); toast(errText(e), true); return false; }
}
let toastTimer;
function toast(msg, bad) {
  const t = $("#toast"); t.textContent = tr(msg); t.className = "toast" + (bad ? " err" : ""); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, bad ? 5200 : 2600);
}

/* ---------- preferences ---------- */
function localPref(k) { try { return localStorage.getItem("p360." + k); } catch { return null; } }
function setLocalPref(k, v) { try { localStorage.setItem("p360." + k, v); } catch {} }
function isDarkNow() { const t = document.documentElement.getAttribute("data-theme"); if (t) return t === "dark"; try { return matchMedia("(prefers-color-scheme: dark)").matches; } catch { return false; } }
function applyTheme(t) {
  const r = document.documentElement;
  if (t === "light" || t === "dark") r.setAttribute("data-theme", t);
  else if (r.dataset.p360theme) r.removeAttribute("data-theme");
  r.dataset.p360theme = t;
}
const units = () => S.prefs.units || "kg";
function weightOut(kg) { if (kg == null || kg === "") return ""; const n = Number(kg); return units() === "lb" ? (n * 2.20462).toFixed(1) + " lb" : n + " kg"; }

/* ---------- derived data ---------- */
function settings() {
  const s = S.settings || {};
  return {
    name: s.name || "Performance360 Academy", sport: s.sport || "", currency: s.currency || "ILS", weekStart: s.weekStart || "sun",
    timezone: s.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, groups: Array.isArray(s.groups) ? s.groups : [],
    types: Array.isArray(s.types) && s.types.length ? s.types : DEFAULT_TYPES, tests: Array.isArray(s.tests) && s.tests.length ? s.tests : DEFAULT_TESTS,
    defaultMinutes: s.defaultMinutes || 60, contactEmail: s.contactEmail || "", contactPhone: s.contactPhone || "", address: s.address || "",
    retentionMonths: s.retentionMonths || 24, joinHash: s.joinHash || "", joinSalt: s.joinSalt || "", mealComments: s.mealComments !== false, tagline: s.tagline || "",
  };
}
function athleteIds(includeArchived) {
  return Object.keys(S.athletes).filter((id) => includeArchived || (S.roster[id]?.status || "active") !== "archived")
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
}
function sessionsOf(uid) { return vals(S.plan[uid]?.sessions).map((s) => ({ ...s, athlete: uid })).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))); }
function allSessions() { return Object.keys(S.plan).flatMap(sessionsOf); }
function logOf(uid, sid) { const w = S.logs[uid]?.workouts?.[sid]; return w && typeof w === "object" ? w : null; }
function workoutsOf(uid) { return vals(S.logs[uid]?.workouts); }
function loadOf(w) { return w && w.done && w.rpe && w.minutes ? Number(w.rpe) * Number(w.minutes) : 0; }
function loadWindow(uid, endDay, days) {
  const from = addDays(endDay, -days + 1);
  return workoutsOf(uid).filter((w) => w.date >= from && w.date <= endDay).reduce((a, w) => a + loadOf(w), 0);
}
function acwr(uid) {
  const t = today(); const acute = loadWindow(uid, t, 7); const chronic = loadWindow(uid, t, 28) / 4;
  return chronic > 0 ? acute / chronic : null;
}
function weeklyLoads(uid, weeks) {
  const out = []; let ws = weekStart(today());
  for (let i = weeks - 1; i >= 0; i--) { const s = addDays(ws, -7 * i); out.push({ week: s, load: loadWindow(uid, addDays(s, 6), 7) }); }
  return out;
}
function testsOf(uid) { return vals(S.tests[uid]?.results).sort((a, b) => (a.date || "").localeCompare(b.date || "")); }
function testDef(id) { return settings().tests.find((t) => t.id === id) || { id, name: id, unit: "", better: "higher" }; }
function best(results, better) {
  if (!results.length) return null;
  return results.reduce((b, r) => (better === "lower" ? (r.value < b.value ? r : b) : better === "higher" ? (r.value > b.value ? r : b) : r));
}
function threadOf(uid) { return vals(S.inbox[uid]?.msgs).sort((a, b) => (a.at || "").localeCompare(b.at || "")); }
function unreadFor(uid) {
  const msgs = threadOf(uid); const box = S.inbox[uid] || {};
  if (isStaff()) { const seen = box.readStaff?.[S.uid] || ""; return msgs.filter((m) => m.by !== S.uid && m.from === "athlete" && m.at > seen).length; }
  const seen = box.readAthlete || ""; return msgs.filter((m) => m.from === "staff" && m.at > seen).length;
}
function unreadTotal() { return isStaff() ? Object.keys(S.inbox).reduce((a, u) => a + unreadFor(u), 0) : unreadFor(S.uid); }
function staffroomUnread() { const seen = S.prefs.staffroomSeen || ""; return vals(S.staffroom?.msgs).filter((m) => m.by !== S.uid && m.at > seen).length; }
function chargesOf(uid) { return vals(S.payments[uid]?.charges).sort((a, b) => (b.due || "").localeCompare(a.due || "")); }
function balanceOf(uid) { return chargesOf(uid).filter((c) => !c.paid).reduce((a, c) => a + (Number(c.amount) || 0), 0); }
function libraryItems() {
  const core = Array.isArray(S.library.core?.items) ? S.library.core.items : [];
  const custom = Object.entries(S.library).filter(([id]) => id !== "core").map(([id, v]) => ({ ...v, id, custom: true }));
  return core.map((x, i) => ({ ...x, id: "core-" + i })).concat(custom).filter((x) => x && x.n);
}
function findExercise(name) { const n = String(name || "").toLowerCase(); return libraryItems().find((x) => x.n.toLowerCase() === n); }
function mealsList() { return vals(S.meals).sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || ""))); }

/* ---------- rendering loop ---------- */
let pending = false;
function schedule() { if (!pending) { pending = true; requestAnimationFrame(render); } }
function captureForm() {
  const ae = document.activeElement; const out = { focus: ae && ae.id ? ae.id : null, sel: null, vals: {} };
  try { if (ae && "selectionStart" in ae && ae.selectionStart != null) out.sel = [ae.selectionStart, ae.selectionEnd]; } catch {}
  document.querySelectorAll("#app input, #app select, #app textarea").forEach((el) => {
    const k = fieldKey(el); if (!k || !S.dirty.has(k)) return;
    if (el.type === "checkbox" || el.type === "radio") out.vals[k] = { c: el.checked }; else if (el.type !== "file") out.vals[k] = { v: el.value };
  });
  const th = document.querySelector(".thread"); if (th) out.threadAtBottom = th.scrollHeight - th.scrollTop - th.clientHeight < 40;
  return out;
}
function restoreForm(st) {
  if (Object.keys(st.vals).length) document.querySelectorAll("#app input, #app select, #app textarea").forEach((el) => {
    const v = st.vals[fieldKey(el)]; if (!v) return; if ("c" in v) el.checked = v.c; else el.value = v.v;
  });
  if (st.focus) { const el = document.getElementById(st.focus); if (el) { el.focus({ preventScroll: true }); if (st.sel) try { el.setSelectionRange(st.sel[0], st.sel[1]); } catch {} } }
  const th = document.querySelector(".thread"); if (th && st.threadAtBottom !== false) th.scrollTop = th.scrollHeight;
}
function render() {
  pending = false;
  S.role = S.phase === "loading" || S.phase === "ready" ? computeRole() : null;
  if (S.phase === "loading" && S.role && S.loaded.settings) S.phase = "ready";
  const st = captureForm();
  $("#app").innerHTML = page();
  translateDom($("#app"));
  restoreForm(st);
  if (S.phase === "ready") afterRender();
}
function afterRender() {
  const ids = new Set();
  Object.keys(S.inbox).forEach((u) => threadOf(u).forEach((m) => ids.add(m.by)));
  vals(S.staffroom?.msgs).forEach((m) => ids.add(m.by));
  Object.keys(S.athletes).forEach((u) => ids.add(u));
  queueNames([...ids]);
}
function go(view, push = true) {
  S.view = view; S.modal = null; S.armed = null; S.dirty.clear(); S.navOpen = false;
  if (push && location.hash.slice(1) !== view) location.hash = view;
  render(); window.scrollTo(0, 0);
}
