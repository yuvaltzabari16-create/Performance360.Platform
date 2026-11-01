/* ================= standalone platform: Supabase, no Claude ================= */
const APPCFG = window.P360_CONFIG || {};
let SB = null;
const AUTH = { step: "role", role: null, email: "", user: null, academies: [], busy: false, error: "", note: "", resendAt: 0 };
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

/* ---------- boot and sign-in ---------- */
const tileOf = (r) => (r === "owner" ? "owner" : r);
boot = async function () {
  try { applyTheme(localPref("theme") || "system"); applyLang(); } catch {}
  window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (v === "terms" || v === "privacy") { S.legal = v; render(); return; } if (S.phase === "ready" && v && v !== S.view) go(v, false); });
  const h = location.hash.slice(1); if (h === "terms" || h === "privacy") S.legal = h;
  if (!window.supabase || !APPCFG.url || !APPCFG.key) { S.phase = "noconfig"; return render(); }
  SB = window.supabase.createClient(APPCFG.url, APPCFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "p360-academy-auth" } });
  SB.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") setTimeout(() => location.reload(), 0); });
  S.phase = "auth"; AUTH.busy = true; render();
  const { data } = await SB.auth.getSession().catch(() => ({ data: {} }));
  AUTH.busy = false;
  if (!data || !data.session) { AUTH.step = "role"; return render(); }
  AUTH.user = data.session.user; AUTH.role = localPref("role"); await afterSignIn();
};
async function afterSignIn(preferId) {
  S.phase = "auth"; AUTH.busy = true; AUTH.error = ""; render();
  let list;
  try { list = (await rpc("acad_my_academies", {})) || []; } catch (e) { AUTH.busy = false; AUTH.error = authError(e); AUTH.step = "role"; return render(); }
  AUTH.busy = false; AUTH.academies = list;
  const want = AUTH.role;
  if (!want) { if (list.length === 1) return enterAcademy(list[0]); AUTH.step = list.length ? "pick" : "role"; return render(); }
  const mine = list.filter((a) => tileOf(a.role) === want);
  const saved = preferId || localPref("academy");
  const pick = mine.find((a) => a.id === saved) || (mine.length === 1 ? mine[0] : null);
  if (pick) return enterAcademy(pick);
  AUTH.step = mine.length > 1 ? "pick" : want === "owner" ? "create" : "join";
  render();
}
async function enterAcademy(a) {
  setLocalPref("academy", a.id); setLocalPref("role", tileOf(a.role));
  S.academy = a; S.uid = AUTH.user.id; S.isOwner = a.role === "owner"; S.isAdmin = a.role !== "athlete";
  S.viewerName = a.display_name || ""; S.signedIn = true; S.downloads = DOWNLOADS; S.sample = null;
  const names = {}; try { (await rpc("acad_member_names", { a: a.id }) || []).forEach((m) => { names[m.user_id] = m.display_name; }); } catch {}
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
  return S.athletes[S.uid] ? "athlete" : "athlete-new";
};
needsLogin = () => S.role === "athlete-new";
loginScreen = () => `<h3 style="font-size:20px">Create your athlete profile</h3><p class="muted">You joined <b>${esc(S.academy?.name || "")}</b>. One more step so your coaches can plan your training.</p>${athleteOnboarding()}`;
signedInAs = () => `<div class="notice good row" style="gap:8px">${icon("shield")}<span>Signed in as</span><b translate="no">${esc(AUTH.user?.email || "")}</b></div>`;
function authError(e) {
  const m = String((e && e.message) || "");
  if (/too_many_attempts/.test(m)) return "Too many wrong codes. Wait 15 minutes and try again.";
  if (/academy_inactive/.test(m)) return "This academy's subscription isn't active. Ask the academy owner.";
  if (/already_member_(\w+)/.test(m)) return `This email is already registered at this academy as ${roleName(tileOf(m.match(/already_member_(\w+)/)[1]))}. Choose that sign-in instead.`;
  if (/too_many_academies/.test(m)) return "One account can open up to 3 academies.";
  if (/rate limit|too many/i.test(m)) return "Too many emails were sent. Wait a few minutes and try again.";
  if (/expired|invalid/i.test(m) && /otp|token/i.test(m)) return "That code is wrong or has expired. Check the latest email or send a new code.";
  if (/network|fetch/i.test(m)) return "Can't reach the server. Check your connection and try again.";
  return m || "Something went wrong.";
}

