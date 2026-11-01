/* ---------- sign-in: athlete, owner + coach, coach, physiotherapist ---------- */
const LOGINS = [
  ["athlete", "Athlete", "users", "Training plan, workouts, meals and messages"],
  ["owner", "Owner + Coach", "shield", "The whole academy, including payments"],
  ["coach", "Coach", "badge", "Athletes, plans, testing and nutrition"],
  ["physio", "Physiotherapist", "plus", "Athlete care, notes and rehab plans"],
];
const SESSION_KEY = "p360.session";
function readSession() {
  for (const st of [() => localStorage, () => sessionStorage]) {
    try { const v = JSON.parse(st().getItem(SESSION_KEY) || "null"); if (v && v.uid === S.uid) return v; } catch {}
  }
  return null;
}
function writeSession(role, keep) {
  const v = JSON.stringify({ uid: S.uid, role, at: nowIso() });
  try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch {}
  try { (keep ? localStorage : sessionStorage).setItem(SESSION_KEY, v); } catch {}
  S.signedIn = true;
}
function clearSession() { try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch {} S.signedIn = false; S.loginTile = null; }
function accountTile() { return S.role === "owner" ? "owner" : S.role === "coach" || S.role === "physio" ? S.role : S.role === "athlete" ? "athlete" : null; }
function needsLogin() { return !S.signedIn || ["staff-new", "athlete-new"].includes(S.role); }

/* which code protects a role; the athlete code also reads the older single-code fields */
function codeConf(kind) {
  const s = S.settings || {}; const c = s.codes && s.codes[kind];
  if (c && c.hash) return c;
  if (kind === "athlete" && s.joinHash) return { hash: s.joinHash, salt: s.joinSalt };
  return null;
}
async function verifyCode(kind, entered) {
  const conf = codeConf(kind); if (!conf) return true;
  if (Date.now() < codeLockUntil) { toast("Too many wrong codes. Wait a minute and try again.", true); return false; }
  const h = await hashCode(entered, conf.salt).catch(() => null);
  if (h === conf.hash) { codeFails = 0; return true; }
  codeFails++; if (codeFails >= 5) { codeLockUntil = Date.now() + 60000; codeFails = 0; }
  toast(kind === "athlete" ? "That academy code isn't right. Ask your coach for the current code." : "That staff code isn't right. Ask the academy owner for the current code.", true);
  return false;
}
const codeField = (id, label) => `<label class="f full">${label}<input id="${id}" name="code" required maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. K7M2QXPA" style="font-size:18px;letter-spacing:.15em;text-transform:uppercase" translate="no"></label>`;

