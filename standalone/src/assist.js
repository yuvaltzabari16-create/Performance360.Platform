/* ================= AI assistant (no Claude) =================
   1. A built-in planner that builds workouts from the academy's exercise library and answers common
      questions from the academy's own data. Runs in the browser, no outside service.
   2. If the owner connects an AI provider (OpenAI-compatible: OpenAI, Gemini, Groq, OpenRouter...)
      through the "academy-ai" server function, free-form questions go there instead. */
const T = (en, he) => (LANG === "he" ? he : en);
const WARMUP_DRILLS = ["Walking Knee To Chest", "Walking Quad Pull", "Walking Lunge With Rotation", "Walking Hamstring Scoop", "Lateral Lunge Walk", "A-Skip", "Carioca", "Leg Swings (front/back)", "Inchworm Into Cobra", "World's Greatest Stretch"];
const MOBILITY_DRILLS = { lower: ["90/90 Hip Switches", "Half-Kneeling Hip Flexor Stretch", "Ankle Rocks (knee to wall)", "Adductor Rock-Backs", "Deep Squat Hold With T-Spine Reach"], upper: ["Cat-Cow", "Open Book T-Spine Rotation", "Wall Slides", "Thread The Needle", "Band Pull-Aparts"], full: ["Groiners", "Shoulder CARs", "Inchworm Into Cobra", "90/90 Hip Switches", "Open Book T-Spine Rotation"] };
const COOLDOWN = ["Couch Stretch", "Child's Pose With Side Reach", "Supine Hamstring Floss", "Box Breathing (90/90 legs on box)"];
function seeded(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }

