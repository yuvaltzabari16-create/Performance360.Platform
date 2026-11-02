/* In-memory stand-in for supabase-js, for local UI tests only. Mirrors the SQL rules (personal-code sign-in). */
(function () {
  const K = "mocksb";
  const st = JSON.parse(localStorage.getItem(K) || '{"acad":[],"mem":[],"codes":[],"sess":{},"docs":{},"files":{}}');
  const save = () => localStorage.setItem(K, JSON.stringify(st));
  const sess = () => JSON.parse(localStorage.getItem(K + ".session") || "null");
  const dev = () => sess()?.user?.id || null;
  const rid = () => "m" + Math.random().toString(16).slice(2, 9) + "-0000-4000-8000-000000000000";
  const meM = (a) => { const mid = st.sess[dev()]; const m = st.mem.find((x) => x.id === mid); return m && m.a === a ? m : null; };
  const lvl = (a) => { const m = meM(a); return m ? { owner: 3, coach: 2, physio: 2, athlete: 1 }[m.r] : 0; };
  const active = (a) => { const x = st.acad.find((y) => y.id === a); return !!x && (x.plan === "active" || (x.plan === "trial" && new Date(x.trial_ends_at) > new Date())); };
  function can(a, p, w) {
    const L = lvl(a), me = meM(a)?.id, s = p.split("/"); if (!L || !me) return false; if (w && !active(a)) return false;
    let pr, pw, sr, sw;
    switch (s[0]) {
      case "academy": pr = 1; pw = 3; break; case "library": pr = 1; pw = 2; break; case "updates": pr = 1; pw = 2; break; case "staffupdates": pr = 2; pw = 2; break;
      case "staff": pr = 1; pw = 3; sr = 1; sw = 2; break;
      case "athletes": case "logs": case "meals": case "inbox": pr = 2; pw = 2; sr = 1; sw = 1; break;
      case "roster": case "plan": case "notes": case "tests": pr = 2; pw = 2; sr = 1; sw = 2; break;
      case "payments": case "ownerprivate": pr = 3; pw = 3; break;
      case "programs": case "staffroom": case "staffnotes": pr = 2; pw = 2; break;
      case "data": return s[1] === "users" && s[2] === me;
      default: pr = 2; pw = 3;
    }
    if (sr != null && s[1] === me) return L >= Math.min(w ? pw : pr, w ? sw : sr);
    return L >= (w ? pw : pr);
  }
  const key = (a, p) => a + "|" + p;
  const merge = (a, b) => { const r = a && typeof a === "object" ? a : {}; for (const [k, v] of Object.entries(b || {})) { if (v === null) delete r[k]; else if (v && typeof v === "object" && !Array.isArray(v)) r[k] = merge(r[k] && typeof r[k] === "object" ? r[k] : {}, v); else r[k] = v; } return r; };
  const code = () => { const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 8; i++) s += A[Math.floor(Math.random() * 31)]; return s; };
  const norm = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const err = (message, c) => ({ data: null, error: { message, code: c || "P0001" } });
  const ok = (data) => ({ data, error: null });
  const doc = (a, p, data) => { st.docs[key(a, p)] = { academy_id: a, path: p, data }; };

  class Q {
    constructor() { this.f = []; this.op = "select"; }
    select() { return this; } eq(c, v) { this.f.push((r) => r[c] === v); return this; }
    not(c, op, v) { const pre = v.replace("%", ""); this.f.push((r) => !String(r[c]).startsWith(pre)); return this; }
    order(c, o) { this.ord = [c, o && o.ascending === false]; return this; } range(a, b) { this.rg = [a, b]; return this; } limit(n) { this.lim = n; return this; }
    maybeSingle() { this.single = true; return this; }
    upsert(row) { this.op = "upsert"; this.row = row; return this; } delete() { this.op = "delete"; return this; }
    then(res, rej) { return Promise.resolve(this.exec()).then(res, rej); }
    exec() {
      if (this.op === "upsert") { const r = this.row; if (!can(r.academy_id, r.path, true)) return err("new row violates row-level security policy", "42501"); doc(r.academy_id, r.path, JSON.parse(JSON.stringify(r.data))); save(); return ok(null); }
      let rows = Object.values(st.docs).map((d) => ({ ...d, coll: d.path.slice(0, d.path.lastIndexOf("/")) })).filter((r) => can(r.academy_id, r.path, this.op === "delete")).filter((r) => this.f.every((fn) => fn(r)));
      if (this.op === "delete") { rows.forEach((r) => delete st.docs[key(r.academy_id, r.path)]); save(); return ok(null); }
      if (this.ord) { const [c, desc] = this.ord; const get = (r) => (c.startsWith("data->>") ? r.data[c.slice(7)] : r[c]) ?? ""; rows.sort((a, b) => (get(a) < get(b) ? -1 : get(a) > get(b) ? 1 : 0) * (desc ? -1 : 1)); }
      if (this.rg) rows = rows.slice(this.rg[0], this.rg[1] + 1); if (this.lim) rows = rows.slice(0, this.lim);
      const out = rows.map((r) => ({ path: r.path, data: JSON.parse(JSON.stringify(r.data)) }));
      return ok(this.single ? out[0] || null : out);
    }
  }
  const nameOfA = (a) => st.acad.find((x) => x.id === a)?.name;
  const RPC = {
    acad_whoami: () => { const m = st.mem.find((x) => x.id === st.sess[dev()]); if (!m) return ok([]); const x = st.acad.find((y) => y.id === m.a); return ok([{ id: x.id, name: x.name, role: m.r, member_id: m.id, display_name: m.n, plan: x.plan, trial_ends_at: x.trial_ends_at, paid_until: null, active: active(x.id) }]); },
    acad_enter: ({ p_code }) => {
      const c = norm(p_code); const m = st.mem.find((x) => x.code === c);
      if (m) { st.sess[dev()] = m.id; save(); return ok([{ kind: "member", academy_id: m.a, academy_name: nameOfA(m.a), role: m.r, member_id: m.id }]); }
      const k = st.codes.find((x) => x.c === c); if (k) return ok([{ kind: "join", academy_id: k.a, academy_name: nameOfA(k.a), role: k.r, member_id: null }]);
      return ok([]);
    },
    acad_join: ({ p_code, p_display }) => {
      const k = st.codes.find((x) => x.c === norm(p_code)); if (!k) return ok([]);
      if (!p_display || p_display.length < 2) return err("name_required", "22023");
      const m = { id: rid(), a: k.a, r: k.r, n: p_display, code: code() }; st.mem.push(m); st.sess[dev()] = m.id;
      if (k.r !== "athlete") doc(k.a, "staff/" + m.id, { name: p_display, role: k.r, joined: new Date().toISOString() });
      save(); return ok([{ academy_id: k.a, role: k.r, member_id: m.id, login_code: m.code }]);
    },
    acad_create_academy: ({ p_name, p_display, p_sport }) => {
      if (!p_name || p_name.length < 2) return err("academy name must be 2 to 80 characters", "22023");
      const id = "a" + Math.random().toString(16).slice(2, 10) + "-0000-4000-8000-000000000000";
      st.acad.push({ id, name: p_name, plan: "trial", trial_ends_at: new Date(Date.now() + 30 * 864e5).toISOString() });
      const m = { id: rid(), a: id, r: "owner", n: p_display, code: code() }; st.mem.push(m); st.sess[dev()] = m.id;
      ["athlete", "coach", "physio"].forEach((r) => st.codes.push({ a: id, r, c: code() }));
      doc(id, "academy/settings", { name: p_name, sport: p_sport || "", currency: "ILS", weekStart: "sun", groups: [], mealComments: true, retentionMonths: 24, defaultMinutes: 60 });
      doc(id, "staff/" + m.id, { name: p_display, role: "coach", owner: true, title: "Head coach", joined: new Date().toISOString() });
      save(); return ok([{ academy_id: id, member_id: m.id, login_code: m.code }]);
    },
    acad_sign_out: () => { delete st.sess[dev()]; save(); return ok(null); },
    acad_add_member: ({ a, p_role, p_display }) => {
      const L = lvl(a); if (!(L === 3 || (L === 2 && p_role === "athlete"))) return err("not allowed", "42501");
      const m = { id: rid(), a, r: p_role, n: p_display, code: code() }; st.mem.push(m);
      if (p_role === "athlete") doc(a, "athletes/" + m.id, { name: p_display, createdAt: new Date().toISOString() }); else doc(a, "staff/" + m.id, { name: p_display, role: p_role, joined: new Date().toISOString() });
      save(); return ok([{ member_id: m.id, login_code: m.code }]);
    },
    acad_people: ({ a }) => { const me = meM(a); const L = lvl(a); return ok(st.mem.filter((m) => m.a === a && (L === 3 || m.id === me?.id || (L === 2 && m.r === "athlete"))).map((m) => ({ member_id: m.id, role: m.r, display_name: m.n, login_code: m.code, joined_at: null, last_sign_in: null }))); },
    acad_member_names: ({ a }) => ok(st.mem.filter((m) => m.a === a && (lvl(a) >= 2 || m.id === meM(a)?.id || m.r !== "athlete")).map((m) => ({ member_id: m.id, role: m.r, display_name: m.n }))),
    acad_reset_code: ({ a, m }) => { const x = st.mem.find((y) => y.id === m); const L = lvl(a); if (!(L === 3 || m === meM(a)?.id || (L === 2 && x.r === "athlete"))) return err("not allowed", "42501"); x.code = code(); save(); return ok(x.code); },
    acad_codes_list: ({ a }) => ok(st.codes.filter((x) => x.a === a && (lvl(a) === 3 || (lvl(a) === 2 && x.r === "athlete"))).map((x) => ({ role: x.r, code: x.c }))),
    acad_rotate_code: ({ a, r }) => { if (lvl(a) < 3) return err("owner only", "42501"); st.codes = st.codes.filter((x) => !(x.a === a && x.r === r)); const c = code(); st.codes.push({ a, r, c }); save(); return ok(c); },
    acad_disable_code: ({ a, r }) => { if (lvl(a) < 3) return err("owner only", "42501"); st.codes = st.codes.filter((x) => !(x.a === a && x.r === r)); save(); return ok(null); },
    acad_set_display_name: ({ a, p_display }) => { const m = meM(a); if (m) m.n = p_display; save(); return ok(null); },
    acad_set_member_role: ({ a, m, r }) => { if (lvl(a) < 3) return err("owner only", "42501"); const x = st.mem.find((y) => y.id === m); x.r = r; const d = st.docs[key(a, "staff/" + m)]; if (d) d.data.role = r; save(); return ok(null); },
    acad_remove_member: ({ a, m }) => { const x = st.mem.find((y) => y.id === m); if (!x) return ok(null); if (!(lvl(a) === 3 || (lvl(a) === 2 && x.r === "athlete"))) return err("not allowed", "42501"); st.mem = st.mem.filter((y) => y !== x); if (x.r !== "athlete") delete st.docs[key(a, "staff/" + m)]; save(); return ok(null); },
    acad_delete_me: ({ a }) => { const m = meM(a); if (m.r === "owner") { st.acad = st.acad.filter((x) => x.id !== a); Object.keys(st.docs).forEach((k) => { if (k.startsWith(a + "|")) delete st.docs[k]; }); } st.mem = st.mem.filter((x) => x.a !== a || m.r !== "owner" ? x.id !== m.id : false); save(); return ok(null); },
    acad_cal_token: ({ a, renew }) => { const m = meM(a); if (!m) return err("not signed in", "28000"); st.cal = st.cal || {}; if (renew || !st.cal[m.id]) st.cal[m.id] = Math.random().toString(16).slice(2).padEnd(16, "0") + Math.random().toString(16).slice(2).padEnd(16, "0"); save(); return ok(st.cal[m.id].slice(0, 32)); },
    acad_merge: ({ a, p, patch }) => { const d = st.docs[key(a, p)]; if (!d || !can(a, p, true)) return err("document not found", "P0002"); d.data = merge(d.data, JSON.parse(JSON.stringify(patch))); save(); return ok(null); },
  };
  window.supabase = {
    createClient() {
      return {
        auth: {
          async getSession() { return { data: { session: sess() } }; },
          onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
          async signInAnonymously() { const user = { id: "d" + Math.random().toString(16).slice(2, 10), is_anonymous: true }; localStorage.setItem(K + ".session", JSON.stringify({ user })); return { data: { user, session: { user } }, error: null }; },
          async signOut() { localStorage.removeItem(K + ".session"); return { error: null }; },
        },
        from: () => new Q(),
        async rpc(name, args) { if (!dev()) return err("no session", "28000"); return RPC[name] ? RPC[name](args || {}) : err("unknown rpc " + name, "42883"); },
        channel() { const c = { on: () => c, subscribe: () => c }; return c; },
        storage: { from: () => ({ async upload(p) { st.files[p] = 1; save(); return { error: null }; }, async remove(ps) { ps.forEach((p) => delete st.files[p]); save(); return { error: null }; }, async createSignedUrl(p) { return { data: { signedUrl: "https://example.invalid/" + p } }; } }) },
      };
    },
  };
})();