function loginScreen() {
  const tile = S.loginTile || accountTile();
  return `<h3 style="font-size:20px">Sign in</h3>${signedInAs()}
  <p class="muted">Choose how you use the academy.</p>
  <div class="logins" role="radiogroup" aria-label="Sign in as">${LOGINS.map(([k, l, ic, sub]) => `<button class="logintile" role="radio" aria-checked="${tile === k}" data-act="login-tile" data-k="${k}">${icon(ic)}<span><b>${l}</b><small>${sub}</small></span></button>`).join("")}</div>
  ${tile ? `<div class="loginpanel">${loginPanel(tile)}</div>` : ""}`;
}
function roleName(k) { return { athlete: "Athlete", owner: "Owner + Coach", coach: "Coach", physio: "Physiotherapist" }[k]; }
function enterBox(k) {
  return `<div class="stack"><p>Welcome back, <b translate="no">${esc(nameOf(S.uid))}</b>.</p>
    <label class="check"><input type="checkbox" id="login_keep" checked> <span>Keep me signed in on this device</span></label>
    <div><button class="btn primary" data-act="login-enter" data-k="${k}">Continue as ${esc(roleName(k))}</button></div></div>`;
}
function loginPanel(k) {
  const r = S.role;
  if (k === "owner") {
    if (S.isOwner) return enterBox("owner");
    return `<p class="notice warn">Only the academy owner can sign in here. ${S.isAdmin ? "Sign in as Coach or Physiotherapist." : "Sign in as Athlete."}</p>`;
  }
  if (k === "coach" || k === "physio") {
    if (S.isOwner) return `<p class="notice">You're the academy owner. Sign in with Owner + Coach.</p>`;
    if (!S.isAdmin) return `<p class="notice warn">This Claude account has athlete access. To sign in as staff, ask the academy owner to share the app with you as Editor, then reload.</p>`;
    if (r === "coach" || r === "physio") return r === k ? enterBox(k) : `<p class="notice warn">This account is registered as ${esc(roleName(r))}. Sign in as ${esc(roleName(r))}, or ask the academy owner to change your role.</p>`;
    return staffOnboarding(k);
  }
  if (S.isAdmin) return `<p class="notice warn">This Claude account has staff access. Sign in as ${S.isOwner ? "Owner + Coach" : r === "physio" ? "Physiotherapist" : "Coach or Physiotherapist"}.</p>`;
  if (r === "athlete") return enterBox("athlete");
  return S.readOnly ? viewOnlyGate() : athleteOnboarding();
}
staffOnboarding = function (k) {
  const conf = codeConf(k);
  return `<p>First time here? Set up your ${k === "physio" ? "physiotherapist" : "coach"} profile for <b>${esc(settings().name)}</b>.</p>
  <form class="form" data-form="staff-join" data-role="${k}">
    ${conf ? codeField("sj_code", k === "physio" ? "Physiotherapist code" : "Coach code") : ""}
    <label class="f full">Full name<input id="sj_name" name="name" required maxlength="80" value="${esc(S.viewerName)}"></label>
    <label class="f">Title (optional)<input id="sj_title" name="title" maxlength="60" placeholder="${k === "physio" ? "e.g. Sports physiotherapist" : "e.g. Strength & conditioning"}"></label>
    <label class="f">Phone (optional, visible to staff)<input id="sj_phone" name="phone" maxlength="30" inputmode="tel"></label>
    <label class="check full"><input type="checkbox" id="sj_ok" name="agree" required> <span>I will keep athlete records confidential, use them only for coaching and care, and not copy them outside the academy.</span></label>
    <div class="formactions"><button class="btn primary">${k === "physio" ? "Sign in as Physiotherapist" : "Sign in as Coach"}</button></div>
  </form>`;
};
athleteOnboarding = function () {
  const needCode = !!codeConf("athlete");
  return `<p>First time here? ${needCode ? "Enter the academy code from your coach, then create your profile." : "Create your athlete profile so your coaches can plan your training."}</p>
  <form class="form" data-form="athlete-join">
    ${needCode ? codeField("aj_code", "Academy code") : ""}
    <label class="f full">Full name<input id="aj_name" name="name" required maxlength="80" value="${esc(S.viewerName)}"></label>
    <label class="f">Sport<input id="aj_sport" name="sport" maxlength="40" value="${esc(settings().sport)}"></label>
    <label class="f">Position / event<input id="aj_pos" name="position" maxlength="40"></label>
    <label class="f">Date of birth<input id="aj_dob" name="dob" type="date" required max="${today()}"></label>
    <label class="f">Phone<input id="aj_phone" name="phone" maxlength="30" inputmode="tel"></label>
    <label class="f full">Parent or guardian (required under 18)<input id="aj_guardian" name="guardian" maxlength="80" placeholder="Name and phone"></label>
    <label class="f full">Emergency contact<input id="aj_emerg" name="emergency" maxlength="100" placeholder="Name, relationship and phone"></label>
    <label class="f full">Medical notes, allergies or injuries (visible to staff only)<textarea id="aj_med" name="medical" maxlength="800"></textarea></label>
    <label class="check full"><input type="checkbox" id="aj_ok" name="consent" required> <span>I agree that the academy's coaches and physiotherapists can see my profile, training, test results, meals and messages to coach and care for me. Other athletes can't see any of it. I can download or delete my data in Settings at any time.</span></label>
    <label class="check full"><input type="checkbox" id="aj_minor" name="minor"> <span>I'm under 18 and my parent or guardian has agreed to this.</span></label>
    <div class="formactions"><button class="btn primary">Create my profile</button></div>
  </form>`;
};
viewOnlyGate = function () {
  return `<h3>View-only access</h3><p class="muted">You can open this app but not save anything yet. Ask the academy owner to share it with you as <b>Contributor</b> (athletes) or <b>Editor</b> (coaches and physiotherapists), then reload.</p>`;
};