function parseRequest(text) {
  const t = " " + String(text || "").toLowerCase() + " ";
  const has = (...w) => w.some((x) => t.includes(x));
  const body = has("lower", "leg", "רגל", "תחתון") ? "lower" : has("upper", "עליון", "chest", "חזה", "back", "גב", "arm", "ידיים", "shoulder", "כתפ") ? "upper" : "full";
  const goal = has("power", "explosive", "מתפרץ", "פיצוץ", "פאוור") ? "power" : has("speed", "sprint", "מהירות", "ספרינט", "agility", "זריזות") ? "speed" : has("hypertroph", "muscle", "מסה", "היפרטרופ") ? "hypertrophy" : has("conditioning", "metcon", "סבולת", "כושר", "circuit", "מעגל") ? "conditioning" : has("rehab", "שיקום", "knee", "ברך", "post-op") ? "rehab" : has("mobility", "מוביליטי", "גמישות", "flexib") ? "mobility" : "strength";
  const want = [];
  const add = (k, ...w) => { if (has(...w)) want.push(k); };
  add("warmup", "warm", "חימום", "dynamic", "walking", "הליכה"); add("mobility", "mobility", "מוביליטי", "גמישות"); add("plyo", "plyo", "פליאו", "קפיצ", "jump prep");
  add("power", "power section", "power", "מתפרץ"); add("strength", "strength", "כוח"); add("accessory", "accessory", "עזר", "אביזר"); add("core", "core", "ליבה", "בטן", "abs");
  add("speed", "sprint", "speed", "מהירות", "ספרינט"); add("conditioning", "conditioning", "circuit", "מעגל", "סבולת"); add("cooldown", "cool", "שחרור", "מתיחות", "stretch");
  const order = ["warmup", "mobility", "plyo", "speed", "power", "strength", "accessory", "core", "conditioning", "cooldown"];
  let sections = order.filter((k) => want.includes(k));
  if (goal === "power" && !want.includes("strength")) sections = sections.filter((k) => k !== "strength");
  if (sections.length < 2) sections = { power: ["warmup", "mobility", "plyo", "power", "core"], strength: ["warmup", "mobility", "strength", "accessory", "core"], speed: ["warmup", "plyo", "speed", "power"], hypertrophy: ["warmup", "strength", "accessory", "core"], conditioning: ["warmup", "conditioning", "cooldown"], rehab: ["mobility", "accessory", "cooldown"], mobility: ["warmup", "mobility", "cooldown"] }[goal];
  const mins = (t.match(/(\d{2,3})\s*(min|דק)/) || [])[1];
  return { body, goal, sections, minutes: mins ? Number(mins) : null };
}
function buildWorkout(text) {
  const req = parseRequest(text); const rnd = seeded(text + Date.now().toString().slice(0, -5));
  const lib = libraryItems(); const used = new Set();
  const bodyOk = (x) => req.body === "full" || (x.t || []).includes(req.body === "lower" ? "lower body" : "upper body");
  function pick(filter, n, prefer = []) {
    let pool = lib.filter((x) => !used.has(x.n) && filter(x));
    const pref = []; prefer.forEach((re) => { const hit = pool.filter((x) => re.test(x.n) && !pref.includes(x)); if (hit.length) pref.push(hit[Math.floor(rnd() * hit.length)]); });
    const rest = pool.filter((x) => !pref.includes(x)).sort(() => rnd() - 0.5);
    const out = [...pref, ...rest].slice(0, n); out.forEach((x) => used.add(x.n)); return out.map((x) => x.n);
  }
  const fromList = (list, n) => [...list].sort(() => rnd() - 0.5).slice(0, n);
  const lower = req.body !== "upper", upper = req.body !== "lower";
  const S_ = { // section recipes: [name EN, name HE, items]
    warmup: () => ({ name: T("Dynamic Warm-Up", "חימום דינמי"), note: T("Walking drills, 10 m each way", "תרגילי הליכה, 10 מ׳ לכל כיוון"), items: fromList(WARMUP_DRILLS, 5).map((n) => newItem(n, { ss: "green", sets: 1, fields: ["dist", "rest"], set: { dist: "10", rest: "00:00" } })) }),
    mobility: () => { const lib2 = pick((x) => x.c === "mobility" && bodyOk(x), 1); return { name: T("Mobility Warm-Up", "חימום מוביליטי"), note: T("Mobility / flexibility", "מוביליטי וגמישות"), items: [...fromList(MOBILITY_DRILLS[req.body], 3), ...lib2].map((n) => newItem(n, { ss: "teal", sets: 2, fields: ["time", "rest"], set: { time: "00:30", rest: "00:30" } })) }; },
    plyo: () => ({ name: T("Plyo Preparation", "הכנה פליאומטרית"), note: T("Low amplitude, quick contacts", "משרעת נמוכה, מגע קצר בקרקע"), items: pick((x) => x.c === "plyometrics" && x.d !== "advanced" && (lower || bodyOk(x)), 3, [/pogo/i, /skip|bound/i]).map((n, i) => newItem(n, { sets: 3, fields: ["reps", "rest"], set: { reps: "5", rest: "00:45" } })) }),
    power: () => {
      if (!lower) return { name: T("Upper Power", "כוח מתפרץ עליון"), note: "", items: pick((x) => x.c === "power" || /throw|slam|pass|push-?up.*(clap|plyo)/i.test(x.n), 3, [/chest pass/i, /slam/i, /throw/i]).map((n, i, a) => newItem(n, { ss: "purple", sets: 4, fields: ["reps", "rest"], set: { reps: "3-5", rest: i === a.length - 1 ? "02:00" : "00:45" } })) };
      const jump = pick((x) => x.c === "plyometrics" && /box jump|countermovement|broad|depth|hurdle/i.test(x.n), 1, [/box jump/i, /countermovement/i]);
      const loaded = pick((x) => /jump squat|trap bar jump|loaded jump|clean|snatch/i.test(x.n), 1) .concat([]);
      const hinge = pick((x) => /swing|hip thrust|romanian|rdl|good morning|deadlift/i.test(x.n), 1, [/swing/i]);
      const names = [...jump, ...(loaded.length ? loaded : pick((x) => x.c === "power", 1, [/slam/i, /scoop/i])), ...hinge];
      return { name: T("Power Tri-Set", "טרי-סט כוח מתפרץ"), note: T("Vertical + loaded + hinge. Max intent, full recovery", "אנכי + עם משקל + ציר ירך. כוונה מרבית, התאוששות מלאה"), items: names.map((n, i) => newItem(n, { ss: "red", sets: 4, fields: i === 1 ? ["reps", "pct", "rest"] : i === 2 ? ["reps", "rpe", "rest"] : ["reps", "rest"], set: { reps: i === 2 ? "8-12" : "3-5", pct: i === 1 ? "20-30" : "", rpe: i === 2 ? "7" : "", rest: i === names.length - 1 ? "02:00" : i === 0 ? "00:45" : "01:00" } })) };
    },
    strength: () => { const main = [...(lower ? pick((x) => x.c === "strength" && /squat|lunge/i.test(x.p || "") && bodyOk(x) && !/to box|bodyweight/i.test(x.n), 1, [/back squat|front squat|goblet squat/i]) : []), ...(lower ? pick((x) => x.c === "strength" && /hinge/i.test(x.p || ""), 1, [/romanian|rdl|deadlift|hip thrust/i]) : []), ...(upper ? pick((x) => x.c === "strength" && /push/i.test(x.p || ""), 1, [/bench|press/i]) : []), ...(upper ? pick((x) => x.c === "strength" && /pull/i.test(x.p || ""), 1, [/row|pull/i]) : [])];
      const reps = req.goal === "hypertrophy" ? "8-10" : "4-6"; return { name: T("Main Strength", "כוח מרכזי"), note: "", items: main.slice(0, 3).map((n) => newItem(n, { sets: 4, fields: ["reps", "load", "rpe", "rest"], set: { reps, rpe: "8", rest: "02:00" } })) }; },
    accessory: () => { const ns = pick((x) => (x.c === "strength" || x.c === "stability") && bodyOk(x) && /isolation|calf|adductor|hamstring|abductor|row|bicep|tricep|rotator/i.test((x.t || []).join(" ") + " " + (x.p || "")), 4); return { name: T("Accessory", "תרגילי עזר"), note: "", items: ns.map((n, i) => newItem(n, { ss: i < 2 ? "blue" : "orange", sets: 3, fields: ["reps", "rest"], set: { reps: req.goal === "hypertrophy" ? "10-12" : "8-12", rest: i % 2 ? "01:00" : "00:15" } })) }; },
    core: () => ({ name: T("Trunk", "ליבה"), note: "", items: pick((x) => x.c === "core", 3, [/plank/i, /side/i]).map((n) => newItem(n, { ss: "yellow", sets: 3, fields: ["time", "rest"], set: { time: "00:30", rest: "00:15" } })) }),
    speed: () => ({ name: T("Speed & Change of Direction", "מהירות ושינויי כיוון"), note: T("Full recovery between reps", "התאוששות מלאה בין חזרות"), items: pick((x) => ["sprint", "cod", "deceleration"].includes(x.c), 4, [/sprint/i, /decel|stop/i, /cut|turn/i]).map((n) => newItem(n, { sets: 4, fields: ["dist", "rest"], set: { dist: "20", rest: "01:30" } })) }),
    conditioning: () => ({ name: T("Conditioning Circuit", "מעגל כושר"), note: T("3 rounds", "3 סבבים"), items: pick((x) => ["plyometrics", "power", "core", "cod"].includes(x.c) && x.d !== "advanced", 5).map((n) => newItem(n, { ss: "orange", sets: 3, fields: ["time", "rest"], set: { time: "00:40", rest: "00:20" } })) }),
    cooldown: () => ({ name: T("Cool-Down", "שחרור"), note: "", items: fromList(COOLDOWN, 3).map((n) => newItem(n, { sets: 1, fields: ["time"], set: { time: "00:45" } })) }),
  };
  const sections = req.sections.map((k) => ({ id: wid(), ...S_[k]() })).filter((s) => s.items.length);
  const name = { power: T("Power", "כוח מתפרץ"), strength: T("Strength", "כוח"), speed: T("Speed", "מהירות"), hypertrophy: T("Hypertrophy", "היפרטרופיה"), conditioning: T("Conditioning", "כושר"), rehab: T("Rehab", "שיקום"), mobility: T("Mobility", "מוביליטי") }[req.goal];
  const bodyN = { lower: T("Lower Body", "פלג גוף תחתון"), upper: T("Upper Body", "פלג גוף עליון"), full: T("Full Body", "כל הגוף") }[req.body];
  return { name: `${bodyN} ${name}`, goal: sections.map((s) => s.name).join(" · "), sections, req };
}
function progressionAdvice() {
  return T("Next-week progression:\n• Keep the plyo prep the same; add 1 set only if contacts stay quick and quiet.\n• Power tri-set: keep reps, add 5% load to the loaded jump if bar speed holds; stop a set when jump height drops.\n• Strength: add 2.5–5 kg when all sets hit the top of the rep range at RPE ≤ 8.\n• Every 4th week, deload: same exercises, ~60% of the sets.",
    "התקדמות לשבוע הבא:\n• הכנה פליאומטרית: אותו נפח; מוסיפים סט רק אם המגע עם הקרקע נשאר מהיר ושקט.\n• טרי-סט כוח מתפרץ: אותן חזרות, +5% משקל בקפיצה עם משקל אם מהירות המוט נשמרת; עוצרים סט כשגובה הקפיצה יורד.\n• כוח: +2.5–5 ק״ג כשכל הסטים מגיעים לראש טווח החזרות ב-RPE 8 ומטה.\n• כל שבוע רביעי — שבוע הורדה: אותם תרגילים, כ-60% מהסטים.");
}

