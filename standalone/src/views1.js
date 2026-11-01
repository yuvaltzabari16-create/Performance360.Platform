/* ---------- icons ---------- */
const IC = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16.5 14.6c2.6.1 4.4 1.8 5 4.9"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  badge: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7.5 18c.8-2.2 2.4-3.3 4.5-3.3s3.7 1.1 4.5 3.3"/>',
  plan: '<path d="M8 4h11v16H5V7z"/><path d="M8 4v3H5M9 12h6M9 16h4"/>',
  book: '<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M5 16a4 4 0 0 1 4-4h10"/>',
  gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  dumbbell: '<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',
  note: '<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M9 9h6M9 13h4"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/>',
  send: '<path d="M4 12l16-8-6 16-2-6z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  logout: '<path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
};
const icon = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ""}</svg>`;
const LOGO = `<svg class="logo" viewBox="250 266 690 690" aria-hidden="true"><path d="M309 716A303 303 0 1 1 885 690" fill="none" stroke="var(--logo-deep)" stroke-width="53" stroke-linecap="round"/><path d="M848 774A303 303 0 0 1 416 856" fill="none" stroke="var(--logo-bright)" stroke-width="53"/><polygon points="355,812 453,803 378,908" fill="var(--logo-bright)"/><rect x="473" y="626" width="68" height="90" rx="14" fill="var(--logo-deep)"/><rect x="560" y="561" width="68" height="155" rx="14" fill="var(--logo-deep)"/><rect x="647" y="496" width="68" height="220" rx="14" fill="var(--logo-bright)"/></svg>`;
const empty = (ic, title, body, action = "") => `<div class="empty">${icon(ic)}<b>${esc(title)}</b>${body ? `<p>${body}</p>` : ""}${action}</div>`;
const av = (uid, sm) => `<span class="av${sm ? " sm" : ""}">${esc(initials(nameOf(uid)))}</span>`;
const sel = (opts, v) => opts.map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(v ?? "") ? " selected" : ""}>${esc(l)}</option>`).join("");
const armBtn = (key, label, act, data = "") => `<button class="btn sm danger${S.armed === key ? " armed" : ""}" data-act="${act}" data-arm="${esc(key)}" ${data}>${S.armed === key ? "Click again to confirm" : esc(label)}</button>`;

/* ---------- navigation ---------- */
const NAV = {
  staff: [
    ["Academy", [["dashboard", "Dashboard", "home"], ["athletes", "My athletes", "users"], ["calendar", "Training calendar", "cal"], ["messages", "Messages", "chat"], ["staff", "Staff", "badge"]]],
    ["Training", [["planner", "Workout planner", "plan"], ["library", "Exercise library", "book"], ["testing", "Testing", "gauge"], ["nutrition", "Nutrition", "leaf"]]],
    ["Business", [["payments", "Payments", "card", "owner"], ["config", "Settings", "gear"]]],
  ],
  athlete: [
    ["My training", [["dashboard", "Dashboard", "home"], ["calendar", "Training calendar", "cal"], ["tracker", "Workout tracker", "dumbbell"], ["notes", "Coach notes", "note"], ["progress", "My progress", "trend"], ["nutrition", "Nutrition", "leaf"]]],
    ["Academy", [["messages", "Messages", "chat"], ["config", "Settings", "gear"]]],
  ],
};
const HIDDEN_ATHLETE_VIEWS = ["library"];
function allowedViews() {
  const groups = isStaff() ? NAV.staff : NAV.athlete;
  const v = groups.flatMap(([, items]) => items.filter((i) => i[3] !== "owner" || S.role === "owner").map((i) => i[0]));
  return isStaff() ? v : v.concat(HIDDEN_ATHLETE_VIEWS);
}
function navHtml() {
  const groups = isStaff() ? NAV.staff : NAV.athlete;
  const unread = unreadTotal() + (isStaff() ? staffroomUnread() : 0);
  return groups.map(([label, items]) => `<div class="navlabel">${esc(label)}</div>` + items.filter((i) => i[3] !== "owner" || S.role === "owner").map(([id, l, ic]) =>
    `<button class="nav" data-act="go" data-v="${id}"${S.view === id ? ' aria-current="page"' : ""}>${icon(ic)}<span>${esc(l)}</span>${id === "messages" && unread ? `<span class="badge">${unread}</span>` : ""}</button>`).join("")).join("");
}