/* ---------- sign-in codes card (Settings → Access & roles) ---------- */
joinCodeCard = function () {
  const own = S.role === "owner";
  const rows = [["athlete", "Athletes", S.joincode?.code], ["coach", "Coaches", S.ownercodes?.coach], ["physio", "Physiotherapists", S.ownercodes?.physio]].filter(([k]) => own || k === "athlete");
  return `<div class="card"><div class="hd"><h2>Sign-in codes</h2></div>
    <p class="muted">People enter their role's code the first time they sign in. Each code only works together with an invite in the Share menu: athletes as Contributor, coaches and physiotherapists as Editor. Create a new code if one leaks; the old one stops working.</p>
    <div class="list" style="margin-top:8px">${rows.map(([k, label, code]) => { const on = !!codeConf(k); return `<div class="li" style="flex-wrap:wrap"><div class="grow" style="min-width:140px"><div class="t">${label}</div><span class="pill ${on ? "good" : "warn"}">${on ? "On" : "Off"}</span></div>
      ${on && code ? `<code translate="no" class="codebox">${esc(code)}</code><button class="btn sm" data-act="copy-code" data-k="${k}">Copy</button>` : on ? `<span class="small muted">Code hidden</span>` : ""}
      ${own ? `<button class="btn sm${on ? "" : " primary"}" data-act="code-new" data-k="${k}">${icon("key")}${on ? "New code" : "Turn on"}</button>${on ? armBtn("code-off-" + k, "Turn off", "code-off", `data-k="${k}"`) : ""}` : ""}</div>`; }).join("")}</div>
    ${!own ? `<p class="small faint" style="margin-top:8px">Only the owner can create or turn off codes.</p>` : ""}</div>`;
};
ACTIONS["code-new"] = async (d) => {
  const k = d.k; const code = randomCode(8); const salt = randomCode(16);
  const hash = await hashCode(code, salt).catch(() => null); if (!hash) return toast("This browser can't create a secure code.", true);
  await act(async () => {
    if (k === "athlete") await S.db.doc("staffonly/joincode").set({ code, at: nowIso(), by: S.uid });
    else await upsert("ownerprivate/codes", { [k]: code, at: nowIso() });
    await upsert("academy/settings", { codes: { [k]: { hash, salt } }, ...(k === "athlete" ? { joinHash: "", joinSalt: "" } : {}) });
  }, "New code created. The old one no longer works.");
};
ACTIONS["code-off"] = (d) => act(async () => {
  await upsert("academy/settings", { codes: { [d.k]: { hash: "", salt: "" } }, ...(d.k === "athlete" ? { joinHash: "", joinSalt: "" } : {}) });
  if (d.k === "athlete") await S.db.doc("staffonly/joincode").delete(); else await upsert("ownerprivate/codes", { [d.k]: "" });
}, "Code turned off");
ACTIONS["copy-code"] = (d) => {
  const c = d.k === "athlete" ? S.joincode?.code : S.ownercodes?.[d.k];
  try { navigator.clipboard.writeText(c || "").then(() => toast("Code copied"), () => toast("Select the code and copy it.", true)); } catch { toast("Select the code and copy it.", true); }
};
ACTIONS["login-tile"] = (d) => { S.loginTile = d.k; S.dirty.clear(); render(); };
ACTIONS["login-enter"] = (d) => { const keep = document.getElementById("login_keep")?.checked !== false; writeSession(d.k, keep); S.loginTile = null; go(S.prefs.startView && S.prefs.startView !== "config" ? S.prefs.startView : "dashboard"); };
ACTIONS["sign-out"] = () => { clearSession(); S.modal = null; S.navOpen = false; render(); window.scrollTo(0, 0); };
