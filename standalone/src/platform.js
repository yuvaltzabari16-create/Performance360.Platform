/* ================= standalone platform: Supabase ================= */
const APPCFG = window.P360_CONFIG || {};
let SB = null;
const AUTH = { step: "code", user: null, join: null, newCode: "", busy: false, error: "", fresh: false };
const isLazy = (coll) => coll.startsWith("meals/");
const parentOf = (p) => p.slice(0, p.lastIndexOf("/"));
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

function mapErr(e) {
  if (!e) return { code: "unavailable", message: "Unknown error" };
  if (e.code && /^[a-z_]+$/.test(e.code)) return e;
  const c = String(e.code || ""); const msg = e.message || String(e);
  if (["42501", "P0002", "23514", "22023", "23505", "22P02", "PGRST116"].includes(c) || /row-level security|permission denied/i.test(msg)) return { code: "invalid_argument", message: msg };
  if (c === "P0001") return { code: "rejected", message: msg };
  return { code: "unavailable", message: msg };
}
async function rpc(name, args) {
  const { data, error } = await SB.rpc(name, args);
  if (error) throw mapErr(error);
  return data;
}
function mergeLocal(a, b) {
  const r = a && typeof a === "object" ? a : {};
  for (const [k, v] of Object.entries(b || {})) {
    if (v === null) delete r[k];
    else if (v && typeof v === "object" && !Array.isArray(v)) r[k] = mergeLocal(r[k] && typeof r[k] === "object" && !Array.isArray(r[k]) ? r[k] : {}, v);
    else r[k] = v;
  }
  return r;
}

