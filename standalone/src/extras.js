/* ================= reports · calendar sync · quick actions ================= */
Object.assign(IC, {
  report: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6M9 9h2"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-3M7 14h10v7H7z"/>',
});
NAV.staff[2][1].unshift(["reports", "Reports", "report"]);
NAV.athlete[0][1].push(["reports", "My report", "report"]);

/* ---------- report data ---------- */
function inRange(d, r) { return d && d >= r.from && d <= r.to; }
function athleteStats(u, r) {
  const ses = sessionsOf(u).filter((s) => inRange(s.date, r) && s.date <= today());
  const done = ses.filter((s) => logOf(u, s.id)?.done);
  const logs = workoutsOf(u).filter((w) => w.done && inRange(w.date, r));
  const load = logs.reduce((a, w) => a + loadOf(w), 0); const mins = logs.reduce((a, w) => a + (Number(w.minutes) || 0), 0);
  const rpe = logs.filter((w) => w.rpe).map((w) => Number(w.rpe));
  const pain = logs.filter((w) => w.pain && w.pain !== "none").length;
  const mealDays = Object.entries(S.logs[u]?.meals || {}).filter(([d]) => inRange(d, r));
  return { planned: ses.length, done: done.length, pct: ses.length ? Math.round((done.length / ses.length) * 100) : null, missed: ses.length - done.length, workouts: logs.length, minutes: mins, load, rpe: rpe.length ? Math.round((rpe.reduce((a, b) => a + b, 0) / rpe.length) * 10) / 10 : null, pain, mealDays: mealDays.length, meals: mealDays.reduce((a, [, n]) => a + (Number(n) || 0), 0) };
}
function reportScope() { const r = { from: S.sel.rFrom || addDays(today(), -29), to: S.sel.rTo || today() }; return r; }
function reportAthletes() { if (!isStaff()) return [S.uid]; const who = S.sel.rWho || "all"; return who === "all" ? athleteIds() : who.startsWith("g:") ? athleteIds().filter((u) => S.roster[u]?.group === who.slice(2)) : [who]; }
const REPORTS = {
  attendance: { label: "Attendance & training load", cols: ["Athlete", "Planned", "Completed", "Attendance %", "Missed", "Workouts logged", "Minutes", "Load (RPE×min)", "Avg RPE", "Pain reports"], rows: (r) => reportAthletes().map((u) => { const s = athleteStats(u, r); return [nameOf(u), s.planned, s.done, s.pct == null ? "–" : s.pct + "%", s.missed, s.workouts, s.minutes, s.load, s.rpe ?? "–", s.pain]; }) },
  tests: { label: "Test results", cols: ["Athlete", "Test", "Latest", "Date", "Best", "Previous", "Change %"], rows: (r) => reportAthletes().flatMap((u) => settings().tests.map((d) => { const all = testsOf(u).filter((x) => x.test === d.id); const inR = all.filter((x) => inRange(x.date, r)); if (!inR.length) return null; const last = inR[inR.length - 1]; const prev = all[all.indexOf(last) - 1]; const b = best(all, d.better); const ch = prev ? (((last.value - prev.value) / Math.abs(prev.value || 1)) * 100).toFixed(1) + "%" : "–"; return [nameOf(u), `${tr(d.name)} (${d.unit})`, last.value, last.date, b ? b.value : "–", prev ? prev.value : "–", ch]; }).filter(Boolean)) },
  nutrition: { label: "Nutrition logging", cols: ["Athlete", "Days with meals", "Meals logged", "Days in range", "Logging %"], rows: (r) => { const days = Math.round((parseDay(r.to) - parseDay(r.from)) / 864e5) + 1; return reportAthletes().map((u) => { const s = athleteStats(u, r); return [nameOf(u), s.mealDays, s.meals, days, Math.round((s.mealDays / days) * 100) + "%"]; }); } },
  payments: { owner: true, label: "Payments", cols: ["Athlete", "Charged", "Paid", "Outstanding", "Overdue charges"], rows: (r) => reportAthletes().map((u) => { const ch = chargesOf(u).filter((c) => !c.due || inRange(c.due, r) || !c.paid); const sum = (f) => ch.filter(f).reduce((a, c) => a + (Number(c.amount) || 0), 0); return [nameOf(u), money(sum(() => true)), money(sum((c) => c.paid)), money(sum((c) => !c.paid)), ch.filter((c) => !c.paid && c.due && c.due < today()).length]; }) },
  athlete: { label: "Athlete report", single: true },
};
function availableReports() { return Object.entries(REPORTS).filter(([, v]) => !v.owner || S.role === "owner"); }

