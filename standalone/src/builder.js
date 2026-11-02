/* ================= workout builder: library · workout · assistant ================= */
const WB_FIELDS = [["reps", "Reps"], ["load", "Load"], ["pct", "%1RM"], ["rpe", "RPE"], ["time", "Time"], ["dist", "Distance"], ["tempo", "Tempo"], ["rest", "Rest"]];
const SS_COLORS = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"];
const ssVar = (c) => `var(--ss-${SS_COLORS.includes(c) ? c : "blue"})`;
const wid = () => Math.random().toString(36).slice(2, 9);
function ytId(v) { const m = String(v || "").match(/^[ws]:([A-Za-z0-9_-]{6,15})$/); return m ? m[1] : ""; }
function exThumb(name) { const x = findExercise(name); const id = x && ytId(x.v); return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : ""; }
function defaultFields(name) {
  const x = findExercise(name); const c = x ? x.c : "";
  if (["mobility", "stability", "rehab"].includes(c)) return ["time", "rest"];
  if (["sprint", "cod", "deceleration"].includes(c)) return ["dist", "rest"];
  if (c === "strength") return ["reps", "load", "rest"];
  return ["reps", "rest"];
}
function newItem(name, opts = {}) {
  const fields = opts.fields || defaultFields(name);
  const base = Object.fromEntries(fields.map((f) => [f, ""]));
  if (fields.includes("rest")) base.rest = opts.rest ?? "01:00";
  const n = opts.sets || 3;
  return { id: wid(), ex: name, cue: opts.cue || "", ss: opts.ss || null, fields, sets: Array.from({ length: n }, () => ({ ...base, ...(opts.set || {}) })) };
}
function emptyWorkout() { return { id: newId(), name: "", goal: "", sections: [{ id: wid(), name: "Main", note: "", items: [] }] }; }
// older programs were "days" of simple items; convert them to sections when opened
function normalizeWorkout(p) {
  const w = JSON.parse(JSON.stringify(p || {}));
  if (!Array.isArray(w.sections)) {
    w.sections = (w.days || []).map((d) => ({ id: wid(), name: d.name || "Main", note: "", items: (d.items || []).map((it) => newItem(it.ex, { sets: Math.max(1, Number(it.sets) || 3), fields: ["reps", "load", "rest"], cue: it.note || "", set: { reps: it.reps || "", load: it.load || "", rest: it.rest || "01:00" } })) }));
    if (!w.sections.length) w.sections = [{ id: wid(), name: "Main", note: "", items: [] }];
  }
  w.sections.forEach((s) => { s.id ||= wid(); s.items = (s.items || []).map((it) => ({ id: it.id || wid(), ex: it.ex || "", cue: it.cue || "", ss: SS_COLORS.includes(it.ss) ? it.ss : null, fields: Array.isArray(it.fields) && it.fields.length ? it.fields : ["reps", "rest"], sets: Array.isArray(it.sets) && it.sets.length ? it.sets : [{}] })); });
  delete w.days; return w;
}
function workoutCounts(w) { const items = (w.sections || []).flatMap((s) => s.items || []); return { sections: (w.sections || []).length, exercises: items.length, sets: items.reduce((a, it) => a + (it.sets || []).length, 0) }; }
// flat list kept on sessions so the athlete's tracker and older screens keep working
function flattenWorkout(w) {
  return (w.sections || []).flatMap((s) => (s.items || []).map((it) => {
    const f = it.sets[0] || {};
    const reps = f.reps || (f.time ? f.time : f.dist ? f.dist + " m" : "");
    return { ex: it.ex, sets: it.sets.length, reps, load: f.load || (f.pct ? f.pct + "% 1RM" : ""), rest: f.rest || "", note: it.cue || "", ss: it.ss || null, section: s.name || "" };
  }));
}
function ssLetters(items) { const order = []; items.forEach((it) => { if (it.ss && !order.includes(it.ss)) order.push(it.ss); }); return Object.fromEntries(order.map((c, i) => [c, String.fromCharCode(65 + i)])); }
function ssDot(c) { return c ? `<span class="ssdot" style="--ssc:${ssVar(c)};width:12px;height:12px;border:0;display:inline-block;vertical-align:middle"></span>` : ""; }