/* ---------- sign-in screens ---------- */
function authPage() {
  const tile = (k, l, ic, sub) => `<button class="logintile" role="radio" aria-checked="${AUTH.role === k}" data-act="auth-role" data-k="${k}">${icon(ic)}<span><b>${l}</b><small>${sub}</small></span></button>`;
  let body = "";
  if (AUTH.busy && !AUTH.step) body = `<div class="row"><span class="spinner"></span>Loading…</div>`;
  else if (AUTH.step === "role") body = `<h3 style="font-size:20px">Sign in</h3><p class="muted">Choose how you use the academy.</p>
    <div class="logins" role="radiogroup" aria-label="Sign in as">${LOGINS.map(([k, l, ic, sub]) => tile(k, l, ic, sub)).join("")}</div>
    ${AUTH.user ? `<p class="small muted">Signed in as <b translate="no">${esc(AUTH.user.email || "")}</b>.</p>` : ""}`;
  else if (AUTH.step === "email") body = `${back()}<h3 style="font-size:20px">${esc(roleName(AUTH.role))}</h3><p class="muted">Enter your email. We'll send you a one-time sign-in code. No password needed.</p>
    <form class="stack" data-form="auth-email"><label class="f">Email<input id="au_email" name="email" type="email" required autocomplete="email" inputmode="email" maxlength="120" value="${esc(AUTH.email)}" translate="no"></label>
    <button class="btn primary"${AUTH.busy ? " disabled" : ""}>${AUTH.busy ? '<span class="spinner"></span>' : ""}Send me a code</button></form>`;
  else if (AUTH.step === "code") body = `${back("email")}<h3 style="font-size:20px">Check your email</h3><p class="muted">We sent a sign-in code to <b translate="no">${esc(AUTH.email)}</b>. It works once and expires soon.</p>
    <form class="stack" data-form="auth-code"><label class="f">Sign-in code<input id="au_code" name="code" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,12}" maxlength="12" style="font-size:24px;letter-spacing:.3em;text-align:center" translate="no"></label>
    <button class="btn primary"${AUTH.busy ? " disabled" : ""}>${AUTH.busy ? '<span class="spinner"></span>' : ""}Sign in</button></form>
    <div class="row small"><button class="btn sm ghost" data-act="auth-resend"${Date.now() < AUTH.resendAt ? " disabled" : ""}>Send a new code</button><button class="btn sm ghost" data-act="auth-step" data-s="email">Use a different email</button></div>`;
  else if (AUTH.step === "create") body = `${back()}<h3 style="font-size:20px">Open your academy</h3>${signedInAs()}<p class="muted">Start a 30-day free trial. You'll get sign-in codes for your coaches, physiotherapists and athletes.</p>
    <form class="form" data-form="auth-create"><label class="f full">Academy name<input id="ac_name" name="name" required minlength="2" maxlength="80"></label>
    <label class="f">Your name<input id="ac_me" name="me" required maxlength="80"></label><label class="f">Main sport<input id="ac_sport" name="sport" maxlength="40"></label>
    <label class="check full"><input type="checkbox" id="ac_ok" name="agree" required> <span>I agree to the <a href="#terms">Terms of Service</a> and the <a href="#privacy">Privacy Policy</a>, and I'm responsible for getting consent from athletes and, for minors, their parents.</span></label>
    <div class="formactions"><button class="btn primary"${AUTH.busy ? " disabled" : ""}>Open my academy</button></div></form>`;
  else if (AUTH.step === "join") {
    const other = AUTH.academies.filter((a) => tileOf(a.role) !== AUTH.role);
    const staff = AUTH.role === "coach" || AUTH.role === "physio";
    body = `${back()}<h3 style="font-size:20px">${esc(roleName(AUTH.role))}</h3>${signedInAs()}
    ${other.length ? `<div class="notice warn stack" style="gap:6px"><span>This email is registered as ${other.map((a) => `<b>${esc(roleName(tileOf(a.role)))}</b> at <b translate="no">${esc(a.name)}</b>`).join(", ")}.</span><div><button class="btn sm" data-act="auth-continue" data-id="${esc(other[0].id)}">Continue as ${esc(roleName(tileOf(other[0].role)))}</button></div></div>` : ""}
    <p class="muted">First time here? Enter the ${AUTH.role === "athlete" ? "athlete code from your coach" : AUTH.role === "physio" ? "physiotherapist code from the academy owner" : "coach code from the academy owner"}.</p>
    <form class="form" data-form="auth-join"><label class="f full">${AUTH.role === "athlete" ? "Academy code" : AUTH.role === "physio" ? "Physiotherapist code" : "Coach code"}<input id="aj2_code" name="code" required maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. K7M2QXPA9R" style="font-size:18px;letter-spacing:.15em;text-transform:uppercase" translate="no"></label>
    <label class="f full">Full name<input id="aj2_name" name="name" required maxlength="80"></label>
    ${staff ? `<label class="check full"><input type="checkbox" id="aj2_ok" name="agree" required> <span>I will keep athlete records confidential, use them only for coaching and care, and not copy them outside the academy.</span></label>`
      : `<label class="check full"><input type="checkbox" id="aj2_ok" name="agree" required> <span>I agree to the <a href="#terms">Terms of Service</a> and the <a href="#privacy">Privacy Policy</a>.</span></label>`}
    <div class="formactions"><button class="btn primary"${AUTH.busy ? " disabled" : ""}>Join the academy</button></div></form>`;
  } else if (AUTH.step === "pick") {
    const mine = AUTH.role ? AUTH.academies.filter((a) => tileOf(a.role) === AUTH.role) : AUTH.academies;
    body = `${back()}<h3 style="font-size:20px">Choose an academy</h3><div class="list">${mine.map((a) => `<button class="li clickable" style="border:0;background:none;text-align:start;width:100%" data-act="auth-continue" data-id="${esc(a.id)}"><span class="av sm">${esc(initials(a.name))}</span><span class="grow"><b translate="no">${esc(a.name)}</b><span class="small muted" style="display:block">${esc(roleName(tileOf(a.role)))}</span></span>${icon(RTL() ? "left" : "right")}</button>`).join("")}</div>`;
  }
  const err = AUTH.error ? `<p class="notice bad" role="alert">${esc(AUTH.error)}</p>` : AUTH.note ? `<p class="notice good">${esc(AUTH.note)}</p>` : "";
  const brand = esc(APPCFG.productName || "Performance360 Academy");
  return `<div class="landing">
    <section class="pitch"><div class="row" style="flex-wrap:nowrap">${LOGO.replace('class="logo"', 'class="logo" style="width:52px;height:52px"')}<div><div class="pitch-brand" translate="no">Performance<b>360</b> Academy</div></div></div>
      <h1 class="pitch-h">Run your whole sports academy in one place.</h1>
      <ul class="pitch-list"><li>${icon("cal")}<span>Training calendar, workout planner and a 348-exercise video library</span></li><li>${icon("gauge")}<span>Testing, leaderboards, training load and progress for every athlete</span></li><li>${icon("leaf")}<span>Nutrition logs with meal photos and coach feedback</span></li><li>${icon("card")}<span>Payments tracking that only the owner can see</span></li><li>${icon("shield")}<span>Separate sign-ins for owner, coaches, physiotherapists and athletes; each athlete sees only their own data</span></li></ul>
      <p class="pitch-trial">${icon("check")}<span>30-day free trial for new academies. No card needed.</span></p></section>
    <section class="card authcard"><div class="row" style="justify-content:flex-end;gap:6px">${toolBtns()}</div>${err}${body}
      <div class="legal-links small"><a href="#terms">Terms of Service</a> · <a href="#privacy">Privacy Policy</a>${AUTH.user ? ` · <button class="linkbtn" data-act="sign-out">Sign out</button>` : ""}</div></section>
  </div>${S.legal ? legalModal() : ""}`;
  function back(step) { return `<button class="btn sm ghost" data-act="auth-step" data-s="${step || "role"}" style="align-self:flex-start">${icon(RTL() ? "right" : "left")}Back</button>`; }
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

/* ---------- sign-in codes (from the server) ---------- */
joinCodeCard = function () {
  const own = S.role === "owner";
  if (!S.codes && !S.codesLoading) {
    S.codesLoading = true;
    rpc("acad_codes_list", { a: S.academy.id }).then((rows) => { S.codes = Object.fromEntries((rows || []).map((r) => [r.role, r.code])); }, () => { S.codes = {}; }).finally(() => { S.codesLoading = false; schedule(); });
  }
  const rows = [["athlete", "Athletes"], ["coach", "Coaches"], ["physio", "Physiotherapists"]].filter(([k]) => own || k === "athlete");
  return `<div class="card"><div class="hd"><h2>Sign-in codes</h2></div>
    <p class="muted">Give each person the code for their role. They choose that role on the sign-in screen, sign in with their email and enter the code once. Create a new code if one reaches the wrong person; the old one stops working at once.</p>
    ${!S.codes ? `<div class="row" style="margin-top:8px"><span class="spinner"></span></div>` : `<div class="list" style="margin-top:8px">${rows.map(([k, label]) => { const code = S.codes[k]; return `<div class="li" style="flex-wrap:wrap"><div class="grow" style="min-width:140px"><div class="t">${label}</div><span class="pill ${code ? "good" : "warn"}">${code ? "On" : "Off"}</span></div>
      ${code ? `<code translate="no" class="codebox">${esc(code)}</code><button class="btn sm" data-act="copy-code" data-k="${k}">Copy</button>` : ""}
      ${own ? `<button class="btn sm${code ? "" : " primary"}" data-act="code-new" data-k="${k}">${icon("key")}${code ? "New code" : "Turn on"}</button>${code ? armBtn("code-off-" + k, "Turn off", "code-off", `data-k="${k}"`) : ""}` : ""}</div>`; }).join("")}</div>`}
    ${APPCFG.siteUrl ? `<p class="small muted" style="margin-top:8px">App address: <b translate="no">${esc(APPCFG.siteUrl)}</b></p>` : ""}</div>`;
};
ACTIONS["code-new"] = async (d) => { await act(async () => { const c = await rpc("acad_rotate_code", { a: S.academy.id, r: d.k }); S.codes = { ...(S.codes || {}), [d.k]: c }; }, "New code created. The old one no longer works."); render(); };
ACTIONS["code-off"] = async (d) => { await act(async () => { await rpc("acad_disable_code", { a: S.academy.id, r: d.k }); const c = { ...(S.codes || {}) }; delete c[d.k]; S.codes = c; }, "Code turned off"); render(); };
ACTIONS["copy-code"] = (d) => { const c = (S.codes || {})[d.k] || ""; try { navigator.clipboard.writeText(c).then(() => toast("Code copied"), () => toast("Select the code and copy it.", true)); } catch { toast("Select the code and copy it.", true); } };
ACTIONS["sign-out"] = async () => { try { await SB.auth.signOut(); } catch {} location.reload(); };

/* ---------- sign-in actions ---------- */
ACTIONS["auth-role"] = (d) => { AUTH.role = d.k; AUTH.error = ""; AUTH.note = ""; if (AUTH.user) { setLocalPref("role", d.k); afterSignIn(); } else { AUTH.step = "email"; render(); } };
ACTIONS["auth-step"] = (d) => { AUTH.step = d.s; AUTH.error = ""; AUTH.note = ""; S.dirty.clear(); render(); };
ACTIONS["auth-continue"] = (d) => { const a = AUTH.academies.find((x) => x.id === d.id); if (a) enterAcademy(a); };
ACTIONS["auth-resend"] = async () => { await sendCode(AUTH.email); };
ACTIONS["legal-close"] = () => { S.legal = null; if (location.hash === "#terms" || location.hash === "#privacy") { try { history.replaceState(null, "", location.pathname + location.search + (S.phase === "ready" ? "#" + S.view : "")); } catch {} } render(); };
async function sendCode(email) {
  AUTH.busy = true; AUTH.error = ""; render();
  const { error } = await SB.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { otp_signup: true, locale: LANG } } });
  AUTH.busy = false;
  if (error) { AUTH.error = authError(error); render(); return false; }
  AUTH.email = email; AUTH.step = "code"; AUTH.note = ""; AUTH.resendAt = Date.now() + 60000; setTimeout(schedule, 60500); render(); return true;
}
FORMS["auth-email"] = async (fd) => { const email = String(fd.get("email") || "").trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { AUTH.error = "Enter a valid email address."; render(); return false; } return sendCode(email); };
FORMS["auth-code"] = async (fd) => {
  const token = String(fd.get("code") || "").replace(/\D/g, "");
  if (token.length < 6) { AUTH.error = "Enter the code from the email."; render(); return false; }
  AUTH.busy = true; AUTH.error = ""; render();
  const { data, error } = await SB.auth.verifyOtp({ email: AUTH.email, token, type: "email" });
  AUTH.busy = false;
  if (error || !data || !data.user) { AUTH.error = authError(error || { message: "invalid otp" }); render(); return false; }
  AUTH.user = data.user; AUTH.fresh = true; setLocalPref("role", AUTH.role); await afterSignIn(); return true;
};
FORMS["auth-create"] = async (fd) => {
  if (!fd.get("agree")) return false;
  AUTH.busy = true; render();
  try { const id = await rpc("acad_create_academy", { p_name: String(fd.get("name") || "").trim(), p_display: String(fd.get("me") || "").trim(), p_sport: String(fd.get("sport") || "").trim() }); AUTH.busy = false; await afterSignIn(id); return true; }
  catch (e) { AUTH.busy = false; AUTH.error = authError(e); render(); return false; }
};
FORMS["auth-join"] = async (fd) => {
  if (!fd.get("agree")) return false;
  AUTH.busy = true; AUTH.error = ""; render();
  try {
    const rows = await rpc("acad_join", { p_code: String(fd.get("code") || ""), p_display: String(fd.get("name") || "").trim() });
    AUTH.busy = false;
    if (!rows || !rows.length) { AUTH.error = AUTH.role === "athlete" ? "That academy code isn't right. Ask your coach for the current code." : "That staff code isn't right. Ask the academy owner for the current code."; render(); return false; }
    if (tileOf(rows[0].role) !== AUTH.role) { AUTH.role = tileOf(rows[0].role); setLocalPref("role", AUTH.role); toast(`That code is for the ${roleName(AUTH.role)} role, so you joined as ${roleName(AUTH.role)}.`); }
    await afterSignIn(rows[0].academy_id); return true;
  } catch (e) { AUTH.busy = false; AUTH.error = authError(e); render(); return false; }
};

/* ---------- terms and privacy ---------- */
function legalModal() {
  const he = LANG === "he"; const v = S.legal === "privacy" ? (he ? LEGAL_HE.privacy : LEGAL_EN.privacy) : (he ? LEGAL_HE.terms : LEGAL_EN.terms);
  const vendor = esc(APPCFG.vendorName || "Performance360"); const contact = APPCFG.supportEmail ? esc(APPCFG.supportEmail) : (he ? "דרך פרטי הקשר באתר" : "through the contact details on this site");
  return `<div class="modal" role="dialog" aria-modal="true" translate="no"><div class="box legal">${`<div class="hd"><h2>${v.title}</h2><button class="iconbtn" data-act="legal-close" aria-label="${he ? "סגירה" : "Close"}">${icon("x")}</button></div>`}
    <p class="small muted">${he ? "עודכן" : "Updated"}: ${esc(LEGAL_DATE)}</p>${v.body.replace(/\{vendor\}/g, vendor).replace(/\{contact\}/g, contact)}</div></div>`;
}