/* ---------- document store with the same shape the app already uses ---------- */
function makeDb(A) {
  const cache = new Map(); const docL = new Map(); const queries = new Set(); const lazy = new Map();
  let ready = false; let failed = null; const waiters = [];
  const snap = (p) => ({ id: p.split("/").pop(), exists: cache.has(p), data: () => clone(cache.get(p)), metadata: { fromCache: false, hasPendingWrites: false } });
  const run = (q) => {
    let docs = [...cache.keys()].filter((p) => parentOf(p) === q.path).map(snap);
    if (q.ob) { const [f, dir] = q.ob; docs.sort((a, b) => { const x = a.data()[f] ?? "", y = b.data()[f] ?? ""; return (x < y ? -1 : x > y ? 1 : 0) * (dir === "desc" ? -1 : 1); }); }
    else docs.sort((a, b) => (a.id < b.id ? -1 : 1));
    if (q.lim) docs = docs.slice(0, q.lim);
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const notify = (p) => { (docL.get(p) || []).forEach((fn) => fn()); const par = parentOf(p); queries.forEach((q) => { if (q.path === par) q.fire(); }); };
  const notifyAll = () => { docL.forEach((s) => s.forEach((fn) => fn())); queries.forEach((q) => q.fire()); };
  const whenReady = (fn, err) => { if (ready) fn(); else if (failed) err && err(failed); else waiters.push([fn, err]); };
  const restore = (p, prev) => { if (prev === undefined) cache.delete(p); else cache.set(p, prev); notify(p); };

  async function fetchAll() {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await SB.from("acad_docs").select("path,data").eq("academy_id", A).not("coll", "like", "meals/%").order("path").range(from, from + 999);
      if (error) throw mapErr(error);
      rows.push(...data); if (data.length < 1000) break;
    }
    return rows;
  }
  async function fetchColl(coll, q) {
    let r = SB.from("acad_docs").select("path,data").eq("academy_id", A).eq("coll", coll);
    if (q && q.ob) r = r.order("data->>" + q.ob[0], { ascending: q.ob[1] !== "desc" });
    const { data, error } = await r.limit((q && q.lim) || 500);
    if (error) throw mapErr(error);
    return data;
  }
  async function loadLazy(coll, q) {
    const rows = await fetchColl(coll, q); const keep = new Set(rows.map((r) => r.path));
    for (const p of [...cache.keys()]) if (parentOf(p) === coll && !keep.has(p)) cache.delete(p);
    rows.forEach((r) => cache.set(r.path, r.data)); lazy.set(coll, q || {});
  }
  async function refresh() {
    const rows = await fetchAll(); const keep = new Set(rows.map((r) => r.path));
    for (const p of [...cache.keys()]) if (!isLazy(parentOf(p)) && !keep.has(p)) cache.delete(p);
    rows.forEach((r) => cache.set(r.path, r.data));
    for (const [coll, q] of lazy) await loadLazy(coll, q).catch(() => {});
    notifyAll();
  }
  async function start() {
    try { await refresh(); ready = true; waiters.splice(0).forEach(([fn]) => fn()); }
    catch (e) { failed = mapErr(e); waiters.splice(0).forEach(([, err]) => err && err(failed)); return; }
    const onRow = (pl) => {
      const r = pl.new; if (!r || !r.path || r.academy_id !== A) return;
      if (isLazy(parentOf(r.path)) && !lazy.has(parentOf(r.path))) return;
      cache.set(r.path, r.data); notify(r.path);
    };
    SB.channel("acad-" + A)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "acad_docs", filter: "academy_id=eq." + A }, onRow)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "acad_docs", filter: "academy_id=eq." + A }, onRow)
      .subscribe();
    // deletions are not streamed (they would reveal document names), so re-read on a gentle timer and on return to the tab
    let last = Date.now();
    const tick = () => { if (document.visibilityState === "visible" && Date.now() - last > 20000) { last = Date.now(); refresh().catch(() => {}); } };
    setInterval(tick, 30000); document.addEventListener("visibilitychange", tick); window.addEventListener("focus", tick);
  }
  function docRef(p) {
    return {
      id: p.split("/").pop(), path: p,
      async get() {
        const { data, error } = await SB.from("acad_docs").select("path,data").eq("academy_id", A).eq("path", p).maybeSingle();
        if (error) throw mapErr(error);
        if (data) cache.set(p, data.data); else cache.delete(p);
        return snap(p);
      },
      async set(d) {
        const prev = cache.get(p); cache.set(p, clone(d)); notify(p);
        const { error } = await SB.from("acad_docs").upsert({ academy_id: A, path: p, data: d }, { onConflict: "academy_id,path" });
        if (error) { restore(p, prev); throw mapErr(error); }
      },
      async update(patch) {
        const prev = cache.get(p);
        if (prev !== undefined) { cache.set(p, mergeLocal(clone(prev), clone(patch))); notify(p); }
        const { error } = await SB.rpc("acad_merge", { a: A, p, patch });
        if (error) { restore(p, prev); throw mapErr(error); }
      },
      async delete() {
        const prev = cache.get(p); cache.delete(p); notify(p);
        const { error } = await SB.from("acad_docs").delete().eq("academy_id", A).eq("path", p);
        if (error) { restore(p, prev); throw mapErr(error); }
      },
      onSnapshot(next, err) {
        const fn = () => next(snap(p)); let s = docL.get(p); if (!s) docL.set(p, (s = new Set()));
        s.add(fn); whenReady(fn, err); return () => s.delete(fn);
      },
      collection: (c) => coll(p + "/" + c),
    };
  }
  function coll(path, q = {}) {
    return {
      path,
      doc: (id) => docRef(path + "/" + (id || newId())),
      add: async (d) => { const r = docRef(path + "/" + newId()); await r.set(d); return r; },
      where: () => coll(path, q),
      orderBy: (f, d) => coll(path, { ...q, ob: [f, d || "asc"] }),
      limit: (n) => coll(path, { ...q, lim: n }),
      async get() { if (isLazy(path)) await loadLazy(path, q); else await new Promise((res, rej) => whenReady(res, rej)); return run({ path, ...q }); },
      onSnapshot(next, err) {
        const entry = { path, fire: () => next(run({ path, ...q })) }; queries.add(entry);
        if (isLazy(path)) loadLazy(path, q).then(entry.fire, (e) => err && err(mapErr(e))); else whenReady(entry.fire, err);
        return () => queries.delete(entry);
      },
    };
  }
  return { doc: docRef, collection: (p) => coll(p), start };
}