/* ---------- assistant pane inside the builder ---------- */
function assistantPane() {
  const msgs = S.edit.aiMsgs || [];
  const ideas = [T("Build a full lower body power workout with a dynamic warm-up, mobility, plyo prep and a power section", "תבנה אימון כוח מתפרץ לפלג גוף תחתון עם חימום דינמי, מוביליטי, הכנה פליאומטרית ומקטע כוח מתפרץ"), T("Upper body strength with accessory supersets and core", "כוח פלג גוף עליון עם סופרסטים של תרגילי עזר וליבה"), T("Speed and change of direction session, 45 min", "אימון מהירות ושינויי כיוון, 45 דק׳"), T("Suggest next week's progression", "תציע התקדמות לשבוע הבא")];
  return `<div class="hd"><h3>${icon("spark")} Workout assistant</h3></div>
  <div class="wb-scroll"><div class="ai-msgs">
    <div class="ai-msg">${esc(T("Hi! I build workouts from your exercise library. I can create complete workouts, add sections and supersets, and suggest progressions. Everything I add stays editable.", "היי! אני בונה אימונים מספריית התרגילים שלך: אימונים שלמים, מקטעים וסופרסטים, והצעות להתקדמות. כל מה שאני מוסיף נשאר ניתן לעריכה."))}</div>
    ${msgs.map((m) => `<div class="ai-msg${m.me ? " me" : ""}" translate="no">${esc(m.text)}</div>`).join("")}
    ${S.edit.aiBusy ? `<div class="ai-msg"><span class="spinner"></span></div>` : ""}
    ${msgs.length ? "" : `<div class="chips">${ideas.map((q) => `<button class="chip" data-act="wbai-ask" data-q="${esc(q)}" translate="no">${esc(q)}</button>`).join("")}</div>`}
  </div></div>
  <form class="composer" data-form="wbai" style="padding:0 12px 12px"><textarea id="wbai_q" name="q" required maxlength="1000" placeholder="Ask to create a workout…" aria-label="Ask to create a workout"></textarea><button class="btn primary" aria-label="Send"${S.edit.aiBusy ? " disabled" : ""}>${icon("send")}</button></form>`;
}
async function wbAsk(q) {
  const w = S.edit.program; if (!w || S.edit.aiBusy) return;
  S.edit.aiMsgs = [...(S.edit.aiMsgs || []), { me: true, text: q }]; S.edit.aiBusy = true; render();
  let reply = "";
  try {
    const t = q.toLowerCase();
    if (/progress|התקדמות|next week|שבוע הבא/.test(t)) reply = progressionAdvice();
    else {
      let built = null;
      if (aiConnected()) { try { built = await llmWorkout(q); } catch (e) { console.warn(e); } }
      if (!built) built = buildWorkout(q);
      const empty = !w.sections.some((s) => s.items.length);
      if (empty) { w.name = w.name || built.name; w.goal = w.goal || built.goal; w.sections = built.sections; }
      else w.sections.push(...built.sections);
      S.edit.target = w.sections.length - 1; S.edit.dirtyW = true;
      const c = workoutCounts({ sections: built.sections });
      reply = T(`Added ${built.sections.length} sections, ${c.exercises} exercises:\n`, `הוספתי ${built.sections.length} מקטעים ו-${c.exercises} תרגילים:\n`) + built.sections.map((s) => `• ${s.name} (${s.items.length})`).join("\n") + T("\n\nColored bars are supersets. Tap an exercise to see its video, change sets, reps and rest, then Save.", "\n\nפסים צבעוניים מסמנים סופרסטים. לחיצה על תרגיל מציגה את הסרטון; שנו סטים, חזרות ומנוחה ולחצו שמירה.");
      if (matchMedia("(max-width:860px)").matches) S.sel.wbPane = "work";
    }
  } catch (e) { reply = T("I couldn't build that. Try describing the body part, goal and sections.", "לא הצלחתי לבנות את זה. נסו לתאר אזור בגוף, מטרה ומקטעים."); }
  S.edit.aiMsgs.push({ me: false, text: reply }); S.edit.aiBusy = false; render();
}
ACTIONS["wbai-ask"] = (d) => wbAsk(d.q);
FORMS.wbai = (fd) => { const q = String(fd.get("q") || "").trim(); if (q) wbAsk(q); return Promise.resolve(true); };