/* ---------- planner: workouts library or editor ---------- */
VIEWS.planner = {
  meta: () => {
    if (S.edit.program) {
      const w = S.edit.program;
      return { title: w.name || "New workout", sub: S.edit.dirtyW ? "Unsaved changes" : "Workout builder",
        actions: `<span class="seg wb-switch">${[["lib", "Library"], ["work", "Workout"], ["ai", "Assistant"]].map(([k, l]) => `<button data-act="wb-pane" data-p="${k}" aria-pressed="${(S.sel.wbPane || "work") === k}">${l}</button>`).join("")}</span><button class="btn" data-act="prog-cancel">Close</button><button class="btn primary" data-act="prog-save">Save</button>` };
    }
    return { title: "Workout planner", sub: "Build workouts with sections and supersets, then assign them", actions: `<button class="btn" data-act="prog-ai">${icon("spark")}Build with assistant</button><button class="btn primary" data-act="prog-new">${icon("plus")}New workout</button>` };
  },
  body: () => (S.edit.program ? workoutEditor() : workoutLibrary()),
};
function workoutLibrary() {
  const ps = vals(S.programs).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  if (!ps.length) return `<div class="card">${empty("plan", "No workouts yet", "Build a workout with sections like warm-up, mobility, plyo prep and power. Link exercises into supersets with colors, then assign it to athletes.", `<div class="row" style="justify-content:center"><button class="btn" data-act="prog-ai">${icon("spark")}Build with assistant</button><button class="btn primary" data-act="prog-new">${icon("plus")}New workout</button></div>`)}</div>`;
  return `<div class="card wlib"><div class="hd"><h2>Library</h2><span class="pill">${ps.length} workouts</span></div><div class="list">${ps.map((raw) => { const p = normalizeWorkout(raw); const c = workoutCounts(p); return `<div class="li"><span class="iconbtn" style="background:var(--brand-soft)">${icon("plan")}</span><div class="grow clickable" data-act="prog-edit" data-id="${esc(raw.id)}"><div class="t" translate="no">${esc(p.name || "Untitled workout")}</div><div class="small muted">${c.sections} sections · ${c.exercises} exercises · Updated ${esc(ago(raw.updatedAt))}</div></div><span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" data-act="prog-edit" data-id="${esc(raw.id)}">Edit</button><button class="btn sm primary" data-act="prog-assign" data-id="${esc(raw.id)}">Assign</button><button class="mini" data-act="prog-copy" data-id="${esc(raw.id)}" aria-label="Duplicate">${icon("copy")}</button>${armBtn("pg-" + raw.id, "Delete", "prog-del", `data-id="${esc(raw.id)}"`)}</span></div>`; }).join("")}</div></div>`;
}

