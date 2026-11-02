/* ---------- calendar ---------- */
VIEWS.calendar = {
  meta: () => ({ title: "Training calendar", sub: isStaff() ? "All athletes" : "Your sessions", actions: isStaff() ? `<button class="btn primary" data-act="new-session" data-date="${esc(S.sel.calDay || today())}">${icon("plus")}New session</button>` : "" }),
  body: () => {
    const month = S.sel.calMonth || today().slice(0, 7);
    const first = parseDay(month + "-01"); const start = weekStart(iso(first));
    const sessions = isStaff() ? allSessions() : sessionsOf(S.uid);
    const fAth = isStaff() ? S.sel.calAth || "" : "";
    const list = fAth ? sessions.filter((s) => s.athlete === fAth || (S.roster[s.athlete]?.group && "g:" + S.roster[s.athlete].group === fAth)) : sessions;
    const byDay = {}; for (const g of isStaff() ? groupSessions(list) : list) (byDay[g.date] ||= []).push(g);
    const ws = settings().weekStart === "mon" ? 1 : 0;
    const dn = [0, 1, 2, 3, 4, 5, 6].map((i) => new Date(2023, 0, 1 + ((i + ws) % 7)).toLocaleDateString(LOC(), { weekday: "short" }));
    const selDay = S.sel.calDay || today(); const t = today();
    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i); if (i >= 35 && d.slice(0, 7) !== month) break;
      const evs = byDay[d] || [];
      cells += `<div class="d${d.slice(0, 7) !== month ? " out" : ""}${d === t ? " today" : ""}${d === selDay ? " sel" : ""}" data-act="cal-day" data-d="${d}"><span class="dn">${parseDay(d).getDate()}</span>${evs.slice(0, 3).map((e) => `<button class="ev${(isStaff() ? e.athletes.every((u) => logOf(u, e.id)?.done) : logOf(S.uid, e.id)?.done) ? " done" : ""}" data-act="${isStaff() ? "open-session" : "track"}" data-sid="${esc(e.id)}" data-u="${esc(isStaff() ? e.athletes[0] : S.uid)}">${esc((e.time ? e.time + " " : "") + (e.title || e.type))}</button>`).join("")}${evs.length > 3 ? `<span class="more">+${evs.length - 3} more</span>` : ""}</div>`;
    }
    const dayList = byDay[selDay] || [];
    const groups = settings().groups;
    return `<div class="card"><div class="row" style="margin-bottom:12px"><button class="iconbtn" data-act="cal-move" data-n="-1" aria-label="Previous month">${icon(RTL() ? "right" : "left")}</button><h2 style="min-width:150px;text-align:center">${esc(first.toLocaleDateString(LOC(), { month: "long", year: "numeric" }))}</h2><button class="iconbtn" data-act="cal-move" data-n="1" aria-label="Next month">${icon(RTL() ? "left" : "right")}</button><button class="btn sm" data-act="cal-today">Today</button>
      ${isStaff() ? `<select id="calAth" data-change="calAth" style="width:auto;margin-inline-start:auto">${sel([["", "Everyone"], ...groups.map((g) => ["g:" + g, "Group: " + g]), ...athleteIds().map((u) => [u, nameOf(u)])], fAth)}</select>` : ""}</div>
      <div class="cal">${dn.map((d) => `<div class="dh">${esc(d)}</div>`).join("")}${cells}</div></div>
      <div class="card"><div class="hd"><h2>${esc(fmtDay(selDay, { weekday: "long", day: "numeric", month: "long" }))}</h2>${isStaff() ? `<button class="btn sm primary" data-act="new-session" data-date="${selDay}">${icon("plus")}Add</button>` : ""}</div>
      ${dayList.length ? `<div class="stack">${dayList.map((g) => (isStaff() ? sessionCard(g) : athleteSessionRow(g))).join("")}</div>` : `<p class="muted">No sessions on this day.</p>`}</div>`;
  },
};