/* ---------- page ---------- */
function page() {
  if (S.phase === "boot") return gate(`<div class="row"><span class="spinner"></span><b>Opening Performance360 Academy…</b></div>`);
  if (S.phase === "nodb") return gate(`<h2>Sign in to open the academy</h2><p class="muted">This app keeps its records in a private, access-controlled store on claude.ai. Open it from its claude.ai link while signed in to your Claude account.</p><p class="small faint">If you are signed in and still see this, ask the academy owner to share the app with you.</p>`);
  if (S.revoked) return gate(`<h2>Your access changed</h2><p class="muted">The academy owner changed who can use this app. Reload the page to continue.</p>`);
  if (S.phase === "loading" || !S.role) return gate(`<div class="row"><span class="spinner"></span><b>Loading your academy…</b></div>${S.slow ? `<p class="notice warn">The data store is taking longer than usual to answer. Check your connection; this page will continue by itself when it does.</p>` : ""}`);
  if (needsLogin()) return gate(loginScreen(), true);
  if (!allowedViews().includes(S.view)) S.view = "dashboard";
  const meta = viewMeta();
  const meRole = ROLE_LABEL[S.role] || "";
  return `<div class="app">
    <aside class="side${S.navOpen ? " open" : ""}" aria-label="Sections">
      <div class="brand">${LOGO}<div>Performance<b>360</b><small>${esc(settings().name)}</small></div></div>
      ${navHtml()}
      <div class="me">${av(S.uid, true)}<div class="who"><div><b>${esc(nameOf(S.uid))}</b></div><div class="small muted">${esc(meRole)}</div></div><button class="iconbtn" data-act="sign-out" aria-label="Sign out" title="Sign out" style="margin-inline-start:auto">${icon("logout")}</button></div>
    </aside>
    <div class="scrim${S.navOpen ? " open" : ""}" data-act="nav-close"></div>
    <div class="main">
      <header class="top"><button class="iconbtn menubtn" data-act="nav-open" aria-label="Open menu">${icon("menu")}</button>
        <div style="min-width:0"><h1>${esc(meta.title)}</h1>${meta.sub ? `<div class="sub">${meta.sub}</div>` : ""}</div>
        <div class="actions">${meta.actions || ""}${toolBtns()}</div></header>
      <main class="view">${S.slow && !S.loaded.settings ? `<div class="notice warn">Some data hasn't loaded yet. It may be out of date until the connection recovers.</div>` : ""}${viewBody()}</main>
    </div>
  </div>${S.modal ? modalHtml() : ""}`;
}
function toolBtns() {
  const dark = isDarkNow();
  return `<span class="tools"><button class="iconbtn" data-act="toggle-theme" aria-label="${dark ? "Light mode" : "Dark mode"}" title="${dark ? "Light mode" : "Dark mode"}">${icon(dark ? "sun" : "moon")}</button><button class="iconbtn langbtn" data-act="toggle-lang" translate="no" aria-label="${LANG === "he" ? "Switch to English" : "החלפה לעברית"}" title="${LANG === "he" ? "English" : "עברית"}">${LANG === "he" ? "EN" : "עב"}</button></span>`;
}
function gate(inner, wide) { return `<div class="gate"><div class="card"${wide ? ' style="width:min(680px,100%)"' : ""}><div class="row" style="flex-wrap:nowrap">${LOGO.replace('class="logo"', 'class="logo" style="width:44px;height:44px"')}<div style="min-width:0"><h2 style="font-size:22px" translate="no">Performance<span style="color:var(--logo-bright)">360</span> Academy</h2><div class="small muted">${esc(settings().name)}</div></div><div class="row" style="margin-inline-start:auto;gap:6px;flex-wrap:nowrap">${toolBtns()}</div></div>${inner}</div></div>`; }

const VIEWS = {};
function viewMeta() { const v = VIEWS[S.view]; return v && v.meta ? v.meta() : { title: "" }; }
function viewBody() { const v = VIEWS[S.view]; return v ? v.body() : ""; }

/* ---------- onboarding ---------- */
function signedInAs() { return `<div class="notice good row" style="gap:8px">${icon("shield")}<span>Signed in with your Claude account</span><b translate="no">${esc(S.viewerName || "")}</b></div>`; }
function staffOnboarding() {
  return `<h3>Staff sign-in</h3>${signedInAs()}<p>You've been given staff access to <b>${esc(settings().name)}</b>. Set up your staff profile to continue.</p>
  <form class="form" data-form="staff-join">
    <label class="f full">Full name<input id="sj_name" name="name" required maxlength="80" value="${esc(S.viewerName)}"></label>
    <label class="f">Role<select id="sj_role" name="role">${sel([["coach", "Coach"], ["physio", "Physiotherapist"]], "coach")}</select></label>
    <label class="f">Title (optional)<input id="sj_title" name="title" maxlength="60" placeholder="e.g. Strength & conditioning"></label>
    <label class="f full">Phone (optional, visible to staff)<input id="sj_phone" name="phone" maxlength="30" inputmode="tel"></label>
    <label class="check full"><input type="checkbox" id="sj_ok" name="agree" required> <span>I will keep athlete records confidential, use them only for coaching and care, and not copy them outside the academy.</span></label>
    <div class="formactions"><button class="btn primary">Join as staff</button></div>
  </form>`;
}
function athleteOnboarding() {
  const needCode = !!settings().joinHash;
  return `<h3>Athlete sign-in</h3>${signedInAs()}<p>Welcome to <b>${esc(settings().name)}</b>. ${needCode ? "Enter the academy code from your coach, then create your profile." : "Create your athlete profile so your coaches can plan your training."}</p>
  <form class="form" data-form="athlete-join">
    ${needCode ? `<label class="f full">Academy code<input id="aj_code" name="code" required maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. K7M2QXPA" style="font-size:18px;letter-spacing:.15em;text-transform:uppercase" translate="no"></label>` : ""}
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
}
function viewOnlyGate() {
  return `<h3>View-only access</h3>${signedInAs()}<p class="muted">You can open this app but not save anything yet. Ask the academy owner to share it with you as <b>Contributor</b> (athletes) or <b>Editor</b> (coaches and physiotherapists), then reload.</p>`;
}

