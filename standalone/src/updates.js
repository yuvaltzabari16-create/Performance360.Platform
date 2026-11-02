/* ================= updates: announcements from the academy ================= */
Object.assign(IC, {
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  pin: '<path d="M9 4h6l-1 6 4 4H6l4-4z"/><path d="M12 14v6"/>',
});
NAV.staff[0][1].splice(2, 0, ["updates", "Updates", "megaphone"], ["assistant", "AI assistant", "spark"]);
NAV.athlete[1][1].unshift(["updates", "Updates", "megaphone"]);

function updatesFor() {
  const mine = S.roster[S.uid]?.group || "";
  const list = vals(S.updates).filter((u) => isStaff() || u.audience === "all" || u.audience === "athletes" || (u.audience === "group:" + mine && mine));
  if (isStaff()) vals(S.staffupdates).forEach((u) => list.push({ ...u, audience: "staff", staffOnly: true }));
  return list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.at || "").localeCompare(a.at || ""));
}
function updatesUnread() { const seen = S.prefs.updatesSeen || ""; return updatesFor().filter((u) => u.by !== S.uid && (u.at || "") > seen).length; }
function audienceLabel(a) { return a === "all" ? T("Everyone", "כולם") : a === "athletes" ? T("Athletes", "ספורטאים") : a === "staff" ? T("Staff only", "צוות בלבד") : a && a.startsWith("group:") ? T("Group: ", "קבוצה: ") + a.slice(6) : ""; }
VIEWS.updates = {
  meta: () => ({ title: "Updates", sub: isStaff() ? "Announcements for your athletes and staff" : "News from your academy" }),
  body: () => {
    const seen = S.prefs.updatesSeen || ""; const list = updatesFor();
    if (updatesUnread()) setTimeout(() => { if (S.view === "updates") savePrefs({ updatesSeen: nowIso() }, true).then(schedule); }, 1500);
    const composer = isStaff() ? `<div class="card"><form class="form" data-form="update"><label class="f full">Title<input id="up_title" name="title" required maxlength="100" placeholder="e.g. Saturday practice moved to 10:00"></label>
      <label class="f full">Message<textarea id="up_body" name="body" maxlength="2000" rows="3"></textarea></label>
      <label class="f">Who sees it<select id="up_aud" name="audience">${sel([["all", T("Everyone", "כולם")], ["athletes", T("Athletes", "ספורטאים")], ["staff", T("Staff only", "צוות בלבד")], ...settings().groups.map((g) => ["group:" + g, T("Group: ", "קבוצה: ") + g])], "all")}</select></label>
      <label class="check" style="align-self:end"><input type="checkbox" id="up_pin" name="pinned"> <span>Pin to top</span></label>
      <div class="formactions"><button class="btn primary">${icon("megaphone")}Post update</button></div></form></div>` : "";
    return composer + (list.length ? list.map((u) => `<div class="card upd${u.by !== S.uid && (u.at || "") > seen ? " unread" : ""}"><div class="meta">${av(u.by, true)}<b translate="no">${esc(nameOf(u.by))}</b><span>${esc(ago(u.at))}</span>${u.pinned ? `<span class="pill brand">${icon("pin")}Pinned</span>` : ""}${isStaff() ? `<span class="pill${u.staffOnly ? " warn" : ""}">${esc(audienceLabel(u.audience))}</span>` : ""}<span style="margin-inline-start:auto"></span>${isStaff() && (u.by === S.uid || S.role === "owner") ? armBtn("ud-" + u.id, "Delete", "update-del", `data-id="${esc(u.id)}" data-staff="${u.staffOnly ? 1 : ""}"`) : ""}</div><h3 translate="no">${esc(u.title)}</h3>${u.body ? `<p class="body" translate="no">${esc(u.body)}</p>` : ""}</div>`).join("")
      : `<div class="card">${empty("megaphone", "No updates yet", isStaff() ? "Post schedule changes, news and reminders here. Athletes see them on their phone." : "Announcements from your coaches will appear here.")}</div>`);
  },
};
FORMS.update = async (fd) => {
  const aud = String(fd.get("audience") || "all"); const doc = { title: clampStr(fd.get("title"), 100), body: clampStr(fd.get("body"), 2000), audience: aud, pinned: !!fd.get("pinned"), by: S.uid, at: nowIso() };
  if (!doc.title) return false;
  return act(() => S.db.doc(`${aud === "staff" ? "staffupdates" : "updates"}/${newId()}`).set(doc), "Update posted");
};
ACTIONS["update-del"] = (d) => act(() => S.db.doc(`${d.staff ? "staffupdates" : "updates"}/${d.id}`).delete(), "Update deleted");

/* subscriptions, badges, dashboard card */
const _subCommon = subscribeCommon;
subscribeCommon = function () { _subCommon(); watchColl("updates", "updates"); if (S.isAdmin) watchColl("staffupdates", "staffupdates"); };
S.updates = {}; S.staffupdates = {};
const _navHtml = navHtml;
navHtml = function () { const n = updatesUnread(); let h = _navHtml(); if (n) h = h.replace(/(data-v="updates"[^>]*>.*?<span>[^<]*<\/span>)/, `$1<span class="badge">${n}</span>`); return h; };
const _staffDash = staffDashboard, _athDash = athleteDashboard;
function latestUpdateCard() { const u = updatesFor()[0]; if (!u) return ""; return `<div class="card clickable upd${updatesUnread() ? " unread" : ""}" data-act="go" data-v="updates"><div class="meta">${icon("megaphone")}<b>Latest update</b><span>${esc(ago(u.at))}</span>${updatesUnread() ? `<span class="badge">${updatesUnread()}</span>` : ""}</div><h3 translate="no">${esc(u.title)}</h3>${u.body ? `<p class="body muted small" translate="no">${esc(u.body.slice(0, 160))}${u.body.length > 160 ? "…" : ""}</p>` : ""}</div>`; }
staffDashboard = function () { return latestUpdateCard() + _staffDash(); };
athleteDashboard = function () { return latestUpdateCard() + _athDash(); };

/* phone tab bar */
function tabBar() {
  const tabs = isStaff() ? [["dashboard", "Home", "home"], ["athletes", "Athletes", "users"], ["calendar", "Calendar", "cal"], ["planner", "Planner", "plan"]] : [["dashboard", "Home", "home"], ["calendar", "Calendar", "cal"], ["tracker", "Workout", "dumbbell"], ["updates", "Updates", "megaphone"]];
  const n = updatesUnread(); const m = unreadTotal();
  return `<nav class="tabbar" aria-label="Tabs">${tabs.map(([v, l, ic]) => `<button data-act="go" data-v="${v}"${S.view === v ? ' aria-current="page"' : ""}>${icon(ic)}<span>${esc(l)}</span>${v === "updates" && n ? `<span class="badge">${n}</span>` : ""}</button>`).join("")}<button data-act="nav-open">${icon("more")}<span>More</span>${m ? `<span class="badge">${m}</span>` : ""}</button></nav>`;
}