/* session form + detail (modals) */
function sessionFormModal(m) {
  const s = settings(); const progs = vals(S.programs);
  const progOpts = [["", "No workout, write exercises below"], ...progs.map((p) => [p.id, p.name || "Workout"])];
  const ex = m.edit;
  return `<div class="hd"><h2>${ex ? "Edit session" : "New session"}</h2><button class="iconbtn" data-act="modal-close" aria-label="Close">${icon("x")}</button></div>
  <form class="form" data-form="session" data-sid="${esc(ex?.id || "")}" data-u="${esc(ex?.athlete || "")}">
    ${ex ? `<p class="full small muted">Changes apply to everyone booked into this session.</p>` : `<label class="f full">Who<select id="ss_who" name="who">${sel([...athleteIds().map((u) => [u, nameOf(u)]), ...s.groups.map((g) => ["g:" + g, `Group: ${g}`]), ["all", "All active athletes"]], m.u || "")}</select></label>`}
    <label class="f">Title<input id="ss_title" name="title" maxlength="80" value="${esc(ex?.title || "")}" placeholder="e.g. Lower body strength"></label>
    <label class="f">Type<select id="ss_type" name="type">${sel(s.types.map((t) => [t, t]), ex?.type || s.types[0])}</select></label>
    <label class="f">Date<input id="ss_date" name="date" type="date" required value="${esc(ex?.date || m.date || today())}"></label>
    <label class="f">Start<input id="ss_time" name="time" type="time" value="${esc(ex?.time || "16:00")}"></label>
    <label class="f">Minutes<input id="ss_min" name="minutes" type="number" min="5" max="480" value="${esc(ex?.minutes || s.defaultMinutes)}"></label>
    <label class="f">Location<input id="ss_loc" name="location" maxlength="60" value="${esc(ex?.location || "")}"></label>
    ${ex ? "" : `<label class="f full">From a saved workout<select id="ss_prog" name="prog">${sel(progOpts)}</select></label>`}
    <label class="f full">Exercises (one per line: name; sets x reps; load)<textarea id="ss_items" name="items" rows="5" placeholder="Goblet Squat; 3x8; 16 kg&#10;Nordic Hamstring Curl; 3x5">${esc((ex?.items || []).map((i) => [i.ex, i.sets && i.reps ? `${i.sets}x${i.reps}` : i.reps || "", i.load || ""].filter(Boolean).join("; ")).join("\n"))}</textarea></label>
    <label class="f full">Notes for the athlete<textarea id="ss_notes" name="notes" maxlength="1000">${esc(ex?.notes || "")}</textarea></label>
    <div class="formactions"><button type="button" class="btn" data-act="modal-close">Cancel</button><button class="btn primary">${ex ? "Save changes" : "Create session"}</button></div>
  </form>`;
}
function parseItems(text) {
  return String(text || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 40).map((l) => {
    const [ex, sr = "", load = "", ...rest] = l.split(";").map((x) => x.trim());
    const m = sr.match(/^(\d+)\s*[x×]\s*(.+)$/i);
    return { ex: clampStr(ex, 80), sets: m ? Number(m[1]) : null, reps: clampStr(m ? m[2] : sr, 20), load: clampStr(load, 30), note: clampStr(rest.join("; "), 120) };
  });
}
function sessionDetailModal(m) {
  const ids = Object.keys(S.plan).filter((u) => S.plan[u]?.sessions?.[m.sid]);
  const s = S.plan[m.u]?.sessions?.[m.sid] || (ids[0] && S.plan[ids[0]].sessions[m.sid]);
  if (!s) return `<div class="hd"><h2>Session removed</h2><button class="iconbtn" data-act="modal-close">${icon("x")}</button></div>`;
  return `<div class="hd"><h2>${esc(s.title || s.type)}</h2><button class="iconbtn" data-act="modal-close" aria-label="Close">${icon("x")}</button></div>
  <div class="row"><span class="pill brand">${esc(s.type || "")}</span><span>${esc(fmtDay(s.date, { weekday: "long", day: "numeric", month: "long" }))} ${esc(s.time || "")}</span>${s.minutes ? `<span class="muted">${esc(s.minutes)} min</span>` : ""}${s.location ? `<span class="muted">${esc(s.location)}</span>` : ""}</div>
  ${s.notes ? `<p class="ai muted" translate="no">${esc(s.notes)}</p>` : ""}
  ${(s.items || []).length ? `<div>${s.items.map(exerciseRow).join("")}</div>` : ""}
  <div><h3 style="margin-bottom:6px">Athletes (${ids.length})</h3><div class="list">${ids.map((u) => { const lg = logOf(u, m.sid); return `<div class="li">${av(u, true)}<div class="grow"><div class="t">${esc(nameOf(u))}</div>${lg ? `<div class="small muted">RPE ${esc(lg.rpe ?? "–")} · ${esc(lg.minutes ?? "–")} min${lg.feel ? " · feel " + esc(lg.feel) + "/5" : ""}${lg.notes ? " · " + esc(lg.notes) : ""}</div>` : ""}</div>${lg?.done ? `<span class="pill good">Done</span>` : `<span class="pill">Not logged</span>`}${ids.length > 1 ? `<button class="btn sm ghost" data-act="unbook" data-u="${esc(u)}" data-sid="${esc(m.sid)}">Remove</button>` : ""}</div>`; }).join("")}</div></div>
  <div class="row"><button class="btn" data-act="edit-session" data-sid="${esc(m.sid)}" data-u="${esc(ids[0] || m.u)}">Edit</button>${armBtn("sess-" + m.sid, "Delete session", "del-session", `data-sid="${esc(m.sid)}"`)}</div>`;
}
function exerciseRow(i) {
  const lib = findExercise(i.ex); const url = lib ? videoUrl(lib.v) : "";
  return `<div class="ex"><div><b translate="no">${esc(i.ex)}</b>${i.note ? `<div class="small muted">${esc(i.note)}</div>` : ""}${lib ? `<div class="small faint" translate="no">${esc(lib.p || lib.c)}</div>` : ""}</div><div class="row" style="justify-content:flex-end"><span class="num">${esc(i.sets ? i.sets + " × " + i.reps : i.reps || "")}</span>${i.load ? `<span class="pill">${esc(i.load)}</span>` : ""}${url ? `<a class="btn sm ghost" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon("play")}Video</a>` : ""}</div></div>`;
}

