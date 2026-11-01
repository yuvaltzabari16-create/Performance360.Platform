/* In-memory stand-in for supabase-js, for local UI tests only. Mirrors the SQL rules in acad_can. */
(function () {
  const K = "mocksb";
  const st = JSON.parse(localStorage.getItem(K) || '{"acad":[],"mem":[],"codes":[],"docs":{},"files":{}}');
  const save = () => localStorage.setItem(K, JSON.stringify(st));
  const sess = () => JSON.parse(localStorage.getItem(K + ".session") || "null");
  const uidOf = (email) => { let h = 0; for (const c of email) h = (h * 31 + c.charCodeAt(0)) >>> 0; return "u0000000-0000-4000-8000-" + h.toString(16).padStart(12, "0"); };
  const me = () => sess()?.user?.id || null;
  const lvl = (a) => { const m = st.mem.find((x) => x.a === a && x.u === me()); return m ? { owner: 3, coach: 2, physio: 2, athlete: 1 }[m.r] : 0; };
  const active = (a) => { const x = st.acad.find((y) => y.id === a); return !!x && (x.plan === "active" || (x.plan === "trial" && new Date(x.trial_ends_at) > new Date())); };
  function can(a, p, w) {
    const L = lvl(a), u = me(), s = p.split("/"); if (!L || !u) return false; if (w && !active(a)) return false;
    let pr, pw, sr, sw;
    switch (s[0]) {
      case "academy": pr = 1; pw = 3; break; case "library": pr = 1; pw = 2; break;
      case "staff": pr = 1; pw = 3; sr = 1; sw = 2; break;
      case "athletes": case "logs": case "meals": case "inbox": pr = 2; pw = 2; sr = 1; sw = 1; break;
      case "roster": case "plan": case "notes": case "tests": pr = 2; pw = 2; sr = 1; sw = 2; break;
      case "payments": case "ownerprivate": pr = 3; pw = 3; break;
      case "programs": case "staffroom": case "staffnotes": pr = 2; pw = 2; break;
      case "data": return s[1] === "users" && s[2] === u;
      default: pr = 2; pw = 3;
    }
    if (sr != null && s[1] === u) return L >= Math.min(w ? pw : pr, w ? sw : sr);
    return L >= (w ? pw : pr);
  }
  const key = (a, p) => a + "|" + p;
  const merge = (a, b) => { const r = a && typeof a === "object" ? a : {}; for (const [k, v] of Object.entries(b || {})) { if (v === null) delete r[k]; else if (v && typeof v === "object" && !Array.isArray(v)) r[k] = merge(r[k] && typeof r[k] === "object" ? r[k] : {}, v); else r[k] = v; } return r; };
  const code = () => { const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 10; i++) s += A[Math.floor(Math.random() * 31)]; return s; };
  const err = (message, c) => ({ data: null, error: { message, code: c || "P0001" } });
  const ok = (data) => ({ data, error: null });
  const listeners = [];

  class Q {
    constructor() { this.f = []; this.op = "select"; }
    select() { return this; } eq(c, v) { this.f.push((r) => r[c] === v); return this; }
    not(c, op, v) { const pre = v.replace("%", ""); this.f.push((r) => !String(r[c]).startsWith(pre)); return this; }
    order(c, o) { this.ord = [c, o && o.ascending === false]; return this; } range(a, b) { this.rg = [a, b]; return this; } limit(n) { this.lim = n; return this; }
    maybeSingle() { this.single = true; return this; }
    upsert(row) { this.op = "upsert"; this.row = row; return this; } delete() { this.op = "delete"; return this; }
    then(res, rej) { return Promise.resolve(this.exec()).then(res, rej); }
    rows() { return Object.values(st.docs).map((d) => ({ ...d, coll: d.path.slice(0, d.path.lastIndexOf("/")) })); }
    exec() {
      if (this.op === "upsert") { const r = this.row; if (!can(r.academy_id, r.path, true)) return err("new row violates row-level security policy", "42501"); st.docs[key(r.academy_id, r.path)] = { academy_id: r.academy_id, path: r.path, data: JSON.parse(JSON.stringify(r.data)) }; save(); return ok(null); }
      let rows = this.rows().filter((r) => can(r.academy_id, r.path, this.op === "delete")).filter((r) => this.f.every((fn) => fn(r)));
      if (this.op === "delete") { rows.forEach((r) => delete st.docs[key(r.academy_id, r.path)]); save(); return ok(null); }
      if (this.ord) { const [c, desc] = this.ord; const get = (r) => (c.startsWith("data->>") ? r.data[c.slice(7)] : r[c]) ?? ""; rows.sort((a, b) => (get(a) < get(b) ? -1 : get(a) > get(b) ? 1 : 0) * (desc ? -1 : 1)); }
      if (this.rg) rows = rows.slice(this.rg[0], this.rg[1] + 1); if (this.lim) rows = rows.slice(0, this.lim);
      const out = rows.map((r) => ({ path: r.path, data: JSON.parse(JSON.stringify(r.data)) }));
      return ok(this.single ? out[0] || null : out);
    }
  }
  const RPC = {
    acad_my_academies: () => ok(st.mem.filter((m) => m.u === me()).map((m) => { const x = st.acad.find((y) => y.id === m.a); return { id: x.id, name: x.name, role: m.r, display_name: m.n, plan: x.plan, trial_ends_at: x.trial_ends_at, paid_until: null, active: active(x.id) }; })),
    acad_create_academy: ({ p_name, p_display, p_sport }) => {
      if (!p_name || p_name.length < 2) return err("academy name must be 2 to 80 characters", "22023");
      const id = "a" + Math.random().toString(16).slice(2, 10) + "-0000-4000-8000-000000000000"; const u = me();
      st.acad.push({ id, name: p_name, owner: u, plan: "trial", trial_ends_at: new Date(Date.now() + 30 * 864e5).toISOString() });
      st.mem.push({ a: id, u, r: "owner", n: p_display });
      ["athlete", "coach", "physio"].forEach((r) => st.codes.push({ a: id, r, c: code() }));
      st.docs[key(id, "academy/settings")] = { academy_id: id, path: "academy/settings", data: { name: p_name, sport: p_sport || "", currency: "ILS", weekStart: "sun", groups: [], mealComments: true, retentionMonths: 24, defaultMinutes: 60 } };
      st.docs[key(id, "staff/" + u)] = { academy_id: id, path: "staff/" + u, data: { name: p_display, role: "coach", owner: true, title: "Head coach", joined: new Date().toISOString() } };
      save(); return ok(id);
    },
    acad_join: ({ p_code, p_display }) => {
      const c = String(p_code).toUpperCase().replace(/[^A-Z0-9]/g, ""); const hit = st.codes.find((x) => x.c === c); if (!hit) return ok([]);
      const cur = st.mem.find((m) => m.a === hit.a && m.u === me());
      if (cur) return cur.r === hit.r ? ok([{ academy_id: hit.a, role: cur.r }]) : err("already_member_" + cur.r);
      st.mem.push({ a: hit.a, u: me(), r: hit.r, n: p_display });
      if (hit.r !== "athlete") st.docs[key(hit.a, "staff/" + me())] = { academy_id: hit.a, path: "staff/" + me(), data: { name: p_display, role: hit.r, joined: new Date().toISOString() } };
      save(); return ok([{ academy_id: hit.a, role: hit.r }]);
    },
    acad_codes_list: ({ a }) => ok(st.codes.filter((x) => x.a === a && (lvl(a) === 3 || (lvl(a) === 2 && x.r === "athlete"))).map((x) => ({ role: x.r, code: x.c }))),
    acad_rotate_code: ({ a, r }) => { if (lvl(a) < 3) return err("owner only", "42501"); st.codes = st.codes.filter((x) => !(x.a === a && x.r === r)); const c = code(); st.codes.push({ a, r, c }); save(); return ok(c); },
    acad_disable_code: ({ a, r }) => { if (lvl(a) < 3) return err("owner only", "42501"); st.codes = st.codes.filter((x) => !(x.a === a && x.r === r)); save(); return ok(null); },
    acad_member_names: ({ a }) => ok(st.mem.filter((m) => m.a === a && (lvl(a) >= 2 || m.u === me() || m.r !== "athlete")).map((m) => ({ user_id: m.u, role: m.r, display_name: m.n }))),
    acad_set_display_name: ({ a, p_display }) => { const m = st.mem.find((x) => x.a === a && x.u === me()); if (m) m.n = p_display; save(); return ok(null); },
    acad_set_member_role: ({ a, u, r }) => { if (lvl(a) < 3) return err("owner only", "42501"); const m = st.mem.find((x) => x.a === a && x.u === u); m.r = r; const d = st.docs[key(a, "staff/" + u)]; if (d) d.data.role = r; save(); return ok(null); },
    acad_remove_member: ({ a, u }) => { const m = st.mem.find((x) => x.a === a && x.u === u); if (!m) return ok(null); if (!(lvl(a) === 3 || (lvl(a) === 2 && m.r === "athlete"))) return err("not allowed", "42501"); st.mem = st.mem.filter((x) => x !== m); if (m.r !== "athlete") delete st.docs[key(a, "staff/" + u)]; save(); return ok(null); },
    acad_delete_my_account: () => { const u = me(); st.acad.filter((x) => x.owner === u).forEach((x) => { Object.keys(st.docs).forEach((k) => { if (k.startsWith(x.id + "|")) delete st.docs[k]; }); }); st.acad = st.acad.filter((x) => x.owner !== u); st.mem = st.mem.filter((m) => m.u !== u); save(); return ok(null); },
    acad_merge: ({ a, p, patch }) => { const d = st.docs[key(a, p)]; if (!d || !can(a, p, true)) return err("document not found", "P0002"); d.data = merge(d.data, JSON.parse(JSON.stringify(patch))); save(); return ok(null); },
  };
  window.supabase = {
    createClient() {
      return {
        auth: {
          async getSession() { return { data: { session: sess() } }; },
          onAuthStateChange(fn) { listeners.push(fn); return { data: { subscription: { unsubscribe() {} } } }; },
          async signInWithOtp({ email }) { localStorage.setItem(K + ".pending", email); return { error: null }; },
          async verifyOtp({ email, token }) { if (token !== "123456") return { data: {}, error: { message: "Token has expired or is invalid" } }; const user = { id: uidOf(email), email }; localStorage.setItem(K + ".session", JSON.stringify({ user })); return { data: { user, session: { user } }, error: null }; },
          async signOut() { localStorage.removeItem(K + ".session"); listeners.forEach((f) => f("SIGNED_OUT")); return { error: null }; },
        },
        from: () => new Q(),
        async rpc(name, args) { if (!me()) return err("sign in first", "28000"); return RPC[name] ? RPC[name](args || {}) : err("unknown rpc " + name, "42883"); },
        channel() { const c = { on: () => c, subscribe: () => c }; return c; },
        storage: { from: () => ({ async upload(p) { st.files[p] = 1; save(); return { error: null }; }, async remove(ps) { ps.forEach((p) => delete st.files[p]); save(); return { error: null }; }, async createSignedUrl(p) { return { data: { signedUrl: "https://example.invalid/" + p } }; } }) },
      };
    },
  };
  window.__mock = st;
})();