/* ---------- dashboard ---------- */
VIEWS.dashboard = {
  meta: () => ({ title: isStaff() ? `Good ${dayPart()}, ${firstName(nameOf(S.uid))}` : `Hi ${firstName(nameOf(S.uid))}`, sub: esc(fmtDay(today(), { weekday: "long", day: "numeric", month: "long" })) + " · " + esc(settings().name) }),
  body: () => (isStaff() ? staffDashboard() : athleteDashboard()),
};
function dayPart() { const h = new Date().getHours(); return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"; }
function firstName(n) { return String(n || "").split(/\s+/)[0] || ""; }
function staffDashboard() {
  const t = today(); const ids = athleteIds();
  const todays = allSessions().filter((s) => s.date === t);
  const groupedToday = groupSessions(todays);
  const weekFrom = weekStart(t);
  const weekSess = allSessions().filter((s) => s.date >= weekFrom && s.date <= addDays(weekFrom, 6));
  const doneWeek = weekSess.filter((s) => logOf(s.athlete, s.id)?.done).length;
  const unread = unreadTotal();
  const flags = ids.map((u) => ({ u, r: acwr(u) })).filter((x) => x.r && (x.r > 1.5 || x.r < 0.8));
  const mealsToday = ids.filter((u) => S.logs[u]?.meals?.[t]).length;
  const outstanding = S.role === "owner" ? Object.keys(S.payments).reduce((a, u) => a + balanceOf(u), 0) : 0;
  const overdue = S.role === "owner" ? Object.keys(S.payments).flatMap(chargesOf).filter((c) => !c.paid && c.due && c.due < t).length : 0;
  const recentLogs = ids.flatMap((u) => workoutsOf(u).map((w) => ({ ...w, u }))).filter((w) => w.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  return `
  <div class="grid g4">
    <div class="card stat"><span class="k">Active athletes</span><span class="v">${ids.length}</span><span class="s">${Object.keys(S.athletes).length - ids.length} archived</span></div>
    <div class="card stat"><span class="k">Sessions today</span><span class="v">${groupedToday.length}</span><span class="s">${todays.length} athlete bookings</span></div>
    <div class="card stat"><span class="k">This week completed</span><span class="v">${weekSess.length ? Math.round((doneWeek / weekSess.length) * 100) : 0}%</span><span class="s">${doneWeek} of ${weekSess.length} sessions logged</span></div>
    ${S.role === "owner"
      ? `<div class="card stat clickable" data-act="go" data-v="payments"><span class="k">Outstanding payments</span><span class="v">${esc(money(outstanding))}</span><span class="s">${overdue ? `<span class="pill bad">${overdue} overdue</span>` : "Nothing overdue"}</span></div>`
      : `<div class="card stat clickable" data-act="go" data-v="messages"><span class="k">Unread messages</span><span class="v">${unread}</span><span class="s">from athletes</span></div>`}
  </div>
  <div class="split">
    <div class="card"><div class="hd"><h2>Today's sessions</h2><button class="btn sm" data-act="go" data-v="calendar">Open calendar</button><button class="btn sm primary" data-act="new-session" data-date="${t}">${icon("plus")}Session</button></div>
      ${groupedToday.length ? `<div class="stack">${groupedToday.map(sessionCard).join("")}</div>` : empty("cal", "No sessions today", "Plan one from the calendar or assign a program from the workout planner.")}
    </div>
    <div class="stack">
      <div class="card"><div class="hd"><h2>Needs attention</h2></div>
        <div class="list">
          ${unread ? `<div class="li clickable" data-act="go" data-v="messages"><span class="pill info">${unread}</span><div class="grow">Unread athlete messages</div></div>` : ""}
          ${flags.map((f) => `<div class="li clickable" data-act="open-athlete" data-u="${esc(f.u)}">${av(f.u, true)}<div class="grow"><div class="t">${esc(nameOf(f.u))}</div><div class="small muted">Acute:chronic load ${f.r.toFixed(2)}</div></div><span class="pill ${f.r > 1.5 ? "bad" : "warn"}">${f.r > 1.5 ? "Spike" : "Low"}</span></div>`).join("")}
          ${overdue ? `<div class="li clickable" data-act="go" data-v="payments"><span class="pill bad">${overdue}</span><div class="grow">Overdue payments</div></div>` : ""}
          <div class="li"><span class="pill brand">${mealsToday}</span><div class="grow">athletes logged meals today</div><button class="btn sm ghost" data-act="go" data-v="nutrition">Review</button></div>
          ${!ids.length ? `<div class="li"><div class="grow small muted">No athletes yet. Give your athletes the athlete code from Settings → Access & roles; they appear here once they sign in.</div></div>` : ""}
        </div>
      </div>
      <div class="card"><div class="hd"><h2>Latest workout logs</h2></div>
        ${recentLogs.length ? `<div class="list">${recentLogs.map((w) => `<div class="li clickable" data-act="open-athlete" data-u="${esc(w.u)}">${av(w.u, true)}<div class="grow"><div class="t">${esc(nameOf(w.u))}</div><div class="small muted">${esc(w.title || "Workout")} · RPE ${esc(w.rpe ?? "–")} · ${esc(w.minutes ?? "–")} min</div></div><span class="small faint">${esc(ago(w.at))}</span></div>`).join("")}</div>` : empty("dumbbell", "No logs yet", "Athletes' completed workouts show up here.")}
      </div>
    </div>
  </div>`;
}
function groupSessions(list) {
  const m = new Map();
  for (const s of list) { const k = s.id; if (!m.has(k)) m.set(k, { ...s, athletes: [] }); m.get(k).athletes.push(s.athlete); }
  return [...m.values()].sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
}
function sessionCard(g) {
  const done = g.athletes.filter((u) => logOf(u, g.id)?.done).length;
  return `<div class="sess clickable" data-act="open-session" data-sid="${esc(g.id)}" data-u="${esc(g.athletes[0])}">
    <div class="time">${esc(g.time || "—")}</div>
    <div class="grow" style="flex:1;min-width:0"><div class="row"><b>${esc(g.title || g.type || "Session")}</b><span class="pill brand">${esc(g.type || "")}</span></div>
      <div class="small muted">${g.athletes.length === 1 ? esc(nameOf(g.athletes[0])) : `${g.athletes.length} athletes`}${g.location ? " · " + esc(g.location) : ""}${g.minutes ? " · " + esc(g.minutes) + " min" : ""}</div></div>
    <span class="pill ${done === g.athletes.length ? "good" : ""}">${done}/${g.athletes.length} done</span></div>`;
}
function athleteDashboard() {
  const u = S.uid; const t = today();
  const mine = sessionsOf(u);
  const todays = mine.filter((s) => s.date === t);
  const next = mine.find((s) => s.date > t);
  const wl = weeklyLoads(u, 4);
  const lastNote = vals(S.notes[u]?.notes).sort((a, b) => (b.at || "").localeCompare(a.at || ""))[0];
  const meals = mealsList().filter((m) => m.date === t);
  const tot = mealTotals(meals);
  const unread = unreadFor(u);
  const weekFrom = weekStart(t); const wk = mine.filter((s) => s.date >= weekFrom && s.date <= addDays(weekFrom, 6));
  return `<div class="grid g4">
    <div class="card stat"><span class="k">This week</span><span class="v">${wk.filter((s) => logOf(u, s.id)?.done).length}/${wk.length}</span><span class="s">sessions completed</span></div>
    <div class="card stat"><span class="k">Training load</span><span class="v">${wl[3].load}</span><span class="s">this week (RPE × min)</span></div>
    <div class="card stat clickable" data-act="go" data-v="nutrition"><span class="k">Today's food</span><span class="v">${tot.kcal || 0}</span><span class="s">kcal · ${meals.length} meals logged</span></div>
    <div class="card stat clickable" data-act="go" data-v="messages"><span class="k">Messages</span><span class="v">${unread}</span><span class="s">unread from staff</span></div>
  </div>
  <div class="split">
    <div class="card"><div class="hd"><h2>Today</h2><button class="btn sm" data-act="go" data-v="calendar">Calendar</button></div>
      ${todays.length ? `<div class="stack">${todays.map((s) => athleteSessionRow(s)).join("")}</div>` : `${empty("cal", "Rest day", next ? `Next session: <b>${esc(next.title || next.type)}</b> on ${esc(fmtDay(next.date))}${next.time ? " at " + esc(next.time) : ""}.` : "No upcoming sessions yet.")}`}
      <div class="row" style="margin-top:12px"><button class="btn" data-act="go" data-v="tracker">${icon("dumbbell")}Log a workout</button><button class="btn" data-act="go" data-v="nutrition">${icon("camera")}Add a meal</button></div>
    </div>
    <div class="stack">
      <div class="card"><div class="hd"><h2>Latest coach note</h2><button class="btn sm ghost" data-act="go" data-v="notes">All notes</button></div>
        ${lastNote ? `<p class="ai" translate="no">${esc(lastNote.text)}</p><p class="small faint" style="margin-top:6px">${esc(nameOf(lastNote.by))} · ${esc(ago(lastNote.at))}</p>` : `<p class="muted">Your coaches haven't left a note yet.</p>`}</div>
      <div class="card"><div class="hd"><h2>Load, last 4 weeks</h2></div>${barChart(wl.map((w) => ({ label: fmtDay(w.week, { day: "numeric", month: "short" }), value: w.load })))}</div>
    </div>
  </div>`;
}
function athleteSessionRow(s) {
  const lg = logOf(S.uid, s.id);
  return `<div class="sess clickable" data-act="track" data-sid="${esc(s.id)}"><div class="time">${esc(s.time || "—")}</div><div style="flex:1;min-width:0"><b>${esc(s.title || s.type)}</b><div class="small muted">${esc(s.type || "")}${s.location ? " · " + esc(s.location) : ""}${(s.items || []).length ? ` · ${(s.items || []).length} exercises` : ""}</div></div>${lg?.done ? `<span class="pill good">${icon("check")}Done</span>` : `<span class="pill">To do</span>`}</div>`;
}

/* ---------- charts ---------- */
function barChart(data, opt = {}) {
  if (!data.length) return "";
  const W = 420, H = 150, P = { l: 34, r: 8, t: 10, b: 24 };
  const max = Math.max(1, ...data.map((d) => d.value)); const nice = niceMax(max);
  const bw = (W - P.l - P.r) / data.length;
  const y = (v) => H - P.b - (v / nice) * (H - P.t - P.b);
  let g = "";
  for (let i = 0; i <= 2; i++) { const v = (nice / 2) * i; g += `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`; }
  const bars = data.map((d, i) => `<rect class="bx${opt.hi && opt.hi(d) ? " hi" : ""}" x="${P.l + i * bw + bw * 0.18}" y="${y(d.value)}" width="${bw * 0.64}" height="${Math.max(0, H - P.b - y(d.value))}" rx="3"><title>${esc(d.label)}: ${d.value}</title></rect><text x="${P.l + i * bw + bw / 2}" y="${H - 7}" text-anchor="middle">${esc(d.label)}</text>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Bar chart">${g}${bars}</svg>`;
}
function lineChart(points, unit) {
  if (points.length < 2) return `<p class="small muted">${points.length ? `One result so far: <b>${esc(points[0].value)} ${esc(unit)}</b> on ${esc(fmtDay(points[0].date))}. Add another to see a trend.` : "No results yet."}</p>`;
  const W = 420, H = 160, P = { l: 40, r: 12, t: 12, b: 24 };
  const vs = points.map((p) => p.value); let lo = Math.min(...vs), hi = Math.max(...vs); if (lo === hi) { lo -= 1; hi += 1; } const padv = (hi - lo) * 0.15; lo -= padv; hi += padv;
  const t0 = parseDay(points[0].date).getTime(), t1 = Math.max(t0 + 1, parseDay(points[points.length - 1].date).getTime());
  const x = (d) => P.l + ((parseDay(d).getTime() - t0) / (t1 - t0)) * (W - P.l - P.r);
  const y = (v) => H - P.b - ((v - lo) / (hi - lo)) * (H - P.t - P.b);
  let g = ""; for (let i = 0; i <= 2; i++) { const v = lo + ((hi - lo) / 2) * i; g += `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end">${fmtNum(v)}</text>`; }
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = `${path}L${x(points[points.length - 1].date).toFixed(1)},${H - P.b}L${x(points[0].date).toFixed(1)},${H - P.b}Z`;
  const last = points[points.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Trend">${g}<path class="ar" d="${area}"/><path class="ln" d="${path}"/>${points.map((p) => `<circle class="pt" cx="${x(p.date)}" cy="${y(p.value)}" r="${p === last ? 4.5 : 2.5}"><title>${esc(fmtDay(p.date))}: ${esc(p.value)} ${esc(unit)}</title></circle>`).join("")}<text x="${P.l}" y="${H - 6}">${esc(fmtDay(points[0].date, { day: "numeric", month: "short" }))}</text><text x="${W - P.r}" y="${H - 6}" text-anchor="end">${esc(fmtDay(last.date, { day: "numeric", month: "short" }))}</text></svg>`;
}
function niceMax(m) { const p = Math.pow(10, Math.floor(Math.log10(m))); for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= m) return k * p; return 10 * p; }
function fmtNum(v) { return Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100; }

/* ---------- athletes ---------- */
VIEWS.athletes = {
  meta: () => {
    const u = S.sel.athlete;
    if (u && S.athletes[u]) return { title: nameOf(u), sub: `${esc(S.athletes[u].sport || "")}${S.athletes[u].position ? " · " + esc(S.athletes[u].position) : ""}`, actions: `<button class="btn" data-act="back-athletes">${icon(RTL() ? "right" : "left")}All athletes</button><button class="btn" data-act="thread" data-u="${esc(u)}">${icon("chat")}Message</button><button class="btn primary" data-act="new-session" data-u="${esc(u)}" data-date="${today()}">${icon("plus")}Session</button>` };
    return { title: "My athletes", sub: `${athleteIds().length} active` };
  },
  body: () => (S.sel.athlete && S.athletes[S.sel.athlete] ? athleteDetail(S.sel.athlete) : athleteList()),
};
function athleteList() {
  const q = (S.sel.aq || "").toLowerCase(); const st = S.sel.ast || "active"; const grp = S.sel.agrp || "";
  const ids = athleteIds(true).filter((u) => {
    const r = S.roster[u] || {}; const status = r.status || "active";
    if (st !== "all" && status !== st) return false; if (grp && r.group !== grp) return false;
    return !q || (nameOf(u) + " " + (S.athletes[u].sport || "") + " " + (S.athletes[u].position || "")).toLowerCase().includes(q);
  });
  const groups = settings().groups; const t = today();
  return `<div class="card"><div class="row" style="margin-bottom:12px">
    <input id="aq" placeholder="Search name, sport or position" value="${esc(S.sel.aq || "")}" data-live="aq" style="max-width:280px">
    <select id="ast" data-change="ast" style="width:auto">${sel([["active", "Active"], ["paused", "Paused"], ["archived", "Archived"], ["all", "All"]], st)}</select>
    ${groups.length ? `<select id="agrp" data-change="agrp" style="width:auto">${sel([["", "All groups"], ...groups.map((g) => [g, g])], grp)}</select>` : ""}
    <span class="small muted" style="margin-inline-start:auto">New athletes join with the athlete code in Settings → Access & roles.</span></div>
    ${ids.length ? `<div class="tablewrap"><table><thead><tr><th>Athlete</th><th>Group</th><th>Status</th><th>Next session</th><th class="r">Week load</th><th class="r">ACWR</th><th>Last log</th></tr></thead><tbody>
    ${ids.map((u) => { const r = S.roster[u] || {}; const nx = sessionsOf(u).find((s) => s.date >= t); const w = workoutsOf(u).filter((x) => x.at).sort((a, b) => b.at.localeCompare(a.at))[0]; const ac = acwr(u);
      return `<tr class="clickable" data-act="open-athlete" data-u="${esc(u)}"><td><span class="row" style="flex-wrap:nowrap">${av(u, true)}${esc(nameOf(u))}</span></td><td>${esc(r.group || "–")}</td><td>${statusPill(r.status)}</td><td>${nx ? esc(fmtDay(nx.date)) + (nx.time ? " " + esc(nx.time) : "") : '<span class="faint">None</span>'}</td><td class="r">${loadWindow(u, t, 7)}</td><td class="r">${ac ? `<span class="pill ${ac > 1.5 ? "bad" : ac < 0.8 ? "warn" : "good"}">${ac.toFixed(2)}</span>` : "–"}</td><td class="small muted">${w ? esc(ago(w.at)) : "–"}</td></tr>`; }).join("")}
    </tbody></table></div>` : empty("users", Object.keys(S.athletes).length ? "No athletes match" : "No athletes yet", Object.keys(S.athletes).length ? "Change the search or filters." : "Give each athlete the athlete code from Settings → Access & roles. They sign in with their email, enter the code and create a profile; then they appear here.")}
  </div>`;
}
function statusPill(s) { s = s || "active"; return `<span class="pill ${s === "active" ? "good" : s === "paused" ? "warn" : ""}">${esc(s[0].toUpperCase() + s.slice(1))}</span>`; }
function athleteDetail(u) {
  const tab = S.sel.atab || "overview";
  const tabs = [["overview", "Overview"], ["plan", "Training"], ["notes", "Notes"], ["tests", "Tests"], ["nutrition", "Nutrition"], ["profile", "Profile & status"]];
  if (S.role === "owner") tabs.splice(5, 0, ["pay", "Payments"]);
  return `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" role="tab" aria-selected="${tab === k}" data-act="atab" data-t="${k}">${l}</button>`).join("")}</div>${({ overview: athOverview, plan: athPlan, notes: athNotes, tests: athTests, nutrition: athNutrition, pay: athPay, profile: athProfile })[tab](u)}`;
}
function athOverview(u) {
  const a = S.athletes[u]; const r = S.roster[u] || {}; const t = today(); const ac = acwr(u);
  const upcoming = sessionsOf(u).filter((s) => s.date >= t).slice(0, 5);
  const wl = weeklyLoads(u, 8);
  const age = a.dob ? Math.floor((Date.now() - parseDay(a.dob).getTime()) / (365.25 * 864e5)) : null;
  return `<div class="grid g4">
    <div class="card stat"><span class="k">Status</span><span class="v" style="font-size:22px">${statusPill(r.status)}</span><span class="s">${esc(r.group || "No group")}</span></div>
    <div class="card stat"><span class="k">Age</span><span class="v">${age ?? "–"}</span><span class="s">${a.minor ? "Guardian consent on file" : a.dob ? esc(fmtDay(a.dob, { day: "numeric", month: "short", year: "numeric" })) : ""}</span></div>
    <div class="card stat"><span class="k">7-day load</span><span class="v">${loadWindow(u, t, 7)}</span><span class="s">RPE × minutes</span></div>
    <div class="card stat"><span class="k">Acute:chronic</span><span class="v">${ac ? ac.toFixed(2) : "–"}</span><span class="s">${ac ? (ac > 1.5 ? "Load spike, review" : ac < 0.8 ? "Detraining risk" : "In the safe range") : "Needs 4 weeks of logs"}</span></div>
  </div>
  <div class="split"><div class="card"><div class="hd"><h2>Weekly load</h2></div>${barChart(wl.map((w) => ({ label: fmtDay(w.week, { day: "numeric", month: "short" }), value: w.load })), { hi: (d) => false })}</div>
  <div class="card"><div class="hd"><h2>Upcoming</h2></div>${upcoming.length ? `<div class="list">${upcoming.map((s) => `<div class="li clickable" data-act="open-session" data-sid="${esc(s.id)}" data-u="${esc(u)}"><div class="grow"><div class="t">${esc(s.title || s.type)}</div><div class="small muted">${esc(fmtDay(s.date))} ${esc(s.time || "")}</div></div><span class="pill brand">${esc(s.type || "")}</span></div>`).join("")}</div>` : `<p class="muted">Nothing scheduled.</p>`}</div></div>
  ${a.medical ? `<div class="card"><div class="hd"><h3>Medical notes from the athlete</h3><span class="pill warn">Staff only</span></div><p class="ai" translate="no">${esc(a.medical)}</p></div>` : ""}`;
}
function athPlan(u) {
  const t = today(); const list = sessionsOf(u); const past = list.filter((s) => s.date < t).reverse().slice(0, 30); const up = list.filter((s) => s.date >= t);
  const row = (s) => { const lg = logOf(u, s.id); return `<tr class="clickable" data-act="open-session" data-sid="${esc(s.id)}" data-u="${esc(u)}"><td>${esc(fmtDay(s.date))}</td><td>${esc(s.time || "")}</td><td>${esc(s.title || "")}</td><td><span class="pill brand">${esc(s.type || "")}</span></td><td>${lg?.done ? `<span class="pill good">Done</span>` : s.date < t ? `<span class="pill warn">Missed</span>` : `<span class="pill">Planned</span>`}</td><td class="r">${lg?.rpe ?? "–"}</td><td class="r">${loadOf(lg) || "–"}</td></tr>`; };
  const extra = workoutsOf(u).filter((w) => String(w.id).startsWith("x")).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return `<div class="card"><div class="hd"><h2>Upcoming sessions</h2></div>${up.length ? `<div class="tablewrap"><table><thead><tr><th>Date</th><th>Time</th><th>Session</th><th>Type</th><th>Status</th><th class="r">RPE</th><th class="r">Load</th></tr></thead><tbody>${up.map(row).join("")}</tbody></table></div>` : `<p class="muted">Nothing planned. Use <b>Session</b> above or assign a program from the workout planner.</p>`}</div>
  <div class="card"><div class="hd"><h2>History</h2></div>${past.length ? `<div class="tablewrap"><table><thead><tr><th>Date</th><th>Time</th><th>Session</th><th>Type</th><th>Status</th><th class="r">RPE</th><th class="r">Load</th></tr></thead><tbody>${past.map(row).join("")}</tbody></table></div>` : `<p class="muted">No past sessions.</p>`}</div>
  ${extra.length ? `<div class="card"><div class="hd"><h2>Extra workouts logged by the athlete</h2></div><div class="list">${extra.map((w) => `<div class="li"><div class="grow"><div class="t">${esc(w.title || "Workout")}</div><div class="small muted">${esc(fmtDay(w.date))} · RPE ${esc(w.rpe ?? "–")} · ${esc(w.minutes ?? "–")} min${w.notes ? " · " + esc(w.notes) : ""}</div></div></div>`).join("")}</div></div>` : ""}`;
}
function athNotes(u) {
  const shared = vals(S.notes[u]?.notes).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const priv = vals(S.staffnotes[u]?.notes).sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const noteRow = (n, kind) => `<div class="li" style="align-items:flex-start"><div class="grow"><div class="row"><b>${esc(nameOf(n.by))}</b><span class="pill">${esc(n.kind || "General")}</span><span class="small faint">${esc(ago(n.at))}</span></div><p class="ai" translate="no" style="margin-top:4px">${esc(n.text)}</p></div>${n.by === S.uid || S.role === "owner" ? armBtn(`note-${kind}-${n.id}`, "Delete", "del-note", `data-u="${esc(u)}" data-kind="${kind}" data-id="${esc(n.id)}"`) : ""}</div>`;
  const form = (kind) => `<form class="stack" data-form="note" data-u="${esc(u)}" data-kind="${kind}" style="margin-top:12px"><textarea id="note_${kind}" name="text" required maxlength="2000" placeholder="${kind === "shared" ? "Visible to the athlete" : "Visible to staff only"}"></textarea><div class="row"><select id="notek_${kind}" name="kind" style="width:auto">${sel((kind === "shared" ? ["General", "Technical", "Motivation", "Training"] : ["Clinical", "Injury", "Behaviour", "Family", "General"]).map((x) => [x, x]))}</select><button class="btn primary" style="margin-inline-start:auto">Add note</button></div></form>`;
  return `<div class="grid g2"><div class="card"><div class="hd"><h2>Coach notes</h2><span class="pill good">Athlete can read</span></div>${shared.length ? `<div class="list">${shared.map((n) => noteRow(n, "shared")).join("")}</div>` : `<p class="muted">No notes yet.</p>`}${form("shared")}</div>
  <div class="card"><div class="hd"><h2>Staff-only notes</h2><span class="pill warn">Hidden from athlete</span></div>${priv.length ? `<div class="list">${priv.map((n) => noteRow(n, "staff")).join("")}</div>` : `<p class="muted">Clinical and internal notes go here.</p>`}${form("staff")}</div></div>`;
}
function athTests(u) {
  const res = testsOf(u); const defs = settings().tests;
  const used = defs.filter((d) => res.some((r) => r.test === d.id));
  return `<div class="card"><div class="hd"><h2>Record a result</h2></div><form class="form" data-form="test-one" data-u="${esc(u)}">
    <label class="f">Test<select id="to_test" name="test">${sel(defs.map((d) => [d.id, `${d.name} (${d.unit})`]))}</select></label>
    <label class="f">Result<input id="to_val" name="value" type="number" step="any" required></label>
    <label class="f">Date<input id="to_date" name="date" type="date" value="${today()}" required></label>
    <label class="f">Note<input id="to_note" name="note" maxlength="120"></label>
    <div class="formactions"><button class="btn primary">Save result</button></div></form></div>
  ${used.length ? `<div class="grid g2">${used.map((d) => { const pts = res.filter((r) => r.test === d.id); const b = best(pts, d.better); return `<div class="card"><div class="hd"><h3>${esc(d.name)}</h3>${b && d.better !== "none" ? `<span class="pill good">Best ${esc(b.value)} ${esc(d.unit)}</span>` : ""}</div>${lineChart(pts, d.unit)}<div class="list" style="margin-top:8px">${pts.slice().reverse().slice(0, 4).map((r) => `<div class="li small"><span class="grow">${esc(fmtDay(r.date))}${r.note ? " · " + esc(r.note) : ""}</span><b class="num">${esc(r.value)} ${esc(d.unit)}</b>${armBtn("t-" + r.id, "Delete", "del-test", `data-u="${esc(u)}" data-id="${esc(r.id)}"`)}</div>`).join("")}</div></div>`; }).join("")}</div>` : `<div class="card">${empty("gauge", "No test results yet", "Record one above, or test the whole squad from the Testing page.")}</div>`}`;
}
function athNutrition(u) { watchMeals(u); return nutritionDays(u, true); }
function athPay(u) {
  const ch = chargesOf(u);
  return `<div class="card"><div class="hd"><h2>Charges</h2><span class="pill ${balanceOf(u) > 0 ? "warn" : "good"}">Balance ${esc(money(balanceOf(u)))}</span></div>${chargeTable(ch, false)}</div>${chargeForm(u)}`;
}
function athProfile(u) {
  const a = S.athletes[u]; const r = S.roster[u] || {}; const s = settings();
  const staffOpts = [["", "Not assigned"], ...Object.keys(S.staff).map((id) => [id, nameOf(id)])];
  return `<div class="grid g2"><div class="card"><div class="hd"><h2>Athlete's details</h2><span class="small faint">Written by the athlete</span></div><dl class="kv">
    <dt>Name</dt><dd>${esc(a.name)}</dd><dt>Sport</dt><dd>${esc(a.sport || "–")}</dd><dt>Position</dt><dd>${esc(a.position || "–")}</dd>
    <dt>Date of birth</dt><dd>${esc(a.dob ? fmtDay(a.dob, { day: "numeric", month: "long", year: "numeric" }) : "–")}</dd><dt>Phone</dt><dd>${esc(a.phone || "–")}</dd>
    <dt>Guardian</dt><dd>${esc(a.guardian || "–")}</dd><dt>Emergency</dt><dd>${esc(a.emergency || "–")}</dd>
    <dt>Consent</dt><dd>${a.consent ? `Given ${esc(fmtTs(a.consent.at))} (terms ${esc(a.consent.version)})${a.minor ? ", with guardian" : ""}` : "Not recorded"}</dd></dl></div>
  <div class="card"><div class="hd"><h2>Academy status</h2></div><form class="form" data-form="roster" data-u="${esc(u)}">
    <label class="f">Status<select id="ro_status" name="status">${sel([["active", "Active"], ["paused", "Paused"], ["archived", "Archived"]], r.status || "active")}</select></label>
    <label class="f">Group<input id="ro_group" name="group" list="groups" maxlength="40" value="${esc(r.group || "")}"><datalist id="groups">${s.groups.map((g) => `<option value="${esc(g)}">`).join("")}</datalist></label>
    <label class="f">Lead coach<select id="ro_coach" name="coach">${sel(staffOpts, r.coach || "")}</select></label>
    <label class="f">Joined<input id="ro_joined" name="joined" type="date" value="${esc(r.joined || (a.createdAt || "").slice(0, 10))}"></label>
    <div class="formactions"><button class="btn primary">Save</button></div></form></div></div>
  <div class="card"><div class="hd"><h2>Remove athlete's records</h2></div><p class="muted">Deletes this athlete's profile, plan, logs, notes, tests, meals and messages${S.role === "owner" ? " and payments" : ""}. Their sign-in to this academy stops working at once. This can't be undone; download their data first if you need a copy.</p>
  <div class="row" style="margin-top:10px"><button class="btn" data-act="export-athlete" data-u="${esc(u)}">${icon("download")}Download their data</button>${armBtn("rm-" + u, "Remove athlete and records", "remove-athlete", `data-u="${esc(u)}"`)}</div></div>`;
}