/* ---------- messages ---------- */
VIEWS.messages = {
  meta: () => ({ title: "Messages", sub: isStaff() ? "Athlete conversations and the staff room" : "Your conversation with the academy staff" }),
  body: () => {
    if (!isStaff()) return `<div class="card">${threadHtml(S.uid)}</div>`;
    const cur = S.sel.thread || "staffroom";
    const ids = athleteIds(true).sort((a, b) => (S.inbox[b]?.lastAt || "").localeCompare(S.inbox[a]?.lastAt || ""));
    const q = (S.sel.mq || "").toLowerCase();
    return `<div class="chatgrid"><div class="card" style="padding:10px"><input id="mq" data-live="mq" placeholder="Find an athlete" value="${esc(S.sel.mq || "")}" style="margin-bottom:6px">
      <div class="list"><div class="li clickable" style="padding:8px" data-act="thread" data-u="staffroom"><span class="av sm">${icon("badge")}</span><div class="grow"><div class="t">Staff room</div><div class="small muted">Coaches and physios only</div></div>${staffroomUnread() ? `<span class="badge">${staffroomUnread()}</span>` : ""}</div>
      ${ids.filter((u) => !q || nameOf(u).toLowerCase().includes(q)).map((u) => { const last = threadOf(u).slice(-1)[0]; const n = unreadFor(u); return `<div class="li clickable" style="padding:8px${cur === u ? ";background:var(--surface-2)" : ""}" data-act="thread" data-u="${esc(u)}">${av(u, true)}<div class="grow"><div class="t">${esc(nameOf(u))}</div><div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${last ? esc(last.text) : "No messages yet"}</div></div>${n ? `<span class="badge">${n}</span>` : ""}</div>`; }).join("")}</div></div>
      <div class="card"><div class="hd"><h2>${cur === "staffroom" ? "Staff room" : esc(nameOf(cur))}</h2>${cur !== "staffroom" ? `<button class="btn sm" data-act="open-athlete" data-u="${esc(cur)}">Profile</button>` : `<span class="pill warn">Hidden from athletes</span>`}</div>${threadHtml(cur)}</div></div>`;
  },
};
function threadHtml(u) {
  const msgs = u === "staffroom" ? vals(S.staffroom?.msgs).sort((a, b) => (a.at || "").localeCompare(b.at || "")) : threadOf(u);
  return `<div class="thread">${msgs.length ? msgs.slice(-200).map((m) => `<div class="msg${m.by === S.uid ? " mine" : ""}">${m.by !== S.uid ? `<div class="by">${esc(nameOf(m.by))}${m.from === "staff" && u !== "staffroom" ? " · staff" : ""}</div>` : ""}<span translate="no">${esc(m.text)}</span><div class="at">${esc(fmtTs(m.at))}</div></div>`).join("") : `<p class="muted" style="text-align:center;padding:24px">${u === "staffroom" ? "Share plans and updates with the staff." : isStaff() ? "Start the conversation." : "Send a message to your coaches and physiotherapists."}</p>`}</div>
  <form class="composer" data-form="msg" data-u="${esc(u)}"><textarea id="msg_${esc(u)}" name="text" required maxlength="2000" placeholder="Write a message" aria-label="Message"></textarea><button class="btn primary" aria-label="Send">${icon("send")}Send</button></form>`;
}