function libraryPane() {
  const q = (S.sel.wq || "").toLowerCase(); const c = S.sel.wc || "";
  const all = libraryItems(); const cats = [...new Set(all.map((x) => x.c))].sort();
  const list = all.filter((x) => (!c || x.c === c) && (!q || [x.n, x.p, ...(x.m || []), ...(x.t || [])].join(" ").toLowerCase().includes(q))).slice(0, 120);
  return `<div class="hd"><h3>Exercise library</h3><span class="small muted">${all.length}</span></div>
  <div style="padding:0 10px 8px" class="stack"><input id="wq" data-live="wq" placeholder="Search exercises" value="${esc(S.sel.wq || "")}"><select id="wc" data-change="wc">${sel([["", "All categories"], ...cats.map((k) => [k, k[0].toUpperCase() + k.slice(1)])], c)}</select></div>
  <div class="wb-scroll">${list.map((x) => { const th = exThumb(x.n); return `<div class="libitem" draggable="true" data-drag="${esc(x.n)}" data-act="wb-add-ex" data-n="${esc(x.n)}" title="Add to workout">${th ? `<img class="thumb" src="${th}" alt="" loading="lazy">` : `<span class="thumb"></span>`}<div style="min-width:0;flex:1"><div class="nm" dir="auto" translate="no">${esc(x.n)}</div><div class="mt">${esc(x.c)}${x.e && x.e.length ? " · " + esc(x.e[0]) : ""}</div></div><span class="mini">${icon("plus")}</span></div>`; }).join("") || `<p class="small muted" style="padding:8px">No exercises match.</p>`}</div>`;
}
function workoutEditor() {
  const w = S.edit.program; const pane = S.sel.wbPane || "work"; const tgt = S.edit.target ?? w.sections.length - 1;
  return `<datalist id="exlist">${libraryItems().map((x) => `<option value="${esc(x.n)}">`).join("")}</datalist>
  <div class="wb">
    <aside class="wb-pane${pane === "lib" ? " on" : ""}" data-pane="lib">${libraryPane()}</aside>
    <section class="wb-main stack${pane === "work" ? " on" : ""}" data-pane="work">
      <div class="card stack" style="gap:6px"><input id="wb_name" data-wb="name" value="${esc(w.name)}" placeholder="Untitled workout" style="font-size:22px;font-weight:700;background:none;padding:2px" aria-label="Workout name">
        <input id="wb_goal" data-wb="goal" value="${esc(w.goal || "")}" placeholder="Add notes & purpose" class="wsec-note" aria-label="Notes"></div>
      ${w.sections.map((s, si) => sectionHtml(s, si, si === tgt)).join("")}
      <div class="row" style="justify-content:center"><button class="btn" data-act="wb-add-section">${icon("plus")}Section</button></div>
    </section>
    <aside class="wb-pane wb-ai${pane === "ai" ? " on" : ""}" data-pane="ai">${assistantPane()}</aside>
  </div>`;
}
function sectionHtml(s, si, isTarget) {
  const letters = ssLetters(s.items);
  return `<div class="wsec" data-drop="${si}"${isTarget ? ' style="box-shadow:0 0 0 2px var(--brand-soft)"' : ""}>
    <div class="wsec-h"><input id="wb_s${s.id}_n" data-wb="s.${si}.name" value="${esc(s.name)}" placeholder="Section name" aria-label="Section name" style="flex:1">
      <button class="mini" data-act="wb-sec-move" data-s="${si}" data-d="-1" aria-label="Move up">${icon("up")}</button><button class="mini" data-act="wb-sec-move" data-s="${si}" data-d="1" aria-label="Move down">${icon("down")}</button>${armBtn("sec-" + s.id, "Delete", "wb-del-section", `data-s="${si}"`)}</div>
    <input id="wb_s${s.id}_note" data-wb="s.${si}.note" value="${esc(s.note || "")}" placeholder="Section note (e.g. Mobility / flexibility)" class="wsec-note" aria-label="Section note">
    ${s.items.map((it, ii) => itemHtml(it, si, ii, letters)).join("")}
    <div class="row small" style="justify-content:center;color:var(--ink-soft)"><span>Drop or tap exercises from the library here</span><button class="btn sm" data-act="wb-target" data-s="${si}">${icon("plus")}Exercise</button></div>
  </div>`;
}
function itemHtml(it, si, ii, letters) {
  const lib = findExercise(it.ex); const th = exThumb(it.ex); const base = `s.${si}.i.${ii}`;
  const picker = S.edit.ssOpen === it.id ? `<div class="sspick">${SS_COLORS.map((c) => `<button style="--ssc:${ssVar(c)}" data-act="wb-ss-set" data-s="${si}" data-i="${ii}" data-c="${c}" aria-pressed="${it.ss === c}" aria-label="${c}"></button>`).join("")}<button class="off" data-act="wb-ss-set" data-s="${si}" data-i="${ii}" data-c="" aria-label="No superset">×</button></div>` : "";
  const unused = WB_FIELDS.filter(([k]) => !it.fields.includes(k));
  return `<div class="wex${it.ss ? " ss" : ""}" style="--ssc:${it.ss ? ssVar(it.ss) : "transparent"}">
    <div class="wex-h">${th ? `<img class="thumb" src="${th}" alt="" loading="lazy">` : `<span class="thumb"></span>`}
      <div style="min-width:150px;flex:1">${it.ss ? `<div class="sslabel">Superset ${letters[it.ss] || ""}</div>` : ""}<div class="nm" dir="auto" data-act="wb-ex-open" data-s="${si}" data-i="${ii}" translate="no">${esc(it.ex || "Exercise")}</div>${lib ? "" : `<div class="small faint">Not in library</div>`}</div>
      <span class="wex-tools"><button class="ssdot${it.ss ? "" : " none"}" style="--ssc:${it.ss ? ssVar(it.ss) : "transparent"}" data-act="wb-ss" data-id="${esc(it.id)}" aria-label="Superset color" title="Link into a superset by color"></button>
      <button class="mini" data-act="wb-ex-move" data-s="${si}" data-i="${ii}" data-d="-1" aria-label="Move up">${icon("up")}</button><button class="mini" data-act="wb-ex-move" data-s="${si}" data-i="${ii}" data-d="1" aria-label="Move down">${icon("down")}</button>
      <button class="mini" data-act="wb-ex-dup" data-s="${si}" data-i="${ii}" aria-label="Duplicate">${icon("copy")}</button><button class="mini" data-act="wb-ex-del" data-s="${si}" data-i="${ii}" aria-label="Remove">${icon("trash")}</button></span></div>
    ${picker}
    <textarea id="wb_${it.id}_cue" data-wb="${base}.cue" class="cue" rows="1" placeholder="Coaching cue" aria-label="Coaching cue">${esc(it.cue || "")}</textarea>
    ${it.sets.map((st, k) => `<div class="wset"><span class="sn">SET ${k + 1}</span>${it.fields.map((f) => `<label class="fld${f === "rest" ? " rest" : ""}"><b>${esc((WB_FIELDS.find((x) => x[0] === f) || [f, f])[1])}</b><input id="wb_${it.id}_${k}_${f}" data-wb="${base}.sets.${k}.${f}" value="${esc(st[f] || "")}" placeholder="${f === "rest" || f === "time" ? "00:30" : f === "pct" ? "70" : f === "rpe" ? "7" : f === "dist" ? "20" : f === "tempo" ? "3-1-1" : "5"}" inputmode="${["reps", "pct", "rpe", "dist"].includes(f) ? "decimal" : "text"}"></label>`).join("")}
      <span class="tools2"><button class="mini" data-act="wb-set-copy" data-s="${si}" data-i="${ii}" data-k="${k}" aria-label="Copy set">${icon("copy")}</button>${it.sets.length > 1 ? `<button class="mini" data-act="wb-set-del" data-s="${si}" data-i="${ii}" data-k="${k}" aria-label="Delete set">${icon("trash")}</button>` : ""}</span></div>`).join("")}
    <div class="row" style="gap:6px"><button class="addfield" data-act="wb-set-add" data-s="${si}" data-i="${ii}">+ Set</button><button class="addfield" data-act="wb-field" data-s="${si}" data-i="${ii}" data-f="time">${it.fields.includes("time") ? "− Time" : "+ Time"}</button>
      ${unused.length ? `<select class="addfield" style="width:auto;padding:4px 26px 4px 8px" data-change="wb-field-add" data-s="${si}" data-i="${ii}" aria-label="Add field"><option value="">+ Field</option>${unused.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select>` : ""}
      ${it.fields.length > 1 ? `<select class="addfield" style="width:auto;padding:4px 26px 4px 8px" data-change="wb-field-del" data-s="${si}" data-i="${ii}" aria-label="Remove field"><option value="">− Field</option>${it.fields.map((k) => `<option value="${k}">${esc((WB_FIELDS.find((x) => x[0] === k) || [k, k])[1])}</option>`).join("")}</select>` : ""}</div>
  </div>`;
}
function exerciseSheet(m) {
  const w = S.edit.program; const it = w.sections[m.s]?.items[m.i]; if (!it) return "";
  const x = findExercise(it.ex); const id = x && ytId(x.v); const url = x ? videoUrl(x.v) : "";
  const swaps = x ? libraryItems().filter((y) => y.n !== x.n && y.c === x.c && (y.p === x.p || (y.t || []).some((t) => (x.t || []).includes(t)))).slice(0, 8) : [];
  return `<div class="hd"><span class="small muted" style="font-weight:600">EXERCISE</span><button class="iconbtn" data-act="modal-close" aria-label="Close">${icon("x")}</button></div>
  <h2 translate="no">${esc(it.ex)}</h2>
  ${id ? `<div class="player"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}?rel=0&playsinline=1" title="${esc(it.ex)}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>` : url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon("play")}Open video</a>` : `<p class="muted small">No video for this exercise.</p>`}
  ${x ? `<dl class="kv"><dt>Category</dt><dd>${esc(x.c)}</dd><dt>Pattern</dt><dd translate="no">${esc(x.p || "–")}</dd><dt>Muscles</dt><dd translate="no">${esc((x.m || []).join(", ") || "–")}</dd><dt>Equipment</dt><dd translate="no">${esc((x.e || []).join(", ") || "–")}</dd><dt>Level</dt><dd>${esc(x.d || "–")}</dd></dl>` : ""}
  <label class="f">Coaching cue<textarea id="wbm_cue" data-wb="s.${m.s}.i.${m.i}.cue" rows="3">${esc(it.cue || "")}</textarea></label>
  ${swaps.length ? `<div><h3 style="margin-bottom:6px">Swap for</h3><div class="chips">${swaps.map((y) => `<button class="chip" data-act="wb-swap" data-s="${m.s}" data-i="${m.i}" data-n="${esc(y.n)}" translate="no">${esc(y.n)}</button>`).join("")}</div></div>` : ""}
  <div class="row"><button class="btn" data-act="wb-ex-dup" data-s="${m.s}" data-i="${m.i}">${icon("copy")}Duplicate</button><button class="btn danger" data-act="wb-ex-del" data-s="${m.s}" data-i="${m.i}">${icon("trash")}Remove</button></div>`;
}

/* ---------- editing actions ---------- */
function wbTouch() { S.edit.dirtyW = true; }
function wbItem(d) { return S.edit.program.sections[+d.s].items[+d.i]; }
Object.assign(ACTIONS, {
  "prog-new": () => { S.edit.program = emptyWorkout(); S.edit.target = 0; S.edit.dirtyW = false; S.sel.wbPane = "work"; render(); },
  "prog-ai": () => { S.edit.program = emptyWorkout(); S.edit.target = 0; S.edit.dirtyW = false; S.sel.wbPane = "ai"; render(); setTimeout(() => document.getElementById("wbai_q")?.focus(), 50); },
  "prog-edit": (d) => { const p = S.programs[d.id]; if (!p) return; S.edit.program = { ...normalizeWorkout(p), id: d.id }; S.edit.target = S.edit.program.sections.length - 1; S.edit.dirtyW = false; S.sel.wbPane = "work"; render(); },
  "prog-cancel": () => { S.edit.program = null; S.edit.ssOpen = null; S.dirty.clear(); render(); },
  "prog-save": async () => {
    const w = S.edit.program; const name = clampStr(w.name, 80) || "Untitled workout";
    const sections = w.sections.map((s) => ({ id: s.id, name: clampStr(s.name, 60) || "Section", note: clampStr(s.note, 160), items: s.items.filter((it) => clampStr(it.ex, 80)).map((it) => ({ id: it.id, ex: clampStr(it.ex, 80), cue: clampStr(it.cue, 300), ss: SS_COLORS.includes(it.ss) ? it.ss : null, fields: it.fields.filter((f) => WB_FIELDS.some((x) => x[0] === f)).slice(0, 8), sets: it.sets.slice(0, 20).map((st) => Object.fromEntries(it.fields.map((f) => [f, clampStr(st[f], 20)]))) })) }));
    if (!sections.some((s) => s.items.length)) return toast("Add at least one exercise.", true);
    if (await act(() => S.db.doc(`programs/${w.id}`).set({ name, goal: clampStr(w.goal, 300), sections, updatedAt: nowIso(), by: S.uid }), "Workout saved")) { S.edit.dirtyW = false; S.edit.program = null; S.dirty.clear(); render(); }
  },
  "prog-copy": (d) => act(() => { const p = normalizeWorkout(S.programs[d.id]); return S.db.doc(`programs/${newId()}`).set({ name: (p.name || "Workout") + " (copy)", goal: p.goal || "", sections: p.sections, updatedAt: nowIso(), by: S.uid }); }, "Workout duplicated"),
  "wb-pane": (d) => { S.sel.wbPane = d.p; render(); },
  "wb-add-section": () => { const w = S.edit.program; w.sections.push({ id: wid(), name: "", note: "", items: [] }); S.edit.target = w.sections.length - 1; wbTouch(); render(); },
  "wb-del-section": (d) => { const w = S.edit.program; w.sections.splice(+d.s, 1); if (!w.sections.length) w.sections.push({ id: wid(), name: "Main", note: "", items: [] }); S.edit.target = Math.min(S.edit.target ?? 0, w.sections.length - 1); wbTouch(); S.dirty.clear(); render(); },
  "wb-sec-move": (d) => { const a = S.edit.program.sections; const i = +d.s, j = i + Number(d.d); if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; wbTouch(); S.dirty.clear(); render(); },
  "wb-target": (d) => { S.edit.target = +d.s; if (matchMedia("(max-width:860px)").matches) S.sel.wbPane = "lib"; else document.getElementById("wq")?.focus(); render(); },
  "wb-add-ex": (d) => { const w = S.edit.program; const si = Math.min(S.edit.target ?? w.sections.length - 1, w.sections.length - 1); w.sections[si].items.push(newItem(d.n)); wbTouch(); if (matchMedia("(max-width:860px)").matches) { S.sel.wbPane = "work"; toast("Added"); } render(); },
  "wb-ex-del": (d) => { S.edit.program.sections[+d.s].items.splice(+d.i, 1); S.modal = null; wbTouch(); S.dirty.clear(); render(); },
  "wb-ex-dup": (d) => { const a = S.edit.program.sections[+d.s].items; const c = JSON.parse(JSON.stringify(a[+d.i])); c.id = wid(); a.splice(+d.i + 1, 0, c); S.modal = null; wbTouch(); S.dirty.clear(); render(); },
  "wb-ex-move": (d) => { const a = S.edit.program.sections[+d.s].items; const i = +d.i, j = i + Number(d.d); if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; wbTouch(); S.dirty.clear(); render(); },
  "wb-ex-open": (d) => { S.modal = { kind: "wb-ex", s: +d.s, i: +d.i }; render(); },
  "wb-swap": (d) => { const it = wbItem(d); it.ex = d.n; wbTouch(); S.modal = { kind: "wb-ex", s: +d.s, i: +d.i }; render(); },
  "wb-ss": (d) => { S.edit.ssOpen = S.edit.ssOpen === d.id ? null : d.id; render(); },
  "wb-ss-set": (d) => { wbItem(d).ss = d.c || null; S.edit.ssOpen = null; wbTouch(); render(); },
  "wb-set-add": (d) => { const it = wbItem(d); it.sets.push({ ...(it.sets[it.sets.length - 1] || {}) }); wbTouch(); S.dirty.clear(); render(); },
  "wb-set-copy": (d) => { const it = wbItem(d); it.sets.splice(+d.k + 1, 0, { ...it.sets[+d.k] }); wbTouch(); S.dirty.clear(); render(); },
  "wb-set-del": (d) => { const it = wbItem(d); if (it.sets.length > 1) it.sets.splice(+d.k, 1); wbTouch(); S.dirty.clear(); render(); },
  "wb-field": (d) => { const it = wbItem(d); if (it.fields.includes(d.f)) it.fields = it.fields.filter((f) => f !== d.f); else { const ri = it.fields.indexOf("rest"); it.fields.splice(ri < 0 ? it.fields.length : ri, 0, d.f); } wbTouch(); S.dirty.clear(); render(); },
});
// field add/remove selects and library filters
document.addEventListener("change", (e) => {
  const el = e.target; const c = el.dataset && el.dataset.change;
  if (c === "wb-field-add" && el.value) { const it = S.edit.program.sections[+el.dataset.s].items[+el.dataset.i]; const ri = it.fields.indexOf("rest"); it.fields.splice(ri < 0 ? it.fields.length : ri, 0, el.value); wbTouch(); S.dirty.clear(); render(); }
  if (c === "wb-field-del" && el.value) { const it = S.edit.program.sections[+el.dataset.s].items[+el.dataset.i]; it.fields = it.fields.filter((f) => f !== el.value); wbTouch(); S.dirty.clear(); render(); }
  if (c === "wc") { S.sel.wc = el.value; render(); }
}, true);
// typing into the workout updates it without re-rendering
document.addEventListener("input", (e) => {
  const el = e.target; const path = el.dataset && el.dataset.wb; if (!path || !S.edit.program) return;
  const parts = path.split("."); let o = S.edit.program;
  for (let i = 0; i < parts.length - 1; i++) { const k = parts[i]; o = k === "s" ? o.sections : k === "i" ? o.items : o[/^\d+$/.test(k) ? +k : k]; if (!o) return; }
  o[parts[parts.length - 1]] = el.value; S.edit.dirtyW = true;
}, true);
// drag from the library onto a section
document.addEventListener("dragstart", (e) => { const n = e.target.closest && e.target.closest("[data-drag]"); if (n) { e.dataTransfer.setData("text/plain", n.dataset.drag); e.dataTransfer.effectAllowed = "copy"; } });
document.addEventListener("dragover", (e) => { const z = e.target.closest && e.target.closest("[data-drop]"); if (z && S.edit.program) { e.preventDefault(); z.classList.add("drop"); } });
document.addEventListener("dragleave", (e) => { const z = e.target.closest && e.target.closest("[data-drop]"); if (z) z.classList.remove("drop"); });
document.addEventListener("drop", (e) => {
  const z = e.target.closest && e.target.closest("[data-drop]"); if (!z || !S.edit.program) return; e.preventDefault();
  const n = e.dataTransfer.getData("text/plain"); if (!n) return;
  S.edit.program.sections[+z.dataset.drop].items.push(newItem(n)); S.edit.target = +z.dataset.drop; wbTouch(); render();
});

/* ---------- assign a workout ---------- */
assignModal = function (m) {
  const p = S.programs[m.id]; if (!p) return "";
  const s = settings(); const wd = [0, 1, 2, 3, 4, 5, 6];
  return `<div class="hd"><h2>Assign “${esc(p.name)}”</h2><button class="iconbtn" data-act="modal-close" aria-label="Close">${icon("x")}</button></div>
  <form class="form" data-form="assign" data-id="${esc(m.id)}">
    <fieldset class="full stack" style="border:0;padding:0;margin:0;max-height:220px;overflow:auto"><legend class="small muted" style="margin-bottom:6px">Athletes</legend>
      ${s.groups.map((g) => `<label class="check"><input type="checkbox" name="grp" value="${esc(g)}"> <b>Group: ${esc(g)}</b></label>`).join("")}
      ${athleteIds().map((u) => `<label class="check"><input type="checkbox" name="ath" value="${esc(u)}"> <span translate="no">${esc(nameOf(u))}</span></label>`).join("") || '<span class="muted small">No athletes yet.</span>'}</fieldset>
    <label class="f">First date<input name="start" type="date" required value="${esc(today())}"></label>
    <label class="f">Start time<input name="time" type="time" value="16:00"></label>
    <label class="f">Repeat<select name="repeat">${sel([["once", "Once"], ["weekly", "Weekly"]], "once")}</select></label>
    <label class="f">Weeks (if weekly)<input name="weeks" type="number" min="1" max="16" value="4"></label>
    <label class="f">Type<select name="type">${sel(s.types.map((t) => [t, t]), "Strength")}</select></label>
    <fieldset class="full row" style="border:0;padding:0;margin:0"><legend class="small muted" style="margin-bottom:6px">Days (if weekly)</legend>${wd.map((i) => `<label class="check" style="gap:6px"><input type="checkbox" name="wd" value="${i}"${[1, 3].includes(i) ? " checked" : ""}> ${esc(new Date(2023, 0, 1 + i).toLocaleDateString(LOC(), { weekday: "short" }))}</label>`).join("")}</fieldset>
    <div class="formactions"><button type="button" class="btn" data-act="modal-close">Cancel</button><button class="btn primary">Add to calendars</button></div>
  </form>`;
};
FORMS.assign = async (fd, d) => {
  const raw = S.programs[d.id]; if (!raw) return false; const p = normalizeWorkout(raw);
  const set = new Set(fd.getAll("ath")); fd.getAll("grp").forEach((g) => targetsFrom("g:" + g).forEach((u) => set.add(u)));
  const who = [...set]; const start = fd.get("start"); if (!who.length || !isDay(start)) { toast("Choose athletes and a date.", true); return false; }
  const dates = [];
  if (fd.get("repeat") === "weekly") { const wds = fd.getAll("wd").map(Number); const weeks = Math.min(16, Math.max(1, num(fd.get("weeks")) || 4)); if (!wds.length) { toast("Choose at least one day.", true); return false; } for (let i = 0; i < weeks * 7; i++) { const day = addDays(start, i); if (wds.includes(parseDay(day).getDay())) dates.push(day); } }
  else dates.push(start);
  const workout = { sections: p.sections }; const items = flattenWorkout(p); const gid = newId(); const sessions = {};
  dates.forEach((day, k) => { sessions[gid + "-" + k] = { title: p.name || "Workout", type: g(fd, "type", 30), date: day, time: g(fd, "time", 5), minutes: settings().defaultMinutes, items, workout, program: d.id, by: S.uid, updatedAt: nowIso(), location: "", notes: p.goal || "" }; });
  const ok = await act(async () => { for (const u of who) await upsert(`plan/${u}`, { sessions }); }, `${dates.length} sessions added for ${who.length} athlete${who.length > 1 ? "s" : ""}`);
  if (ok) { S.modal = null; render(); } return ok;
};
const _modalHtml2 = modalHtml;
modalHtml = function () { if (S.modal && S.modal.kind === "wb-ex") return `<div class="modal" data-act="modal-bg" role="dialog" aria-modal="true"><div class="box">${exerciseSheet(S.modal)}</div></div>`; return _modalHtml2(); };

/* sessions show their sections and superset colors */
const _exerciseRow = exerciseRow;
exerciseRow = function (i) { return (i.ss ? `<div style="border-inline-start:4px solid ${ssVar(i.ss)};padding-inline-start:8px">` : "<div>") + _exerciseRow(i) + "</div>"; };