function athleteReportHtml(u, r) {
  const a = S.athletes[u] || {}; const s = athleteStats(u, r); const wl = weeklyLoads(u, 8);
  const tests = settings().tests.map((d) => { const pts = testsOf(u).filter((x) => x.test === d.id); return pts.length ? { d, pts, b: best(pts, d.better), last: pts[pts.length - 1] } : null; }).filter(Boolean);
  const notes = vals(S.notes[u]?.notes).filter((n) => inRange((n.at || "").slice(0, 10), r)).sort((x, y) => (y.at || "").localeCompare(x.at || "")).slice(0, 8);
  const ses = sessionsOf(u).filter((x) => inRange(x.date, r));
  return `<div class="card report"><div class="hd"><h2 translate="no">${esc(a.name || nameOf(u))}</h2><span class="pill">${esc(fmtDay(r.from, { day: "numeric", month: "short" }))} – ${esc(fmtDay(r.to, { day: "numeric", month: "short", year: "numeric" }))}</span></div>
    <p class="small muted">${esc(settings().name)}${a.sport ? " · " + esc(a.sport) : ""}${S.roster[u]?.group ? " · " + esc(S.roster[u].group) : ""}</p>
    <div class="grid g4" style="margin-top:12px">
      <div class="stat"><span class="k">Attendance</span><span class="v">${s.pct == null ? "–" : s.pct + "%"}</span><span class="s">${s.done} of ${s.planned} sessions</span></div>
      <div class="stat"><span class="k">Training load</span><span class="v">${s.load}</span><span class="s">${s.minutes} minutes</span></div>
      <div class="stat"><span class="k">Average effort</span><span class="v">${s.rpe ?? "–"}</span><span class="s">RPE</span></div>
      <div class="stat"><span class="k">Nutrition</span><span class="v">${s.mealDays}</span><span class="s">days with meals logged</span></div>
    </div>
    <h3 style="margin-top:16px">Weekly load</h3>${barChart(wl.map((w) => ({ label: fmtDay(w.week, { day: "numeric", month: "short" }), value: w.load })))}
    ${tests.length ? `<h3 style="margin-top:12px">Tests</h3><div class="tablewrap"><table><thead><tr><th>Test</th><th class="r">Latest</th><th class="r">Best</th><th>Date</th></tr></thead><tbody>${tests.map((t) => `<tr><td>${esc(tr(t.d.name))}</td><td class="r">${esc(t.last.value)} ${esc(t.d.unit)}</td><td class="r">${t.b ? esc(t.b.value) + " " + esc(t.d.unit) : "–"}</td><td class="small muted">${esc(fmtDay(t.last.date))}</td></tr>`).join("")}</tbody></table></div>` : ""}
    ${ses.length ? `<h3 style="margin-top:12px">Sessions</h3><div class="tablewrap"><table><thead><tr><th>Date</th><th>Session</th><th>Status</th><th class="r">RPE</th><th class="r">Load</th></tr></thead><tbody>${ses.map((x) => { const l = logOf(u, x.id); return `<tr><td>${esc(fmtDay(x.date))}</td><td translate="no">${esc(x.title || x.type)}</td><td>${l?.done ? `<span class="pill good">Done</span>` : x.date < today() ? `<span class="pill warn">Missed</span>` : `<span class="pill">Planned</span>`}</td><td class="r">${l?.rpe ?? "–"}</td><td class="r">${loadOf(l) || "–"}</td></tr>`; }).join("")}</tbody></table></div>` : ""}
    ${notes.length ? `<h3 style="margin-top:12px">Coach notes</h3><div class="list">${notes.map((n) => `<div class="li" style="align-items:flex-start"><div class="grow"><div class="small muted">${esc(nameOf(n.by))} · ${esc(fmtDay((n.at || "").slice(0, 10)))}</div><p class="ai" translate="no">${esc(n.text)}</p></div></div>`).join("")}</div>` : ""}
  </div>`;
}
function athleteReportRows(u, r) {
  const s = athleteStats(u, r); const rows = [["Report", "Athlete report"], ["Athlete", nameOf(u)], ["From", r.from], ["To", r.to], ["Sessions planned", s.planned], ["Sessions completed", s.done], ["Attendance %", s.pct ?? ""], ["Minutes", s.minutes], ["Load (RPE×min)", s.load], ["Average RPE", s.rpe ?? ""], ["Pain reports", s.pain], ["Days with meals", s.mealDays], [], ["Date", "Session", "Done", "RPE", "Minutes", "Load"]];
  sessionsOf(u).filter((x) => inRange(x.date, r)).forEach((x) => { const l = logOf(u, x.id); rows.push([x.date, x.title || x.type, l?.done ? "yes" : "no", l?.rpe ?? "", l?.minutes ?? "", loadOf(l) || ""]); });
  rows.push([], ["Test", "Value", "Unit", "Date"]); testsOf(u).filter((x) => inRange(x.date, r)).forEach((x) => { const d = testDef(x.test); rows.push([d.name, x.value, d.unit, x.date]); });
  return rows;
}
function toCsv(rows) { return "\ufeff" + rows.map((row) => row.map((x) => { let s = String(x ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; }).join(",")).join("\r\n"); }

VIEWS.reports = {
  meta: () => ({ title: isStaff() ? "Reports" : "My report", sub: isStaff() ? "Export attendance, load, tests, nutrition and payments" : "Your training, tests and nutrition in one report", actions: `<button class="btn" data-act="report-csv">${icon("download")}Excel (CSV)</button><button class="btn primary" data-act="report-print">${icon("print")}Print / PDF</button>` }),
  body: () => {
    const r = reportScope(); const kind = isStaff() ? (S.sel.rKind && REPORTS[S.sel.rKind] && (!REPORTS[S.sel.rKind].owner || S.role === "owner") ? S.sel.rKind : "attendance") : "athlete";
    const groups = settings().groups; const ids = athleteIds();
    const ranges = [["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["365", "Last 12 months"]];
    const controls = `<div class="card noprint"><div class="form">
      ${isStaff() ? `<label class="f">Report<select id="r_kind" data-change="rKind">${sel(availableReports().map(([k, v]) => [k, v.label]), kind)}</select></label>
      <label class="f">${kind === "athlete" ? "Athlete" : "Athletes"}<select id="r_who" data-change="rWho">${sel([...(kind === "athlete" ? [] : [["all", "All active athletes"], ...groups.map((g) => ["g:" + g, "Group: " + g])]), ...ids.map((u) => [u, nameOf(u)])], S.sel.rWho || (kind === "athlete" ? ids[0] : "all"))}</select></label>` : ""}
      <label class="f">Period<select id="r_range" data-change="rRange">${sel([...ranges, ["custom", "Custom dates"]], S.sel.rRange || "30")}</select></label>
      <label class="f">From<input id="r_from" type="date" data-change="rFrom" value="${esc(r.from)}" max="${esc(r.to)}"></label>
      <label class="f">To<input id="r_to" type="date" data-change="rTo" value="${esc(r.to)}"></label>
    </div></div>`;
    if (kind === "athlete") { const u = isStaff() ? (S.sel.rWho && S.athletes[S.sel.rWho] ? S.sel.rWho : ids[0]) : S.uid; return controls + (u ? athleteReportHtml(u, r) : `<div class="card">${empty("users", "No athletes yet", "")}</div>`); }
    const rep = REPORTS[kind]; const rows = rep.rows(r);
    return controls + `<div class="card report"><div class="hd"><h2>${esc(rep.label)}</h2><span class="pill">${esc(fmtDay(r.from, { day: "numeric", month: "short" }))} – ${esc(fmtDay(r.to, { day: "numeric", month: "short", year: "numeric" }))}</span></div><p class="small muted">${esc(settings().name)} · ${rows.length} rows</p>
      ${rows.length ? `<div class="tablewrap" style="margin-top:8px"><table><thead><tr>${rep.cols.map((c, i) => `<th${i ? ' class="r"' : ""}>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((c, i) => `<td${i ? ' class="r"' : ""}${i === 0 ? ' translate="no"' : ""}>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : `<p class="muted" style="margin-top:8px">No data for this period.</p>`}</div>`;
  },
};
document.addEventListener("change", (e) => {
  const el = e.target; const c = el.dataset && el.dataset.change; if (!c || !["rKind", "rWho", "rRange", "rFrom", "rTo"].includes(c)) return;
  if (c === "rRange") { S.sel.rRange = el.value; if (el.value !== "custom") { S.sel.rTo = today(); S.sel.rFrom = addDays(today(), -(Number(el.value) - 1)); } }
  else if (c === "rFrom" || c === "rTo") { if (isDay(el.value)) { S.sel[c] = el.value; S.sel.rRange = "custom"; } }
  else { S.sel[c] = el.value; if (c === "rKind") S.sel.rWho = el.value === "athlete" ? athleteIds()[0] : "all"; }
  S.dirty.clear(); render();
}, true);
ACTIONS["report-print"] = () => { document.body.classList.add("printing"); setTimeout(() => { try { window.print(); } finally { setTimeout(() => document.body.classList.remove("printing"), 500); } }, 50); };
ACTIONS["report-csv"] = () => {
  const r = reportScope(); const kind = isStaff() ? (S.sel.rKind || "attendance") : "athlete";
  let rows, name;
  if (kind === "athlete") { const u = isStaff() ? (S.sel.rWho && S.athletes[S.sel.rWho] ? S.sel.rWho : athleteIds()[0]) : S.uid; if (!u) return; rows = athleteReportRows(u, r); name = `report-${(nameOf(u) || "athlete").replace(/[^\w\u0590-\u05FF-]+/g, "-")}`; }
  else { const rep = REPORTS[kind]; rows = [rep.cols, ...rep.rows(r)]; name = `report-${kind}`; }
  saveFile(`${name}-${r.from}_${r.to}.csv`, toCsv(rows));
};

/* ---------- calendar sync ---------- */
function icsFor(sessions, calName) {
  const e = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const tz = settings().timezone || "Asia/Jerusalem"; const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Performance360 Academy//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${e(calName)}`];
  for (const s of sessions) {
    const d = s.date.replace(/-/g, ""); L.push("BEGIN:VEVENT", `UID:${s.id}@performance360.academy`, `DTSTAMP:${stamp}`);
    if (/^\d{2}:\d{2}$/.test(s.time || "")) { const [h, m] = s.time.split(":").map(Number); const end = new Date(2000, 0, 1, h, m + (Number(s.minutes) || 60)); const ed = addDays(s.date, end.getDate() - 1).replace(/-/g, ""); L.push(`DTSTART;TZID=${tz}:${d}T${s.time.replace(":", "")}00`, `DTEND;TZID=${tz}:${ed}T${pad(end.getHours())}${pad(end.getMinutes())}00`); }
    else L.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${addDays(s.date, 1).replace(/-/g, "")}`);
    L.push(`SUMMARY:${e(s.title || s.type || "Training")}`); if (s.location) L.push(`LOCATION:${e(s.location)}`);
    const desc = [s.notes || "", ...(s.items || []).slice(0, 30).map((i) => `• ${i.ex}${i.sets ? ` ${i.sets}×${i.reps || ""}` : ""}${i.load ? ` @ ${i.load}` : ""}`)].filter(Boolean).join("\n"); if (desc) L.push(`DESCRIPTION:${e(desc)}`);
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR"); return L.join("\r\n") + "\r\n";
}
function mySessionsForCalendar() { const from = addDays(today(), -7); return isStaff() ? groupSessions(allSessions().filter((s) => s.date >= from)) : sessionsOf(S.uid).filter((s) => s.date >= from); }
function calSyncModal(m) {
  const feed = m.token ? `${APPCFG.url.replace(/\/$/, "")}/functions/v1/academy-ical?t=${m.token}` : "";
  const webcal = feed.replace(/^https:/, "webcal:");
  return `<div class="hd"><h2>${icon("sync")} Sync with your calendar</h2><button class="iconbtn" data-act="modal-close" aria-label="Close">${icon("x")}</button></div>
  <p class="muted">${isStaff() ? "All academy sessions" : "Your training sessions"} appear in your phone's calendar and update by themselves when the plan changes.</p>
  ${!m.token ? `<div class="row"><span class="spinner"></span></div>` : `
  <div class="stack"><a class="btn primary big" href="${esc(webcal)}">${icon("cal")}Add to iPhone / Mac calendar</a>
    <a class="btn big" href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}" target="_blank" rel="noopener noreferrer">Add to Google Calendar</a></div>
  <label class="f">Calendar link (for Outlook or other apps)<div class="row" style="flex-wrap:nowrap"><input id="cal_url" readonly value="${esc(feed)}" translate="no" style="direction:ltr;font-size:13px"><button class="btn sm" data-act="copy-text" data-t="${esc(feed)}">Copy</button></div></label>
  <p class="small muted">Keep this link private: anyone with it can see the schedule. If it reaches the wrong person, create a new link; the old one stops working.</p>
  <div class="row"><button class="btn" data-act="cal-ics">${icon("download")}Download calendar file (.ics)</button>${armBtn("cal-renew", "New link", "cal-renew")}</div>`}`;
}
ACTIONS["cal-sync"] = async () => {
  S.modal = { kind: "cal-sync", token: S.calToken || "" }; render();
  if (!S.calToken) { try { S.calToken = await rpc("acad_cal_token", { a: S.academy.id, renew: false }); if (S.modal?.kind === "cal-sync") S.modal.token = S.calToken; render(); } catch (e) { toast(errText(e), true); } }
};
ACTIONS["cal-renew"] = async () => { try { S.calToken = await rpc("acad_cal_token", { a: S.academy.id, renew: true }); S.modal = { kind: "cal-sync", token: S.calToken }; toast("New calendar link created. Add it again in your calendar."); render(); } catch (e) { toast(errText(e), true); } };
ACTIONS["cal-ics"] = () => saveFile(`${(settings().name || "academy").replace(/[^\w\u0590-\u05FF-]+/g, "-")}-training.ics`, icsFor(mySessionsForCalendar(), settings().name + " · Performance360"));
ACTIONS["cal-one"] = (d) => { const s = (isStaff() ? S.plan[d.u] : S.plan[S.uid])?.sessions?.[d.sid]; if (s) saveFile(`${(s.title || "session").replace(/[^\w\u0590-\u05FF-]+/g, "-")}-${s.date}.ics`, icsFor([{ ...s, id: d.sid }], settings().name)); };
const _calMeta = VIEWS.calendar.meta;
VIEWS.calendar.meta = () => { const m = _calMeta(); m.actions = `<button class="btn" data-act="cal-sync">${icon("sync")}Sync calendar</button>` + (m.actions || ""); return m; };
// "Add to calendar" on a session
const _sessDetail = sessionDetailModal;
sessionDetailModal = function (m) { return _sessDetail(m) + `<div class="row"><button class="btn sm" data-act="cal-one" data-sid="${esc(m.sid)}" data-u="${esc(m.u)}">${icon("cal")}Add to my calendar</button></div>`; };
const _trackerBody = VIEWS.tracker.body;
VIEWS.tracker.body = () => { const html = _trackerBody(); const sid = (html.match(/data-form="log" data-sid="([^"]+)"/) || [])[1]; return sid ? html.replace('<form class="card stack" data-form="log"', `<div class="row noprint" style="justify-content:flex-end"><button class="btn sm" data-act="cal-one" data-sid="${esc(sid)}">${icon("cal")}Add to my calendar</button><button class="btn sm" data-act="cal-sync">${icon("sync")}Sync calendar</button></div><form class="card stack" data-form="log"`) : html; };

/* ---------- quick actions ---------- */
function quickActions() {
  if (isStaff()) return [
    ["new-session", "New session", "cal", {}], ["add-person", "Add athlete", "users", { role: "athlete" }], ["prog-new-go", "New workout", "plan", {}], ["prog-ai-go", "Build workout with assistant", "spark", {}],
    ["go", "Post update", "megaphone", { v: "updates" }], ["go", "Record test results", "gauge", { v: "testing" }], ["go", "Messages", "chat", { v: "messages" }],
    ...(S.role === "owner" ? [["go", "Add a charge", "card", { v: "payments" }]] : []), ["go", "Export a report", "report", { v: "reports" }], ["cal-sync", "Sync calendar", "sync", {}],
  ];
  return [["go", "Log today's workout", "dumbbell", { v: "tracker" }], ["go", "Add a meal", "camera", { v: "nutrition" }], ["thread-me", "Message my coach", "chat", {}], ["go", "My training calendar", "cal", { v: "calendar" }], ["go", "My report", "report", { v: "reports" }], ["cal-sync", "Sync calendar", "sync", {}]];
}
function quickModal() {
  return `<div class="hd"><h2>${icon("bolt")} Quick actions</h2><button class="iconbtn" data-act="modal-close" aria-label="Close">${icon("x")}</button></div>
  <div class="qa">${quickActions().map(([a, l, ic, data]) => `<button class="qa-item" data-act="qa" data-a="${a}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")}><span class="qa-ic">${icon(ic)}</span><span>${esc(l)}</span></button>`).join("")}</div>`;
}
ACTIONS["quick"] = () => { S.modal = { kind: "quick" }; render(); };
ACTIONS["qa"] = (d) => {
  S.modal = null; const a = d.a;
  if (a === "go") return go(d.v);
  if (a === "new-session") { S.modal = { kind: "session", date: today(), u: "" }; return render(); }
  if (a === "add-person") { S.modal = { kind: "add-person", role: d.role || "athlete" }; return render(); }
  if (a === "prog-new-go") { go("planner"); return ACTIONS["prog-new"](); }
  if (a === "prog-ai-go") { go("planner"); return ACTIONS["prog-ai"](); }
  if (a === "thread-me") return go("messages");
  if (a === "cal-sync") return ACTIONS["cal-sync"]();
  render();
};
const _modalHtml3 = modalHtml;
modalHtml = function () {
  if (S.modal && (S.modal.kind === "quick" || S.modal.kind === "cal-sync")) return `<div class="modal" data-act="modal-bg" role="dialog" aria-modal="true"><div class="box">${S.modal.kind === "quick" ? quickModal() : calSyncModal(S.modal)}</div></div>`;
  return _modalHtml3();
};
const _tabBar = tabBar;
tabBar = function () { return _tabBar() + `<button class="fab noprint" data-act="quick" aria-label="Quick actions" title="Quick actions">${icon("bolt")}</button>`; };