/* ---------- staff ---------- */
VIEWS.staff = {
  meta: () => ({ title: "Staff", sub: "Coaches and physiotherapists with access to athlete records" }),
  body: () => {
    const ids = Object.keys(S.staff).sort((a, b) => (S.staff[b].owner ? 1 : 0) - (S.staff[a].owner ? 1 : 0) || nameOf(a).localeCompare(nameOf(b)));
    return `<div class="card"><div class="tablewrap"><table><thead><tr><th>Name</th><th>Role</th><th>Title</th><th>Phone</th><th class="r">Athletes led</th><th>Joined</th>${S.role === "owner" ? "<th></th>" : ""}</tr></thead><tbody>
    ${ids.map((u) => { const s = S.staff[u]; const led = Object.values(S.roster).filter((r) => r && r.coach === u).length; return `<tr><td><span class="row" style="flex-wrap:nowrap">${av(u, true)}<b>${esc(nameOf(u))}</b>${u === S.uid ? '<span class="pill">You</span>' : ""}</span></td><td>${s.owner ? '<span class="pill brand">Owner · Coach</span>' : `<span class="pill ${s.role === "physio" ? "info" : "good"}">${s.role === "physio" ? "Physiotherapist" : "Coach"}</span>`}</td><td>${esc(s.title || "–")}</td><td>${esc(s.phone || "–")}</td><td class="r">${led}</td><td class="small muted">${esc(s.joined ? fmtDay(s.joined.slice(0, 10)) : "–")}</td>${S.role === "owner" ? `<td class="r">${s.owner ? "" : `<span class="row" style="justify-content:flex-end;flex-wrap:nowrap"><select data-change="staff-role" data-u="${esc(u)}" style="width:auto" aria-label="Role">${sel([["coach", "Coach"], ["physio", "Physiotherapist"]], s.role)}</select>${armBtn("st-" + u, "Remove", "remove-staff", `data-u="${esc(u)}"`)}</span>`}</td>` : ""}</tr>`; }).join("")}
    </tbody></table></div></div>
    <div class="grid g2"><div class="card"><h2>Add a coach or physiotherapist</h2><ol class="stack" style="padding-left:18px;margin:0">
      <li>Copy the <b>coach code</b> or <b>physiotherapist code</b> from Settings → Access & roles.</li><li>Send it to them privately, with this app's address.</li><li>They choose <b>Coach</b> or <b>Physiotherapist</b> on the sign-in screen, sign in with their email and enter the code.</li></ol>
      <p class="notice warn" style="margin-top:12px">Staff can see every athlete's records. Create a new code if one reaches the wrong person; the old one stops working.</p></div>
      <div class="card"><h2>What each role can do</h2><div class="tablewrap"><table><thead><tr><th></th><th>Owner</th><th>Coach</th><th>Physio</th><th>Athlete</th></tr></thead><tbody>
      ${[["Athlete records, plans, tests", "✓", "✓", "✓", "Own only"], ["Staff-only notes", "✓", "✓", "✓", "–"], ["Payments", "✓", "–", "–", "–"], ["Academy settings", "✓", "View", "View", "–"], ["Exercise library", "Edit", "Edit", "Edit", "View"], ["Staff room", "✓", "✓", "✓", "–"]].map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<td><b>${c}</b></td>`)).join("")}</tr>`).join("")}</tbody></table></div></div></div>`;
  },
};