/* ---------- academy assistant (staff): answers from the academy's own data ---------- */
function builtinAnswer(q) {
  const t = q.toLowerCase(); const d = today(); const ids = athleteIds();
  if (/attention|תשומת|risk|סיכון|who needs/.test(t)) {
    const lines = [];
    ids.forEach((u) => { const r = acwr(u); if (r && r > 1.5) lines.push(T(`• ${nameOf(u)}: load spike (ACWR ${r.toFixed(2)}). Reduce volume this week.`, `• ${nameOf(u)}: קפיצת עומס (ACWR ${r.toFixed(2)}). להוריד נפח השבוע.`)); else if (r && r < 0.8) lines.push(T(`• ${nameOf(u)}: low load (ACWR ${r.toFixed(2)}). Check in.`, `• ${nameOf(u)}: עומס נמוך (ACWR ${r.toFixed(2)}). כדאי לבדוק מה קורה.`));
      const pain = workoutsOf(u).filter((w) => w.date >= addDays(d, -7) && w.pain && w.pain !== "none"); if (pain.length) lines.push(T(`• ${nameOf(u)}: reported ${pain[pain.length - 1].pain} pain on ${fmtDay(pain[pain.length - 1].date)}.`, `• ${nameOf(u)}: דיווח על כאב (${pain[pain.length - 1].pain}) ב-${fmtDay(pain[pain.length - 1].date)}.`));
      const missed = sessionsOf(u).filter((s) => s.date < d && s.date >= addDays(d, -7) && !logOf(u, s.id)?.done).length; if (missed >= 2) lines.push(T(`• ${nameOf(u)}: ${missed} sessions not logged this week.`, `• ${nameOf(u)}: ${missed} אימונים לא דווחו השבוע.`)); });
    return lines.length ? T("Needs attention this week:\n", "דורשים תשומת לב השבוע:\n") + lines.join("\n") : T("Nobody stands out this week: no load spikes, pain reports or repeated missed sessions.", "אף אחד לא בולט השבוע: אין קפיצות עומס, דיווחי כאב או אימונים שהוחמצו.");
  }
  if (/today|היום|sessions|אימונים של/.test(t)) {
    const g = groupSessions(allSessions().filter((s) => s.date === d));
    return g.length ? T("Today:\n", "היום:\n") + g.map((s) => `• ${s.time || "—"} ${s.title || s.type} · ${s.athletes.length} ${T("athletes", "ספורטאים")} · ${s.athletes.filter((u) => logOf(u, s.id)?.done).length} ${T("done", "בוצעו")}`).join("\n") : T("No sessions today.", "אין אימונים היום.");
  }
  if (/sprint|ספרינט|test|מבדק|compare|השוו/.test(t)) {
    const defs = settings().tests.filter((x) => /sprint/i.test(x.id + x.name)); const out = [];
    defs.forEach((def) => { const rows = ids.map((u) => { const r = testsOf(u).filter((x) => x.test === def.id); return r.length ? { u, last: r[r.length - 1], prev: r[r.length - 2] } : null; }).filter(Boolean).sort((a, b) => a.last.value - b.last.value);
      if (rows.length) out.push(`${tr(def.name)}:\n` + rows.map((r, i) => `${i + 1}. ${nameOf(r.u)} ${r.last.value}${def.unit}${r.prev ? ` (${r.last.value <= r.prev.value ? "▲" : "▼"} ${Math.abs(r.last.value - r.prev.value).toFixed(2)})` : ""}`).join("\n")); });
    return out.length ? out.join("\n\n") : T("No sprint results recorded yet. Add them on the Testing page.", "עדיין אין תוצאות ספרינט. הוסיפו אותן בעמוד המבדקים.");
  }
  if (/meal|ארוח|nutrition|תזונה/.test(t)) return T("Message draft:\n\nHi team! Quick reminder to log every meal in the app today, with a photo if you can. It takes 20 seconds and helps us fuel your training properly. Thanks! 💪", "טיוטת הודעה:\n\nהיי צוות! תזכורת קצרה לתעד היום כל ארוחה באפליקציה, עם תמונה אם אפשר. זה לוקח 20 שניות ועוזר לנו לתדלק את האימונים שלכם נכון. תודה! 💪");
  if (/block|בלוק|plan|תוכנית|week|שבוע|program/.test(t)) return T("4-week in-season strength block (2 sessions/week):\nWeek 1: 3×5 main lifts @ RPE 7, power tri-set 3×3, accessories 2×10.\nWeek 2: 4×5 @ RPE 7–8, tri-set 4×3.\nWeek 3: 4×4 @ RPE 8, tri-set 4×3, accessories 3×8.\nWeek 4: deload: 2×5 @ RPE 6, tri-set 2×3.\nOpen the workout planner and ask me to build any of these sessions.", "בלוק כוח בעונה ל-4 שבועות (2 אימונים בשבוע):\nשבוע 1: 3×5 בתרגילים המרכזיים ב-RPE 7, טרי-סט כוח מתפרץ 3×3, עזר 2×10.\nשבוע 2: 4×5 ב-RPE 7–8, טרי-סט 4×3.\nשבוע 3: 4×4 ב-RPE 8, טרי-סט 4×3, עזר 3×8.\nשבוע 4: הורדה — 2×5 ב-RPE 6, טרי-סט 2×3.\nפתחו את מתכנן האימונים ובקשו ממני לבנות כל אחד מהאימונים.");
  return T("I can help with:\n• Who needs attention this week\n• Today's sessions\n• Comparing sprint and test results\n• A 4-week training block\n• A message reminding athletes to log meals\nTo build a workout, open the Workout planner and use the assistant there.", "אני יכול לעזור עם:\n• מי צריך תשומת לב השבוע\n• האימונים של היום\n• השוואת תוצאות ספרינט ומבדקים\n• בלוק אימונים ל-4 שבועות\n• הודעת תזכורת לתיעוד ארוחות\nכדי לבנות אימון, פתחו את מתכנן האימונים והשתמשו בעוזר שם.");
}