/* ---------- meal photos in private storage ---------- */
const photoUrls = new Map();
async function uploadMealPhoto(mid, dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${S.academy.id}/${S.uid}/${mid}.jpg`;
  const { error } = await SB.storage.from("academy-meals").upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw mapErr(error);
  return path;
}
async function removePhotos(paths) { if (paths.length) { const { error } = await SB.storage.from("academy-meals").remove(paths); if (error) console.warn(error); } }
function photoSrc(m) {
  if (m.photo) return safeImg(m.photo);
  const p = m.photoPath; if (!p) return "";
  const hit = photoUrls.get(p);
  if (hit && hit.url && hit.exp > Date.now()) return hit.url;
  if (!hit || (!hit.loading && hit.exp <= Date.now())) {
    photoUrls.set(p, { loading: true, exp: 0 });
    SB.storage.from("academy-meals").createSignedUrl(p, 3600).then(({ data }) => {
      const url = data && data.signedUrl && /^https:\/\//.test(data.signedUrl) ? data.signedUrl : "";
      photoUrls.set(p, { url, exp: Date.now() + 50 * 60000 }); schedule();
    }, () => photoUrls.set(p, { url: "", exp: Date.now() + 60000 }));
  }
  return "";
}

/* ---------- downloads in a normal browser ---------- */
const DOWNLOADS = {
  async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: filename.endsWith(".csv") ? "text/csv;charset=utf-8" : "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return { status: "saved" };
  },
};

/* ---------- boot and sign-in: one personal code ---------- */
boot = async function () {
  try { applyTheme(localPref("theme") || "system"); applyLang(); } catch {}
  window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (v === "terms" || v === "privacy") { S.legal = v; render(); return; } if (S.phase === "ready" && v && v !== S.view) go(v, false); });
  const h = location.hash.slice(1); if (h === "terms" || h === "privacy") S.legal = h;
  if (!window.supabase || !APPCFG.url || !APPCFG.key) { S.phase = "noconfig"; return render(); }
  SB = window.supabase.createClient(APPCFG.url, APPCFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "p360-academy-auth" } });
  S.phase = "auth"; AUTH.step = "code"; AUTH.busy = true; render();
  const { data } = await SB.auth.getSession().catch(() => ({ data: {} }));
  if (data && data.session) { AUTH.user = data.session.user; return afterSignIn(); }
  AUTH.busy = false; render();
};
async function ensureDevice() {
  if (AUTH.user) return true;
  const { data, error } = await SB.auth.signInAnonymously();
  if (error || !data || !data.user) { AUTH.error = /anonymous/i.test(error?.message || "") ? "Sign-in isn't switched on for this app yet. Ask the academy owner." : authError(error); return false; }
  AUTH.user = data.user; return true;
}
async function afterSignIn() {
  S.phase = "auth"; AUTH.busy = true; AUTH.error = ""; render();
  let rows = [];
  try { rows = (await rpc("acad_whoami", {})) || []; } catch (e) { AUTH.busy = false; AUTH.error = authError(e); AUTH.step = "code"; return render(); }
  AUTH.busy = false;
  if (rows.length) return enterAcademy(rows[0]);
  AUTH.step = "code"; render();
}
async function enterAcademy(a) {
  S.academy = a; S.uid = a.member_id; S.isOwner = a.role === "owner"; S.isAdmin = a.role !== "athlete";
  S.viewerName = a.display_name || ""; S.signedIn = true; S.downloads = DOWNLOADS; S.sample = null;
  const names = {}; try { (await rpc("acad_member_names", { a: a.id }) || []).forEach((m) => { names[m.member_id] = m.display_name; }); } catch {}
  S.memberNames = names;
  S.db = makeDb(a.id);
  S.user = {
    id: async () => S.uid, isOwner: async () => S.isOwner, canEdit: async () => S.isAdmin, can: async () => null,
    me: async () => ({ id: S.uid, name: S.viewerName, isOwner: S.isOwner, canEdit: S.isAdmin }),
    profiles: async (ids) => Object.fromEntries([].concat(ids).map((i) => [i, { id: i, name: S.memberNames[i] || "" }])),
  };
  const t = location.hash.slice(1);
  if (AUTH.fresh) { S.view = "dashboard"; try { history.replaceState(null, "", location.pathname + location.search + "#dashboard"); } catch {} }
  else if (t && t !== "terms" && t !== "privacy") S.view = t;
  S.phase = "loading"; render();
  setTimeout(() => { if (!S.loaded.settings) { S.slow = true; render(); } }, 10000);
  subscribeCommon(); if (S.isAdmin) subscribeStaff(); else subscribeAthlete();
  S.db.start();
}
computeRole = function () {
  if (!S.academy) return null;
  const r = S.academy.role;
  if (r === "owner") return "owner";
  if (r === "coach" || r === "physio") return S.loaded.staff ? r : null;
  if (!S.loaded.me) return null;
  return S.athletes[S.uid] && S.athletes[S.uid].consent ? "athlete" : "athlete-new";
};
needsLogin = () => S.role === "athlete-new";
loginScreen = () => `<h3 style="font-size:20px">Welcome, ${esc(firstName(S.viewerName || S.athletes[S.uid]?.name || ""))}</h3><p class="muted">You're signed in to <b translate="no">${esc(S.academy?.name || "")}</b>. Fill in your profile once so your coaches can plan your training.</p>${athleteOnboarding()}`;
signedInAs = () => "";
function authError(e) {
  const m = String((e && e.message) || "");
  if (/too_many_attempts/.test(m)) return "Too many wrong codes. Wait 15 minutes and try again.";
  if (/academy_inactive/.test(m)) return "This academy's subscription isn't active. Ask the academy owner.";
  if (/name_required/.test(m)) return "Enter your full name.";
  if (/rate limit|too many/i.test(m)) return "Too many tries from this network. Wait a few minutes and try again.";
  if (/network|fetch/i.test(m)) return "Can't reach the server. Check your connection and try again.";
  return m || "Something went wrong.";
}
const tileOf = (r) => (r === "owner" ? "owner" : r);
const fmtCode = (c) => (c && c.length === 8 ? c.slice(0, 4) + "-" + c.slice(4) : c || "");

/* ---------- sign-in screens ---------- */
function authPage() {
  let body = "";
  if (AUTH.step === "code") body = `<h3 style="font-size:22px">Sign in</h3><p class="muted">Enter your personal code.</p>
    <form class="stack" data-form="auth-code"><label class="f"><span class="sr">Your code</span><input id="au_code" name="code" required maxlength="12" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="XXXX-XXXX" aria-label="Your code" class="bigcode" translate="no"></label>
    <button class="btn primary big"${AUTH.busy ? " disabled" : ""}>${AUTH.busy ? '<span class="spinner"></span>' : ""}Enter</button></form>
    <p class="small muted">Don't have a code? Ask your coach or the academy owner.</p>
    <div class="newacad"><span>Own an academy?</span><button class="btn sm" data-act="auth-step" data-s="create">Open a new academy</button></div>`;
  else if (AUTH.step === "join") body = `${back()}<h3 style="font-size:20px">Join ${esc(AUTH.join.academy_name || "")}</h3><p class="muted">You're joining as <b>${esc(roleName(tileOf(AUTH.join.role)))}</b>. What's your name?</p>
    <form class="form" data-form="auth-join"><label class="f full">Full name<input id="aj2_name" name="name" required minlength="2" maxlength="80" autocomplete="name"></label>
    ${AUTH.join.role !== "athlete" ? `<label class="check full"><input type="checkbox" id="aj2_ok" name="agree" required> <span>I will keep athlete records confidential, use them only for coaching and care, and not copy them outside the academy.</span></label>`
      : `<label class="check full"><input type="checkbox" id="aj2_ok" name="agree" required> <span>I agree to the <a href="#terms">Terms of Service</a> and the <a href="#privacy">Privacy Policy</a>.</span></label>`}
    <div class="formactions"><button class="btn primary"${AUTH.busy ? " disabled" : ""}>Join</button></div></form>`;
  else if (AUTH.step === "create") body = `${back()}<h3 style="font-size:20px">Open your academy</h3><p class="muted">Start a 30-day free trial. You'll get your own code, and codes to give your coaches, physiotherapists and athletes.</p>
    <form class="form" data-form="auth-create"><label class="f full">Academy name<input id="ac_name" name="name" required minlength="2" maxlength="80"></label>
    <label class="f">Your name<input id="ac_me" name="me" required minlength="2" maxlength="80" autocomplete="name"></label><label class="f">Main sport<input id="ac_sport" name="sport" maxlength="40"></label>
    <label class="check full"><input type="checkbox" id="ac_ok" name="agree" required> <span>I agree to the <a href="#terms">Terms of Service</a> and the <a href="#privacy">Privacy Policy</a>, and I'm responsible for getting consent from athletes and, for minors, their parents.</span></label>
    <div class="formactions"><button class="btn primary"${AUTH.busy ? " disabled" : ""}>Open my academy</button></div></form>`;
  else if (AUTH.step === "yourcode") body = `<h3 style="font-size:20px">This is your personal code</h3>
    <div class="codeshow" translate="no">${esc(fmtCode(AUTH.newCode))}</div>
    <p class="muted">Use it to sign in on any phone or computer. Keep it private: anyone with this code can sign in as you. This phone stays signed in.</p>
    <div class="row"><button class="btn" data-act="copy-text" data-t="${esc(fmtCode(AUTH.newCode))}">Copy</button><button class="btn primary" data-act="auth-done">I saved it, continue</button></div>`;
  const err = AUTH.error ? `<p class="notice bad" role="alert">${esc(AUTH.error)}</p>` : "";
  return `<div class="landing">
    <section class="pitch"><div class="row" style="flex-wrap:nowrap">${LOGO.replace('class="logo"', 'class="logo" style="width:52px;height:52px"')}<div><div class="pitch-brand" translate="no">Performance<b>360</b> Academy</div></div></div>
      <h1 class="pitch-h">Run your whole sports academy in one place.</h1>
      <ul class="pitch-list"><li>${icon("cal")}<span>Training calendar, workout planner and a 348-exercise video library</span></li><li>${icon("gauge")}<span>Testing, leaderboards, training load and progress for every athlete</span></li><li>${icon("leaf")}<span>Nutrition logs with meal photos and coach feedback</span></li><li>${icon("card")}<span>Payments tracking that only the owner can see</span></li><li>${icon("shield")}<span>Everyone signs in with their own code; each athlete sees only their own data</span></li></ul>
      <p class="pitch-trial">${icon("check")}<span>30-day free trial for new academies. No card needed.</span></p></section>
    <section class="card authcard"><div class="row" style="justify-content:space-between;gap:6px"><span class="pitch-brand mobile-brand" translate="no">Performance<b>360</b></span>${toolBtns()}</div>${err}${body}
      <div class="legal-links small"><a href="#terms">Terms of Service</a> · <a href="#privacy">Privacy Policy</a></div></section>
  </div>${S.legal ? legalModal() : ""}`;
  function back() { return `<button class="btn sm ghost" data-act="auth-step" data-s="code" style="align-self:flex-start">${icon(RTL() ? "right" : "left")}Back</button>`; }
}

const _page = page;
page = function () {
  if (S.phase === "noconfig") return gate(`<h2>Almost ready</h2><p class="muted">This copy of the app isn't connected to its database yet. Add the Supabase address and public key in the configuration at the top of index.html.</p>`);
  if (S.phase === "auth") return authPage();
  let html = _page();
  if (S.phase === "ready" && !needsLogin()) html = html.replace('<main class="view">', '<main class="view">' + planBanner());
  return html + (S.legal ? legalModal() : "");
};
function planBanner() {
  const a = S.academy; if (!a) return "";
  if (!a.active) return `<div class="notice bad">${S.role === "owner" ? "Your academy's subscription isn't active, so records are read-only. Everything is still here and you can download it in Settings → Privacy & data." : "This academy is read-only for now. Ask the academy owner."}${S.role === "owner" && APPCFG.supportEmail ? ` <b translate="no">${esc(APPCFG.supportEmail)}</b>` : ""}</div>`;
  if (a.plan === "trial" && S.role === "owner") {
    const days = Math.max(0, Math.ceil((new Date(a.trial_ends_at).getTime() - Date.now()) / 864e5));
    if (days <= 7) return `<div class="notice warn">${days === 1 ? "Your free trial ends tomorrow." : `Your free trial ends in ${days} days.`}${APPCFG.supportEmail ? ` To subscribe, contact <b translate="no">${esc(APPCFG.supportEmail)}</b>.` : ""}</div>`;
  }
  return "";
}
const _errText = errText;
errText = function (e) { if (e && e.code === "invalid_argument" && S.academy && !S.academy.active) return "Your academy's subscription isn't active, so changes can't be saved."; if (e && e.code === "rejected") return authError(e); return _errText(e); };

/* the owner's first visit fills the exercise library */
let libSeeded = false;
const _render2 = render;
render = function () {
  _render2();
  if (S.phase === "ready" && S.isOwner && !libSeeded && S.loaded.library && !S.library.core && typeof LIB_SEED !== "undefined") {
    libSeeded = true; S.db.doc("library/core").set(LIB_SEED).catch(() => { libSeeded = false; });
  }
};

/* ---------- codes: shared join codes and personal codes ---------- */
function loadPeople(force) {
  if ((S.people && !force) || S.peopleLoading) return;
  S.peopleLoading = true;
  Promise.all([rpc("acad_people", { a: S.academy.id }), isStaff() ? rpc("acad_codes_list", { a: S.academy.id }) : Promise.resolve([])])
    .then(([people, codes]) => { S.people = people || []; S.codes = Object.fromEntries((codes || []).map((r) => [r.role, r.code])); }, () => { S.people = S.people || []; S.codes = S.codes || {}; })
    .finally(() => { S.peopleLoading = false; schedule(); });
}
const personOf = (mid) => (S.people || []).find((p) => p.member_id === mid);
function codeLine(mid) {
  loadPeople(); const p = personOf(mid);
  if (!S.people) return `<span class="spinner"></span>`;
  if (!p) return `<span class="muted small">Not available</span>`;
  return `<span class="row" style="flex-wrap:nowrap"><code translate="no" class="codebox">${esc(fmtCode(p.login_code))}</code><button class="btn sm" data-act="copy-text" data-t="${esc(fmtCode(p.login_code))}">Copy</button>${armBtn("rc-" + mid, "New code", "reset-code", `data-m="${esc(mid)}"`)}</span>`;
}
joinCodeCard = function () {
  const own = S.role === "owner"; loadPeople();
  const roles = [["athlete", "Athletes"], ["coach", "Coaches"], ["physio", "Physiotherapists"]].filter(([k]) => own || k === "athlete");
  const people = (S.people || []).filter((p) => p.member_id !== S.uid);
  return `<div class="card"><div class="hd"><h2>Your sign-in code</h2></div><p class="muted">Use it to sign in on another phone or computer. Keep it private.</p><div style="margin-top:8px">${codeLine(S.uid)}</div></div>
  <div class="card"><div class="hd"><h2>People and their codes</h2><button class="btn sm primary" data-act="add-person">${icon("plus")}Add a person</button></div>
    <p class="muted">Each person signs in with their own code. Send it to them privately with this app's address${APPCFG.siteUrl ? `: <b translate="no">${esc(APPCFG.siteUrl)}</b>` : ""}. If a code is lost or reaches the wrong person, create a new one; the old one stops working and they're signed out everywhere.</p>
    ${!S.people ? `<div class="row" style="margin-top:8px"><span class="spinner"></span></div>` : people.length ? `<div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>Name</th><th>Role</th><th>Code</th><th>Last sign-in</th></tr></thead><tbody>${people.map((p) => `<tr><td><b translate="no">${esc(p.display_name)}</b></td><td>${esc(roleName(tileOf(p.role)))}</td><td>${codeLine(p.member_id)}</td><td class="small muted">${p.last_sign_in ? esc(ago(p.last_sign_in)) : "Not yet"}</td></tr>`).join("")}</tbody></table></div>` : `<p class="small muted" style="margin-top:8px">Nobody else yet.</p>`}</div>
  <div class="card"><div class="hd"><h2>Shared join codes</h2></div>
    <p class="muted">Optional. Instead of adding people one by one, give a group one shared code. Each person enters it once, types their name and gets their own personal code.</p>
    ${!S.codes ? "" : `<div class="list" style="margin-top:8px">${roles.map(([k, label]) => { const code = S.codes[k]; return `<div class="li" style="flex-wrap:wrap"><div class="grow" style="min-width:140px"><div class="t">${label}</div><span class="pill ${code ? "good" : "warn"}">${code ? "On" : "Off"}</span></div>
      ${code ? `<code translate="no" class="codebox">${esc(fmtCode(code))}</code><button class="btn sm" data-act="copy-text" data-t="${esc(fmtCode(code))}">Copy</button>` : ""}
      ${own ? `<button class="btn sm" data-act="code-new" data-k="${k}">${icon("key")}${code ? "New code" : "Turn on"}</button>${code ? armBtn("code-off-" + k, "Turn off", "code-off", `data-k="${k}"`) : ""}` : ""}</div>`; }).join("")}</div>`}</div>`;
};
function addPersonModal(m) {
  if (m.result) return `<div class="hd"><h2>${esc(m.result.name)} was added</h2><button class="iconbtn" data-act="modal-close" aria-label="Close">${icon("x")}</button></div>
    <p class="muted">Their personal code:</p><div class="codeshow" translate="no">${esc(fmtCode(m.result.code))}</div>
    <p class="small muted">Send it to them privately${APPCFG.siteUrl ? ` with the address <b translate="no">${esc(APPCFG.siteUrl)}</b>` : ""}. They type it once on their phone and they're in.</p>
    <div class="row"><button class="btn" data-act="copy-text" data-t="${esc(`${fmtCode(m.result.code)}${APPCFG.siteUrl ? " " + APPCFG.siteUrl : ""}`)}">Copy code and address</button><button class="btn primary" data-act="modal-close">Done</button></div>`;
  const roles = S.role === "owner" ? [["athlete", "Athlete"], ["coach", "Coach"], ["physio", "Physiotherapist"]] : [["athlete", "Athlete"]];
  return `<div class="hd"><h2>Add a person</h2><button class="iconbtn" data-act="modal-close" aria-label="Close">${icon("x")}</button></div>
  <form class="form" data-form="add-person"><label class="f full">Full name<input id="ap2_name" name="name" required minlength="2" maxlength="80"></label>
    <label class="f full">Role<select id="ap2_role" name="role">${sel(roles, m.role || "athlete")}</select></label>
    <div class="formactions"><button type="button" class="btn" data-act="modal-close">Cancel</button><button class="btn primary">Add and get code</button></div></form>`;
}
const _modalHtml = modalHtml;
modalHtml = function () { if (S.modal && S.modal.kind === "add-person") return `<div class="modal" data-act="modal-bg" role="dialog" aria-modal="true"><div class="box">${addPersonModal(S.modal)}</div></div>`; return _modalHtml(); };
ACTIONS["add-person"] = (d) => { S.modal = { kind: "add-person", role: d.role || "athlete" }; render(); };
FORMS["add-person"] = async (fd) => {
  const name = String(fd.get("name") || "").trim(); const role = String(fd.get("role") || "athlete");
  try {
    const rows = await rpc("acad_add_member", { a: S.academy.id, p_role: role, p_display: name });
    S.memberNames[rows[0].member_id] = name; S.people = null; loadPeople(true);
    S.modal = { kind: "add-person", result: { name, code: rows[0].login_code } }; render(); return true;
  } catch (e) { toast(errText(e), true); return false; }
};
ACTIONS["reset-code"] = async (d) => { await act(async () => { await rpc("acad_reset_code", { a: S.academy.id, m: d.m }); S.people = null; loadPeople(true); }, "New code created. The old one no longer works."); };
ACTIONS["code-new"] = async (d) => { await act(async () => { const c = await rpc("acad_rotate_code", { a: S.academy.id, r: d.k }); S.codes = { ...(S.codes || {}), [d.k]: c }; }, "New code created. The old one no longer works."); render(); };
ACTIONS["code-off"] = async (d) => { await act(async () => { await rpc("acad_disable_code", { a: S.academy.id, r: d.k }); const c = { ...(S.codes || {}) }; delete c[d.k]; S.codes = c; }, "Code turned off"); render(); };
ACTIONS["copy-text"] = (d) => { try { navigator.clipboard.writeText(d.t || "").then(() => toast("Copied"), () => toast("Select the code and copy it.", true)); } catch { toast("Select the code and copy it.", true); } };
ACTIONS["sign-out"] = async () => { try { await rpc("acad_sign_out", {}); } catch {} try { await SB.auth.signOut(); } catch {} location.reload(); };

/* ---------- sign-in actions ---------- */
ACTIONS["auth-step"] = (d) => { AUTH.step = d.s; AUTH.error = ""; S.dirty.clear(); render(); };
ACTIONS["auth-done"] = () => { AUTH.fresh = true; afterSignIn(); };
ACTIONS["legal-close"] = () => { S.legal = null; if (location.hash === "#terms" || location.hash === "#privacy") { try { history.replaceState(null, "", location.pathname + location.search + (S.phase === "ready" ? "#" + S.view : "")); } catch {} } render(); };
FORMS["auth-code"] = async (fd) => {
  const code = String(fd.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 8) { AUTH.error = "Codes have 8 letters and numbers. Check it and try again."; render(); return false; }
  AUTH.busy = true; AUTH.error = ""; render();
  try {
    if (!(await ensureDevice())) { AUTH.busy = false; render(); return false; }
    const rows = (await rpc("acad_enter", { p_code: code })) || [];
    AUTH.busy = false;
    if (!rows.length) { AUTH.error = "That code isn't right. Check it, or ask your coach or the academy owner."; render(); return false; }
    if (rows[0].kind === "join") { AUTH.join = { ...rows[0], code }; AUTH.step = "join"; render(); return true; }
    AUTH.fresh = true; await afterSignIn(); return true;
  } catch (e) { AUTH.busy = false; AUTH.error = authError(e); render(); return false; }
};
FORMS["auth-join"] = async (fd) => {
  if (!fd.get("agree")) return false;
  AUTH.busy = true; AUTH.error = ""; render();
  try {
    const rows = (await rpc("acad_join", { p_code: AUTH.join.code, p_display: String(fd.get("name") || "").trim() })) || [];
    AUTH.busy = false;
    if (!rows.length) { AUTH.error = "That code no longer works. Ask for the current one."; AUTH.step = "code"; render(); return false; }
    AUTH.newCode = rows[0].login_code; AUTH.step = "yourcode"; render(); return true;
  } catch (e) { AUTH.busy = false; AUTH.error = authError(e); render(); return false; }
};
FORMS["auth-create"] = async (fd) => {
  if (!fd.get("agree")) return false;
  AUTH.busy = true; AUTH.error = ""; render();
  try {
    if (!(await ensureDevice())) { AUTH.busy = false; render(); return false; }
    const rows = await rpc("acad_create_academy", { p_name: String(fd.get("name") || "").trim(), p_display: String(fd.get("me") || "").trim(), p_sport: String(fd.get("sport") || "").trim() });
    AUTH.busy = false; AUTH.newCode = rows[0].login_code; AUTH.step = "yourcode"; render(); return true;
  } catch (e) { AUTH.busy = false; AUTH.error = authError(e); render(); return false; }
};

/* ---------- terms and privacy ---------- */
function legalModal() {
  const he = LANG === "he"; const v = S.legal === "privacy" ? (he ? LEGAL_HE.privacy : LEGAL_EN.privacy) : (he ? LEGAL_HE.terms : LEGAL_EN.terms);
  const vendor = esc(APPCFG.vendorName || "Performance360"); const contact = APPCFG.supportEmail ? esc(APPCFG.supportEmail) : (he ? "דרך פרטי הקשר באתר" : "through the contact details on this site");
  return `<div class="modal" role="dialog" aria-modal="true" translate="no"><div class="box legal">${`<div class="hd"><h2>${v.title}</h2><button class="iconbtn" data-act="legal-close" aria-label="${he ? "סגירה" : "Close"}">${icon("x")}</button></div>`}
    <p class="small muted">${he ? "עודכן" : "Updated"}: ${esc(LEGAL_DATE)}</p>${v.body.replace(/\{vendor\}/g, vendor).replace(/\{contact\}/g, contact)}</div></div>`;
}

/* ---------- add people, show codes where they belong ---------- */
const _athMeta = VIEWS.athletes.meta;
VIEWS.athletes.meta = () => { const m = _athMeta(); if (!S.sel.athlete) m.actions = `<button class="btn primary" data-act="add-person" data-role="athlete">${icon("plus")}Add athlete</button>`; return m; };
const _staffMeta = VIEWS.staff.meta;
VIEWS.staff.meta = () => { const m = _staffMeta(); if (S.role === "owner") m.actions = `<button class="btn primary" data-act="add-person" data-role="coach">${icon("plus")}Add coach or physio</button>`; return m; };
const _athProfile = athProfile;
athProfile = function (u) { return `<div class="card"><div class="hd"><h2>Sign-in code</h2></div><p class="muted">This athlete signs in with this code.</p><div style="margin-top:8px">${codeLine(u)}</div></div>` + _athProfile(u); };
const _cfgProfile = CFG.profile;
CFG.profile = () => (isStaff() ? "" : `<div class="card"><div class="hd"><h2>Your sign-in code</h2></div><p class="muted">Use it to sign in on another phone or computer. Keep it private.</p><div style="margin-top:8px">${codeLine(S.uid)}</div></div>`) + _cfgProfile();