/* ---------- planner ---------- */
VIEWS.planner = {
  meta: () => (S.edit.program ? { title: S.edit.program.name || "New program", sub: "Workout planner", actions: `<button class="btn" data-act="prog-cancel">Cancel</button><button class="btn primary" data-act="prog-save">Save program</button>` } : { title: "Workout planner", sub: "Build programs once, assign them to athletes or groups", actions: `<button class="btn primary" data-act="prog-new">${icon("plus")}New program</button>` }),
  body: () => {
    if (S.edit.program) return programEditor();
    const ps = vals(S.programs).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return ps.length ? `<div class="grid g3">${ps.map((p) => `<div class="card stack"><div class="hd"><h2>${esc(p.name)}</h2></div><p class="muted small">${esc(p.goal || "")}</p><div class="row"><span class="pill brand">${(p.days || []).length} days</span><span class="pill">${(p.days || []).reduce((a, d) => a + (d.items || []).length, 0)} exercises</span></div><p class="small faint">Updated ${esc(ago(p.updatedAt))} by ${esc(nameOf(p.by))}</p><div class="row"><button class="btn sm primary" data-act="prog-assign" data-id="${esc(p.id)}">Assign</button><button class="btn sm" data-act="prog-edit" data-id="${esc(p.id)}">Edit</button><button class="btn sm" data-act="prog-copy" data-id="${esc(p.id)}">Duplicate</button>${armBtn("pg-" + p.id, "Delete", "prog-del", `data-id="${esc(p.id)}"`)}</div></div>`).join("")}</div>`
      : `<div class="card">${empty("plan", "No programs yet", "Create a program with training days and exercises from your library, then assign it to athletes over several weeks.", `<button class="btn primary" data-act="prog-new">${icon("plus")}New program</button>`)}</div>`;
  },
};
function programEditor() {
  const p = S.edit.program;
  return `<div class="card"><div class="form"><label class="f">Program name<input id="pg_name" data-bind="name" maxlength="80" value="${esc(p.name)}"></label><label class="f">Goal<input id="pg_goal" data-bind="goal" maxlength="160" value="${esc(p.goal || "")}" placeholder="e.g. In-season strength maintenance"></label></div></div>
  <datalist id="exlist">${libraryItems().map((x) => `<option value="${esc(x.n)}">`).join("")}</datalist>
  ${p.days.map((d, di) => `<div class="card"><div class="hd"><input id="pd_${di}" data-bind-day="${di}" value="${esc(d.name)}" maxlength="40" style="max-width:240px;font-weight:700"><button class="btn sm ghost" data-act="day-del" data-d="${di}">Remove day</button></div>
    <div class="tablewrap"><table><thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Load</th><th>Rest</th><th>Coaching cue</th><th></th></tr></thead><tbody>
    ${d.items.map((it, ii) => `<tr><td style="min-width:200px"><input id="pi_${di}_${ii}_ex" list="exlist" data-bind-item="${di}.${ii}.ex" value="${esc(it.ex)}" maxlength="80"></td><td style="width:70px"><input id="pi_${di}_${ii}_sets" type="number" min="1" max="20" data-bind-item="${di}.${ii}.sets" value="${esc(it.sets ?? "")}"></td><td style="width:90px"><input id="pi_${di}_${ii}_reps" data-bind-item="${di}.${ii}.reps" value="${esc(it.reps || "")}" maxlength="20"></td><td style="width:100px"><input id="pi_${di}_${ii}_load" data-bind-item="${di}.${ii}.load" value="${esc(it.load || "")}" maxlength="30"></td><td style="width:80px"><input id="pi_${di}_${ii}_rest" data-bind-item="${di}.${ii}.rest" value="${esc(it.rest || "")}" maxlength="12"></td><td style="min-width:160px"><input id="pi_${di}_${ii}_note" data-bind-item="${di}.${ii}.note" value="${esc(it.note || "")}" maxlength="120"></td><td><button class="iconbtn" data-act="item-del" data-d="${di}" data-i="${ii}" aria-label="Remove exercise">${icon("x")}</button></td></tr>`).join("")}
    </tbody></table></div><button class="btn sm" style="margin-top:10px" data-act="item-add" data-d="${di}">${icon("plus")}Exercise</button></div>`).join("")}
  <div><button class="btn" data-act="day-add">${icon("plus")}Add training day</button></div>`;
}
function assignModal(m) {
  const p = S.programs[m.id]; if (!p) return "";
  const s = settings(); const wd = [0, 1, 2, 3, 4, 5, 6];
  return `<div class="hd"><h2>Assign “${esc(p.name)}”</h2><button class="iconbtn" data-act="modal-close" aria-label="Close">${icon("x")}</button></div>
  <form class="form" data-form="assign" data-id="${esc(m.id)}">
    <fieldset class="full" style="border:1px solid var(--line);border-radius:8px;padding:10px;max-height:200px;overflow:auto"><legend class="small muted">Athletes</legend>
      ${s.groups.map((g) => `<label class="check"><input type="checkbox" name="grp" value="${esc(g)}"> <b>Group: ${esc(g)}</b></label>`).join("")}
      ${athleteIds().map((u) => `<label class="check"><input type="checkbox" name="ath" value="${esc(u)}"> ${esc(nameOf(u))}</label>`).join("") || '<span class="muted small">No athletes yet.</span>'}</fieldset>
    <label class="f">Start date<input name="start" type="date" required value="${esc(today())}"></label>
    <label class="f">Weeks<input name="weeks" type="number" min="1" max="16" value="4"></label>
    <label class="f">Start time<input name="time" type="time" value="16:00"></label>
    <label class="f">Type<select name="type">${sel(s.types.map((t) => [t, t]), "Strength")}</select></label>
    <fieldset class="full row" style="border:0;padding:0"><legend class="small muted" style="margin-bottom:4px">Training days (program days rotate across them)</legend>${wd.map((i) => `<label class="check"><input type="checkbox" name="wd" value="${i}"${[1, 3, 5].includes(i) ? " checked" : ""}> ${esc(new Date(2023, 0, 1 + i).toLocaleDateString(LOC(), { weekday: "short" }))}</label>`).join("")}</fieldset>
    <div class="formactions"><button type="button" class="btn" data-act="modal-close">Cancel</button><button class="btn primary">Add to calendars</button></div>
  </form>`;
}