/* ---------- optional AI provider through the server function ---------- */
const aiConnected = () => !!(APPCFG.ai && SB);
async function callAI(body) {
  const { data, error } = await SB.functions.invoke("academy-ai", { body: { academy: S.academy.id, lang: LANG, ...body } });
  if (error) throw error; if (!data || data.error) throw new Error((data && data.error) || "no answer"); return data;
}
async function llmWorkout(q) {
  const req = parseRequest(q); const names = libraryItems().filter((x) => req.body === "full" || (x.t || []).includes(req.body === "lower" ? "lower body" : "upper body") || ["mobility", "core", "plyometrics", "power"].includes(x.c)).slice(0, 220).map((x) => `${x.n} [${x.c}]`);
  const data = await callAI({ mode: "workout", request: q, library: names });
  const w = data.workout; if (!w || !Array.isArray(w.sections)) return null;
  return { name: String(w.name || "").slice(0, 80), goal: q.slice(0, 300), sections: w.sections.slice(0, 8).map((s) => ({ id: wid(), name: String(s.name || "").slice(0, 60), note: String(s.note || "").slice(0, 160), items: (s.items || []).slice(0, 8).map((it) => { const fields = WB_FIELDS.map((f) => f[0]).filter((f) => (it.sets || []).some((st) => st && st[f] != null && st[f] !== "")); const item = newItem(String(it.ex || "").slice(0, 80), { ss: SS_COLORS.includes(it.ss) ? it.ss : null, cue: String(it.cue || "").slice(0, 300), fields: fields.length ? fields : ["reps", "rest"], sets: Math.min(10, Math.max(1, (it.sets || []).length || 3)) }); (it.sets || []).slice(0, 10).forEach((st, k) => { if (item.sets[k]) fields.forEach((f) => { item.sets[k][f] = String(st[f] ?? "").slice(0, 20); }); }); return item; }) })) };
}
// the academy assistant view uses S.sample: built-in answers, or the connected AI provider
function makeAssistant() {
  const fn = async (msgs, opts = {}) => {
    const q = msgs[msgs.length - 1].content.split("QUESTION\n").pop();
    if (aiConnected()) { try { const data = await callAI({ mode: "chat", messages: msgs.slice(-10).map((m) => ({ role: m.role, content: String(m.content).slice(0, 6000) })) }); opts.onText && opts.onText({ text: data.text }); return { text: data.text }; } catch (e) { console.warn(e); } }
    const text = builtinAnswer(q); opts.onText && opts.onText({ text }); return { text };
  };
  fn.json = async (prompt) => { if (!aiConnected()) throw { code: "not_configured", message: "AI is not connected" }; const data = await callAI({ mode: "json", prompt }); return data.json; };
  fn.limits = async () => ({ images: false });
  return fn;
}
