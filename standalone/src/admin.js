/* ================= management: who signed in, who didn't · all academies (platform admin) ================= */
Object.assign(IC, { activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>' });
NAV.staff[2][1].unshift(["admin", "Management", "activity"]);

// record "last seen" when the app opens and when it comes back to the foreground
let lastTouch = 0;
function touchSeen() { if (!S.academy || Date.now() - lastTouch < 4 * 60000) return; lastTouch = Date.now(); rpc("acad_touch", { a: S.academy.id }).catch(() => {}); }
const _enterAcademy = enterAcademy;
enterAcademy = async function (a) {
  await _enterAcademy(a); touchSeen();
  if (a.role === "owner") rpc("acad_is_platform_admin", {}).then((v) => { S.platformAdmin = !!v; if (v) S.activity = null; schedule(); }, () => {});
};
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") touchSeen(); });

function loadActivity(force) {
  if ((S.activity && !force) || S.activityLoading || !S.academy) return;
  S.activityLoading = true;
  const jobs = [rpc("acad_activity", { a: S.academy.id }), S.platformAdmin ? rpc("acad_platform_overview", {}) : Promise.resolve(null)];
  Promise.all(jobs).then(([act, plat]) => { S.activity = act || []; S.platform = plat; S.activityAt = Date.now(); }, (e) => { S.activity = S.activity || []; toast(errText(e), true); })
    .finally(() => { S.activityLoading = false; schedule(); });
}
function lastActive(p) { const a = p.last_seen || "", b = p.last_sign_in || ""; return a > b ? a : b; }
function activityStatus(p) {
  const t = lastActive(p); if (!t) return { k: "never", label: "Never signed in", cls: "" };
  const days = (Date.now() - new Date(t).getTime()) / 864e5;
  if (new Date(t).toDateString() === new Date().toDateString()) return { k: "today", label: "Active today", cls: "good" };
  if (days <= 7) return { k: "week", label: "This week", cls: "info" };
  return { k: "inactive", label: `Inactive ${Math.floor(days)} days`, cls: "warn" };
}
function lastLogFor(u) { const w = workoutsOf(u).filter((x) => x.done && x.date).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0]; return w ? w.date : ""; }
function lastMealFor(u) { const d = Object.keys(S.logs[u]?.meals || {}).sort().pop(); return d || ""; }

VIEWS.admin = {
  meta: () => ({ title: "Management", sub: S.activityAt ? `Updated ${ago(new Date(S.activityAt).toISOString())}` : "Who signs in and who doesn't", actions: `<button class="btn" data-act="admin-refresh">${icon("sync")}Refresh</button>` }),
  body: () => {
    loadActivity();
    if (!S.activity) return `<div class="card"><div class="row"><span class="spinner"></span>Loading…</div></div>`;
    const ppl = S.activity; const st = (k) => ppl.filter((p) => activityStatus(p).k === k).length;
    const f = S.sel.admF || "all"; const rf = S.sel.admR || ""; const q = (S.sel.admQ || "").toLowerCase();
    const list = ppl.filter((p) => (f === "all" || activityStatus(p).k === f) && (!rf || (rf === "staff" ? p.role !== "athlete" : p.role === rf)) && (!q || (p.display_name || "").toLowerCase().includes(q)));
    const codes = Object.fromEntries((S.people || []).map((p) => [p.member_id, p.login_code])); loadPeople();
    const tile = (k, label, n, cls) => `<button class="card stat clickable" style="border:0;text-align:start;${f === k ? "box-shadow:0 0 0 2px var(--brand)" : ""}" data-act="admin-f" data-f="${k}"><span class="k">${label}</span><span class="v"${cls ? ` style="color:var(--${cls})"` : ""}>${n}</span></button>`;
    return `<div class="grid g4">${tile("all", "Everyone", ppl.length)}${tile("today", "Active today", st("today"), "good")}${tile("week", "This week", st("week"), "info")}${tile("inactive", "Inactive 7+ days", st("inactive"), "warn")}</div>
    ${st("never") ? `<button class="notice warn clickable" style="border:0;text-align:start;width:100%" data-act="admin-f" data-f="never">${st("never")} people never signed in. Tap to see who, and send them their code again.</button>` : ""}
    <div class="card"><div class="row" style="margin-bottom:10px"><input id="admQ" data-live="admQ" placeholder="Search by name" value="${esc(S.sel.admQ || "")}" style="max-width:240px">
      <span class="seg">${[["", "All"], ["athlete", "Athletes"], ["staff", "Staff"]].map(([k, l]) => `<button data-act="admin-r" data-r="${k}" aria-pressed="${rf === k}">${l}</button>`).join("")}</span>
      ${f !== "all" ? `<button class="btn sm ghost" data-act="admin-f" data-f="all">${icon("x")}Clear filter</button>` : ""}</div>
      ${list.length ? `<div class="tablewrap"><table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last seen</th><th>Last workout</th><th>Last meal</th><th class="r">Devices</th>${S.role === "owner" || S.role === "coach" || S.role === "physio" ? "<th>Code</th>" : ""}</tr></thead><tbody>
      ${list.map((p) => { const s = activityStatus(p); const ath = p.role === "athlete"; const lw = ath ? lastLogFor(p.member_id) : ""; const lm = ath ? lastMealFor(p.member_id) : ""; const code = codes[p.member_id];
        return `<tr><td><span class="row" style="flex-wrap:nowrap">${av(p.member_id, true)}<b translate="no" class="${ath && S.athletes[p.member_id] ? "clickable" : ""}" ${ath && S.athletes[p.member_id] ? `data-act="open-athlete" data-u="${esc(p.member_id)}"` : ""}>${esc(p.display_name || "–")}</b></span></td>
          <td>${esc(roleName(tileOf(p.role)))}</td><td><span class="pill ${s.cls}">${esc(s.label)}</span></td>
          <td class="small">${lastActive(p) ? esc(ago(lastActive(p))) : "–"}</td>
          <td class="small">${ath ? (lw ? esc(fmtDay(lw)) : '<span class="faint">None</span>') : "–"}</td><td class="small">${ath ? (lm ? esc(fmtDay(lm)) : '<span class="faint">None</span>') : "–"}</td>
          <td class="r">${p.devices || 0}</td>
          <td>${code ? `<span class="row" style="flex-wrap:nowrap;gap:4px"><code translate="no" class="codebox" style="font-size:14px">${esc(fmtCode(code))}</code><button class="mini" data-act="copy-text" data-t="${esc(inviteText(p.display_name || "", code))}" aria-label="Copy invitation">${icon("copy")}</button>${ath ? `<button class="mini" data-act="thread" data-u="${esc(p.member_id)}" aria-label="Message">${icon("chat")}</button>` : ""}</span>` : "–"}</td></tr>`; }).join("")}
      </tbody></table></div>` : `<p class="muted">Nobody matches.</p>`}
      <p class="small faint" style="margin-top:10px">"Last seen" is when the person last opened the app. Devices are the phones or computers currently signed in with their code.</p></div>
    ${S.platformAdmin && S.platform ? platformCard() : ""}`;
  },
};
function planLabel(x) {
  if (x.plan === "active") return x.paid_until ? `Paid until ${fmtDay(x.paid_until.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}` : "Active, no end date";
  if (x.plan === "trial") return `Trial until ${fmtDay(x.trial_ends_at.slice(0, 10), { day: "numeric", month: "short" })}`;
  return x.plan === "cancelled" ? "Cancelled" : "Payment due";
}
function platformCard() {
  const rows = S.platform || [];
  return `<div class="card"><div class="hd"><h2>${icon("shield")} All academies</h2><span class="pill">${rows.length}</span></div>
    <p class="small muted" style="margin-bottom:8px">Only you see this. Activate an academy after it pays; its records unlock at once.</p>
    <div class="tablewrap"><table><thead><tr><th>Academy</th><th>Plan</th><th class="r">People</th><th class="r">Athletes</th><th class="r">Never signed in</th><th class="r">Active 7 days</th><th>Last activity</th><th></th></tr></thead><tbody>
    ${rows.map((x) => `<tr><td><b translate="no">${esc(x.name)}</b><div class="small faint">${esc(fmtDay(x.created_at.slice(0, 10)))}</div></td><td><span class="pill ${x.active ? (x.plan === "trial" ? "info" : "good") : "bad"}">${esc(planLabel(x))}</span></td>
      <td class="r">${x.members}</td><td class="r">${x.athletes}</td><td class="r">${x.never_signed_in}</td><td class="r">${x.seen_7d}</td><td class="small">${x.last_activity ? esc(ago(x.last_activity)) : "–"}</td>
      <td><select data-change="plat-plan" data-a="${esc(x.id)}" style="width:auto;font-size:14px" aria-label="Change plan"><option value="">Change plan…</option>${sel([["active", "Activate (no end date)"], ["m1", "Paid: +1 month"], ["m12", "Paid: +12 months"], ["t14", "Extend trial 14 days"], ["cancelled", "Cancel"]])}</select></td></tr>`).join("")}
    </tbody></table></div></div>`;
}
ACTIONS["admin-refresh"] = () => { S.activity = null; loadActivity(true); render(); };
ACTIONS["admin-f"] = (d) => { S.sel.admF = d.f; render(); };
ACTIONS["admin-r"] = (d) => { S.sel.admR = d.r; render(); };
document.addEventListener("change", async (e) => {
  const el = e.target; if (!el.dataset || el.dataset.change !== "plat-plan" || !el.value) return;
  const v = el.value; const args = v === "m1" ? ["active", 1, null] : v === "m12" ? ["active", 12, null] : v === "t14" ? ["trial", null, 14] : [v, null, null];
  const ok = await act(() => rpc("acad_platform_set_plan", { a: el.dataset.a, p_plan: args[0], p_months: args[1], p_trial_days: args[2] }), "Plan updated");
  if (ok) { if (el.dataset.a === S.academy.id) { const me = (await rpc("acad_whoami", {}).catch(() => []))[0]; if (me) S.academy = { ...S.academy, ...me }; } loadActivity(true); }
}, true);