/* ---------- library ---------- */
VIEWS.library = {
  meta: () => ({ title: "Exercise library", sub: `${libraryItems().length} exercises with video demos`, actions: isStaff() ? `<button class="btn primary" data-act="ex-new">${icon("plus")}Add exercise</button>` : "" }),
  body: () => {
    const all = libraryItems(); const q = (S.sel.lq || "").toLowerCase(); const c = S.sel.lc || "";
    const cats = [...new Set(all.map((x) => x.c))].sort();
    const list = all.filter((x) => (!c || x.c === c) && (!q || [x.n, x.p, ...(x.m || []), ...(x.e || []), ...(x.t || [])].join(" ").toLowerCase().includes(q)));
    if (!all.length) return `<div class="card">${empty("book", "The library is empty", isStaff() ? "Add your first exercise." : "Your coaches haven't added exercises yet.")}</div>`;
    return `<div class="card"><div class="row" style="margin-bottom:10px"><input id="lq" data-live="lq" placeholder="Search exercise, muscle, equipment" value="${esc(S.sel.lq || "")}" style="max-width:320px"><select id="lc" data-change="lc" style="width:auto">${sel([["", "All categories"], ...cats.map((k) => [k, k[0].toUpperCase() + k.slice(1)])], c)}</select><span class="small muted" style="margin-inline-start:auto">${list.length} shown</span></div>
    <div class="tablewrap"><table><thead><tr><th>Exercise</th><th>Category</th><th>Pattern</th><th>Muscles</th><th>Equipment</th><th>Level</th><th></th></tr></thead><tbody>
    ${list.slice(0, 400).map((x) => { const url = videoUrl(x.v); return `<tr><td translate="no"><b>${esc(x.n)}</b>${x.custom ? ' <span class="pill info">Academy</span>' : ""}</td><td><span class="pill brand">${esc(x.c)}</span></td><td class="small" translate="no">${esc(x.p || "")}</td><td class="small" translate="no">${esc((x.m || []).join(", "))}</td><td class="small" translate="no">${esc((x.e || []).join(", "))}</td><td class="small">${esc(x.d || "")}</td><td class="r"><span class="row" style="justify-content:flex-end;flex-wrap:nowrap">${url ? `<a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon("play")}Video</a>` : ""}${x.custom && isStaff() ? armBtn("ex-" + x.id, "Delete", "ex-del", `data-id="${esc(x.id)}"`) : ""}</span></td></tr>`; }).join("")}
    </tbody></table></div></div>`;
  },
};
function exerciseModal() {
  return `<div class="hd"><h2>Add exercise</h2><button class="iconbtn" data-act="modal-close" aria-label="Close">${icon("x")}</button></div>
  <form class="form" data-form="exercise">
    <label class="f full">Name<input name="n" required maxlength="80"></label>
    <label class="f">Category<select name="c">${sel(["strength", "power", "plyometrics", "sprint", "cod", "deceleration", "core", "stability", "mobility", "rehab", "conditioning"].map((k) => [k, k]))}</select></label>
    <label class="f">Movement pattern<input name="p" maxlength="60"></label>
    <label class="f">Muscles (comma separated)<input name="m" maxlength="120"></label>
    <label class="f">Equipment (comma separated)<input name="e" maxlength="120"></label>
    <label class="f">Level<select name="d">${sel([["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]])}</select></label>
    <label class="f full">Video link (https://…)<input name="v" type="url" maxlength="300" placeholder="https://www.youtube.com/watch?v=…"></label>
    <div class="formactions"><button type="button" class="btn" data-act="modal-close">Cancel</button><button class="btn primary">Add to library</button></div>
  </form>`;
}

/* ---------- testing ---------- */
VIEWS.testing = {
  meta: () => ({ title: "Testing", sub: "Record squad results and track the leaderboard" }),
  body: () => {
    const defs = settings().tests; const tid = S.sel.test || defs[0]?.id; const d = testDef(tid);
    const ids = athleteIds(); const grp = S.sel.tgrp || "";
    const who = ids.filter((u) => !grp || S.roster[u]?.group === grp);
    const rows = ids.map((u) => { const r = testsOf(u).filter((x) => x.test === tid); const b = best(r, d.better); const last = r[r.length - 1]; const prev = r[r.length - 2]; return { u, b, last, prev, n: r.length }; }).filter((x) => x.n);
    if (d.better === "lower") rows.sort((a, b) => a.b.value - b.b.value); else rows.sort((a, b) => b.b.value - a.b.value);
    return `<div class="card"><div class="row" style="margin-bottom:12px"><select id="tsel" data-change="test" style="width:auto">${sel(defs.map((x) => [x.id, `${x.name} (${x.unit})`]), tid)}</select>${settings().groups.length ? `<select id="tgrp" data-change="tgrp" style="width:auto">${sel([["", "All athletes"], ...settings().groups.map((g) => [g, g])], grp)}</select>` : ""}<span class="small muted" style="margin-inline-start:auto">${d.better === "lower" ? "Lower is better" : d.better === "higher" ? "Higher is better" : "Tracked over time"}</span></div>
      <div class="split"><div><h2 style="margin-bottom:10px">Leaderboard</h2>${rows.length ? `<div class="tablewrap"><table><thead><tr><th>#</th><th>Athlete</th><th class="r">Best</th><th class="r">Latest</th><th class="r">Change</th><th>Tested</th></tr></thead><tbody>${rows.map((r, i) => { const ch = r.prev ? ((r.last.value - r.prev.value) / Math.abs(r.prev.value || 1)) * 100 : null; const good = ch == null ? null : d.better === "lower" ? ch < 0 : ch > 0; return `<tr class="clickable" data-act="open-athlete" data-u="${esc(r.u)}" data-tab="tests"><td>${i + 1}</td><td>${esc(nameOf(r.u))}</td><td class="r"><b>${esc(r.b.value)}</b> ${esc(d.unit)}</td><td class="r">${esc(r.last.value)}</td><td class="r">${ch == null ? "–" : `<span class="pill ${d.better === "none" ? "" : good ? "good" : "bad"}">${ch > 0 ? "+" : ""}${ch.toFixed(1)}%</span>`}</td><td class="small muted">${esc(fmtDay(r.last.date))}</td></tr>`; }).join("")}</tbody></table></div>` : `<p class="muted">No ${esc(d.name)} results yet.</p>`}</div>
      <div><h2 style="margin-bottom:10px">Test day entry</h2>${who.length ? `<form class="stack" data-form="test-batch" data-test="${esc(tid)}"><label class="f">Date<input id="tb_date" name="date" type="date" value="${today()}" required></label>${who.map((u) => `<label class="row" style="flex-wrap:nowrap"><span style="flex:1;min-width:0">${esc(nameOf(u))}</span><input id="tb_${esc(u)}" name="v_${esc(u)}" type="number" step="any" style="width:110px" placeholder="${esc(d.unit)}"></label>`).join("")}<button class="btn primary">Save results</button></form>` : `<p class="muted">No athletes in this group.</p>`}</div></div></div>`;
  },
};
