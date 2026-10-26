import { staffAlerts, LOW_RECOVERY, type AlertKind } from "@/lib/alerts";
import { HIGH_RATIO, LOW_RATIO, workloads, type LoadEntry, type Workload } from "@/lib/gps/workload";
import { daysOut, returnOutlook } from "@/lib/injury";
import { readinessFlag, wellnessIndex } from "@/lib/metrics";
import type { Lang } from "./engine";
import { normalize } from "./engine";

/**
 * Answers about the asker's own data (athlete) or the athletes they can see (staff).
 * Pure: the server action loads rows under the signed-in person's database permissions and hands them in.
 * Reports facts and the app's own thresholds; it never diagnoses, predicts injury or clears anyone.
 */

export const INTENTS = ["summary", "workload", "readiness", "injuries", "recovery", "alerts"] as const;
export type Intent = (typeof INTENTS)[number];

const WORD: Record<Exclude<Intent, "summary" | "alerts">, RegExp> = {
  workload: /\b(workload|work load|acwr|load ratio|training load|acute chronic)\b|עומס/,
  readiness: /\b(readiness|wellness|check in|checked in|check ins)\b|מוכנות|רווחה|שאלון/,
  injuries: /\b(injur\w*|rehab stage|return to play)\b|פציע|שיקום/,
  recovery: /\b(recovery|hrv|whoop|resting heart rate|sleep)\b|התאוששות|שינה|וופ|דופק מנוחה/,
};
// "my X", "show X", "how is X": a request for the numbers, not a question about what the numbers mean.
const ASK_OWN = /\b(show|check|what is|what s|whats|how is|how are|how was|give me|my latest|my current|my last|my today)\b|הראה|תראה|מה ה|איך ה|מה מצב|מה המצב|מה הנתונים/;
const OWN = /\b(my|me|i)\b|שלי|אצלי|אותי/;
const ABOUT_ME = /\bhow am i\b|\bhow m i\b|\bmy (week|status|summary|numbers|data|overview)\b|איך אני|הסיכום שלי|המצב שלי|הנתונים שלי|השבוע שלי/;
const TEAM = /\b(who|which (athletes|players)|any(one| athlete| player)|everyone|the team|my team|my squad|squad|our)\b|^מי\b|\sמי\s|אילו (ספורטאים|שחקנים)|מישהו|כל הצוות|הקבוצה|הסגל/;
const ALERTS = /\b(alerts?|flagged|flags|at risk|attention|needs attention|red flag|concern\w*)\b|התראות|התראה|בסיכון|תשומת לב|מסומנ|דורש/;

/** What data question this is, or null when it is a general question for the knowledge base. */
export function detectIntent(question: string, isStaff: boolean): Intent | null {
  const q = normalize(question);
  const metric = (Object.keys(WORD) as (keyof typeof WORD)[]).find((k) => WORD[k].test(q)) ?? null;

  if (isStaff) {
    if (ALERTS.test(q) && (TEAM.test(q) || !metric)) return "alerts";
    if (metric && TEAM.test(q)) return metric;
    if (/\bwhat needs attention\b|\bteam (status|overview|summary)\b|סקירה|סיכום הקבוצה|מה דורש/.test(q)) return "alerts";
    return null;
  }
  if (ABOUT_ME.test(q)) return "summary";
  if (metric && OWN.test(q) && ASK_OWN.test(q)) return metric;
  if (metric && /^(my|שלי)\s/.test(q)) return metric;
  return null;
}

// ---- data the loader supplies ------------------------------------------------------------------------------

export interface ReadinessRow { athleteId: string; date: string; sleepQuality: number | null; fatigue: number | null; soreness: number | null; stress: number | null; mood: number | null; motivation: number | null; pain: boolean }
export interface InjuryRow { athleteId: string; area: string; stage: string; injuryDate: string; expectedReturn: string | null }
export interface WearableRow { athleteId: string; day: string; recovery: number | null; hrv: number | null; sleepHours: number | null; restingHr: number | null }
export interface PersonalData {
  today: string;
  /** Athlete id -> display name for everyone in the data (just the asker for athletes). */
  names: Record<string, string>;
  /** Every active athlete the asker can see; staff only, used for "who has not checked in". */
  roster: string[];
  load: LoadEntry[];
  readiness: ReadinessRow[];
  injuries: InjuryRow[];
  wearable: WearableRow[];
}

// ---- wording -----------------------------------------------------------------------------------------------

const T = {
  en: {
    noData: "I can't find any of that data yet.",
    asOf: (d: string) => `_From the data you can see in the app on ${d}. These are the app's own thresholds, not a diagnosis; a qualified professional decides on any change to training or return to play._`,
    area: (a: string) => a.replace(/_/g, " "),
    stage: { rest: "rest", rehab: "rehab", running: "running", modified: "modified training", full: "full training", cleared: "cleared" } as Record<string, string>,
    ratioLabel: { high: "higher than usual", ok: "in the usual range", low: "lower than usual", unknown: "not enough history yet" } as Record<string, string>,
    alert: { workload_high: (v: number) => `workload ratio ${v} (above ${HIGH_RATIO})`, workload_low: (v: number) => `workload ratio ${v} (below ${LOW_RATIO})`, recovery_low: (v: number) => `shared recovery ${v}% (below ${LOW_RECOVERY}%)` } as Record<AlertKind, (v: number) => string>,
    h: { summary: "Your overview", workload: "Training load", readiness: "Wellness check-ins", injuries: "Injuries", recovery: "Recovery and sleep", alerts: "What needs attention" },
  },
  he: {
    noData: "אני עדיין לא מוצא נתונים כאלה.",
    asOf: (d: string) => `_מתוך הנתונים שאתם רואים באפליקציה ב-${d}. אלה הספים של האפליקציה, לא אבחון; איש מקצוע מוסמך מחליט על כל שינוי באימון או בחזרה למשחק._`,
    area: (a: string) => ({ hamstring: "ירך אחורית", quadriceps: "ירך קדמית", groin: "מפשעה", calf: "תאומים", ankle: "קרסול", knee: "ברך", hip: "ירך", foot: "כף רגל", lower_back: "גב תחתון", shoulder: "כתף", head: "ראש", other: "אחר" } as Record<string, string>)[a] ?? a,
    stage: { rest: "מנוחה", rehab: "שיקום", running: "ריצה", modified: "אימון מותאם", full: "אימון מלא", cleared: "אושר" } as Record<string, string>,
    ratioLabel: { high: "גבוה מהרגיל", ok: "בטווח הרגיל", low: "נמוך מהרגיל", unknown: "אין עדיין מספיק היסטוריה" } as Record<string, string>,
    alert: { workload_high: (v: number) => `יחס עומס ${v} (מעל ${HIGH_RATIO})`, workload_low: (v: number) => `יחס עומס ${v} (מתחת ל-${LOW_RATIO})`, recovery_low: (v: number) => `התאוששות משותפת ${v}% (מתחת ל-${LOW_RECOVERY}%)` } as Record<AlertKind, (v: number) => string>,
    h: { summary: "הסקירה שלכם", workload: "עומס אימונים", readiness: "שאלוני רווחה", injuries: "פציעות", recovery: "התאוששות ושינה", alerts: "מה דורש תשומת לב" },
  },
} as const;

const r1 = (n: number) => Math.round(n * 10) / 10;
const name = (d: PersonalData, id: string) => d.names[id] ?? "—";

const wIndex = (r: ReadinessRow) => wellnessIndex({ sleep_quality: r.sleepQuality, fatigue: r.fatigue, soreness: r.soreness, stress: r.stress, mood: r.mood, motivation: r.motivation });

// ---- athlete -----------------------------------------------------------------------------------------------

function athleteWorkload(d: PersonalData, lang: Lang): string[] {
  const t = T[lang];
  const w: Workload | undefined = workloads(d.load, d.today)[0];
  if (!w) return [lang === "he" ? "אין עדיין נתוני GPS עבורכם. כשהצוות יעלה אימונים, העומס יוצג כאן." : "There are no GPS sessions for you yet. Once staff import sessions, your load shows here."];
  if (w.ratio === null) return [lang === "he" ? "אין עדיין מספיק היסטוריה לחישוב יחס עומס (נדרשות בערך שבועיים של נתונים)." : "There isn't enough history yet to work out a load ratio (about two weeks of data are needed)."];
  const line = lang === "he"
    ? `ב-7 הימים האחרונים צברתם עומס **${w.acute}**, לעומת ממוצע שבועי של **${w.chronic}** ב-28 הימים. היחס הוא **${w.ratio}**: ${t.ratioLabel[w.status]}.`
    : `Your load over the last 7 days is **${w.acute}**, against a weekly average of **${w.chronic}** over 28 days. The ratio is **${w.ratio}**: ${t.ratioLabel[w.status]}.`;
  const tip = w.status === "high"
    ? (lang === "he" ? "זה סימן להסתכל מקרוב, לא סיבה לדאגה בפני עצמו. ספרו לצוות איך אתם מרגישים ושמרו על שינה ותזונה טובות." : "That is a prompt to look closer, not a worry in itself. Tell your staff how you feel and protect sleep and food.")
    : w.status === "low"
      ? (lang === "he" ? "העומס שלכם נמוך מהרגיל; הצוות יכול להחליט אם להעלות אותו בהדרגה." : "Your load is lower than usual; staff can decide whether to build it back up gradually.")
      : (lang === "he" ? "העומס בטווח הרגיל שלכם." : "Your load is in your usual range.");
  return [line, tip, lang === "he" ? `הספים של האפליקציה: מעל ${HIGH_RATIO} או מתחת ל-${LOW_RATIO}.` : `The app flags a ratio above ${HIGH_RATIO} or below ${LOW_RATIO}.`];
}

function athleteReadiness(d: PersonalData, lang: Lang): string[] {
  const rows = [...d.readiness].sort((a, b) => b.date.localeCompare(a.date));
  if (rows.length === 0) return [lang === "he" ? "עוד לא מילאתם שאלון יומי. אפשר לעשות זאת ב**מוכנות**, זה לוקח פחות מדקה." : "You haven't filled in a daily check-in yet. Do it in **Readiness**; it takes under a minute."];
  const latest = rows[0];
  const idx = wIndex(latest);
  const prior = rows.slice(1, 15).map(wIndex);
  const flagged = readinessFlag(idx, prior);
  const priorVals = prior.filter((v): v is number => v != null);
  const avg = priorVals.length ? priorVals.reduce((a, b) => a + b, 0) / priorVals.length : null;
  const out: string[] = [];
  out.push(lang === "he"
    ? `השאלון האחרון הוא מ-${latest.date}: מדד רווחה **${idx == null ? "—" : r1(idx)}** מתוך 5${avg != null ? ` (הממוצע האחרון שלכם ${r1(avg)})` : ""}.`
    : `Your latest check-in is from ${latest.date}: wellness index **${idx == null ? "—" : r1(idx)}** out of 5${avg != null ? ` (your recent average is ${r1(avg)})` : ""}.`);
  if (flagged) out.push(lang === "he" ? "זה נמוך בבירור מהממוצע שלכם, ולכן הצוות מקבל סימון. כדאי לספר להם מה קורה." : "That is clearly below your own average, so staff get a flag. It helps to tell them what is going on.");
  if (latest.pain) out.push(lang === "he" ? "דיווחתם על כאב. אם הוא נמשך או מחמיר, פנו לפיזיותרפיסט או לרופא." : "You reported pain. If it persists or gets worse, see your physiotherapist or a doctor.");
  if (latest.date !== d.today) out.push(lang === "he" ? "עוד לא מילאתם את השאלון של היום." : "You haven't filled in today's check-in yet.");
  return out;
}

function athleteInjuries(d: PersonalData, lang: Lang): string[] {
  const t = T[lang];
  if (d.injuries.length === 0) return [lang === "he" ? "אין פציעות פתוחות רשומות עבורכם." : "There are no open injuries recorded for you."];
  return d.injuries.map((i) => {
    const out = returnOutlook(i.expectedReturn, d.today);
    const days = daysOut(i.injuryDate, d.today);
    const when = out.kind === "ahead" ? (lang === "he" ? `החזרה צפויה בעוד ${out.days} ימים` : `expected back in ${out.days} days`)
      : out.kind === "today" ? (lang === "he" ? "החזרה צפויה היום" : "expected back today")
      : out.kind === "overdue" ? (lang === "he" ? `תאריך החזרה הצפוי עבר לפני ${out.days} ימים` : `expected return date passed ${out.days} days ago`)
      : (lang === "he" ? "אין תאריך חזרה צפוי" : "no expected return date");
    return lang === "he"
      ? `- **${t.area(i.area)}**: שלב ${t.stage[i.stage] ?? i.stage}, ${days} ימים מאז הפציעה, ${when}.`
      : `- **${t.area(i.area)}**: stage ${t.stage[i.stage] ?? i.stage}, ${days} days since the injury, ${when}.`;
  });
}

function athleteRecovery(d: PersonalData, lang: Lang): string[] {
  const rows = [...d.wearable].filter((r) => r.recovery != null || r.sleepHours != null).sort((a, b) => b.day.localeCompare(a.day));
  if (rows.length === 0) return [lang === "he" ? "אין עדיין נתוני מכשיר לביש. אפשר לחבר WHOOP או לייבא קובץ Fitbit ב**מכשירים לבישים**." : "There is no wearable data yet. Connect WHOOP or import a Fitbit file in **Wearables**."];
  const l = rows[0];
  const last7 = rows.slice(0, 7);
  const avg = (f: (r: WearableRow) => number | null) => { const v = last7.map(f).filter((x): x is number => x != null); return v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const bits = [
    l.recovery != null ? (lang === "he" ? `התאוששות **${Math.round(l.recovery)}%**` : `recovery **${Math.round(l.recovery)}%**`) : null,
    l.hrv != null ? `HRV **${r1(l.hrv)} ms**` : null,
    l.sleepHours != null ? (lang === "he" ? `שינה **${r1(l.sleepHours)} שעות**` : `sleep **${r1(l.sleepHours)} h**`) : null,
    l.restingHr != null ? (lang === "he" ? `דופק מנוחה **${Math.round(l.restingHr)}**` : `resting heart rate **${Math.round(l.restingHr)}**`) : null,
  ].filter(Boolean);
  const out = [lang === "he" ? `הנתון האחרון (${l.day}): ${bits.join(", ")}.` : `Latest reading (${l.day}): ${bits.join(", ")}.`];
  const ar = avg((r) => r.recovery), as = avg((r) => r.sleepHours);
  if (ar != null || as != null) out.push(lang === "he" ? `ממוצע ${last7.length} הימים האחרונים: ${ar != null ? `התאוששות ${ar}%` : ""}${ar != null && as != null ? ", " : ""}${as != null ? `שינה ${as} שעות` : ""}.` : `Average of the last ${last7.length} days: ${ar != null ? `recovery ${ar}%` : ""}${ar != null && as != null ? ", " : ""}${as != null ? `sleep ${as} h` : ""}.`);
  if (l.recovery != null && l.recovery < LOW_RECOVERY) out.push(lang === "he" ? "ההתאוששות נמוכה היום. שימו לב לתחושה, וקחו אימון קל יותר אם נראה לכם נכון; כדאי לעדכן את הצוות." : "Recovery is low today. Listen to how you feel and consider an easier session; it's worth telling your staff.");
  out.push(lang === "he" ? "המספרים יחסיים לבסיס האישי שלכם; מגמה של כמה ימים חשובה יותר מיום בודד." : "These numbers are relative to your own baseline; a trend over several days matters more than one day.");
  return out;
}

// ---- staff -------------------------------------------------------------------------------------------------

function staffAlertLines(d: PersonalData, lang: Lang): string[] {
  const t = T[lang];
  const daily = d.wearable.map((w) => ({ athleteId: w.athleteId, day: w.day, recovery: w.recovery }));
  const alerts = staffAlerts(d.load, daily, d.today);
  if (alerts.length === 0) return [lang === "he" ? "אין התראות עומס או התאוששות כרגע." : "No workload or recovery alerts right now."];
  return alerts.slice(0, 12).map((a) => `- **${name(d, a.athleteId)}**: ${t.alert[a.kind](a.value)}`);
}

function staffWorkload(d: PersonalData, lang: Lang): string[] {
  const t = T[lang];
  const all = workloads(d.load, d.today);
  if (all.length === 0) return [lang === "he" ? "אין עדיין נתוני GPS בסגל שלכם." : "There are no GPS sessions for your athletes yet."];
  const flagged = all.filter((w) => w.status === "high" || w.status === "low");
  const lines = flagged.slice(0, 12).map((w) => `- **${name(d, w.athleteId)}**: ${lang === "he" ? "יחס" : "ratio"} ${w.ratio} (${t.ratioLabel[w.status]}); ${lang === "he" ? "7 ימים" : "7 days"} ${w.acute}, ${lang === "he" ? "ממוצע שבועי" : "weekly average"} ${w.chronic}`);
  const unknown = all.filter((w) => w.status === "unknown").length;
  const head = flagged.length
    ? (lang === "he" ? `${flagged.length} מתוך ${all.length} ספורטאים מחוץ לטווח הרגיל (${LOW_RATIO} עד ${HIGH_RATIO}):` : `${flagged.length} of ${all.length} athletes are outside the usual range (${LOW_RATIO} to ${HIGH_RATIO}):`)
    : (lang === "he" ? `כל ${all.length - unknown} הספורטאים עם מספיק היסטוריה בטווח הרגיל.` : `All ${all.length - unknown} athletes with enough history are in the usual range.`);
  const tail = unknown ? [lang === "he" ? `ל-${unknown} ספורטאים אין עדיין מספיק היסטוריה.` : `${unknown} athlete(s) don't have enough history yet.`] : [];
  return [head, ...lines, ...tail];
}

function staffReadiness(d: PersonalData, lang: Lang): string[] {
  const byAthlete = new Map<string, ReadinessRow[]>();
  for (const r of d.readiness) byAthlete.set(r.athleteId, [...(byAthlete.get(r.athleteId) ?? []), r]);
  const flagged: string[] = [];
  const done = new Set<string>();
  for (const [id, rows] of byAthlete) {
    const sorted = rows.sort((a, b) => b.date.localeCompare(a.date));
    const todays = sorted.find((r) => r.date === d.today);
    if (!todays) continue;
    done.add(id);
    const idx = wIndex(todays);
    const prior = sorted.filter((r) => r.date < d.today).map(wIndex);
    if (todays.pain || readinessFlag(idx, prior)) {
      flagged.push(`- **${name(d, id)}**: ${idx == null ? "—" : r1(idx)}/5${todays.pain ? (lang === "he" ? ", דווח כאב" : ", pain reported") : ""}`);
    }
  }
  const missing = d.roster.filter((id) => !done.has(id)).map((id) => name(d, id));
  const out: string[] = [];
  out.push(lang === "he" ? `מילאו שאלון היום: ${done.size} מתוך ${d.roster.length || done.size}.` : `Checked in today: ${done.size} of ${d.roster.length || done.size}.`);
  out.push(flagged.length ? (lang === "he" ? "מסומנים היום:" : "Flagged today:") : (lang === "he" ? "אין סימוני רווחה היום." : "No wellness flags today."));
  out.push(...flagged.slice(0, 12));
  if (missing.length) out.push(lang === "he" ? `עוד לא מילאו: ${missing.slice(0, 15).join(", ")}${missing.length > 15 ? ` ועוד ${missing.length - 15}` : ""}.` : `Not yet checked in: ${missing.slice(0, 15).join(", ")}${missing.length > 15 ? ` and ${missing.length - 15} more` : ""}.`);
  return out;
}

function staffInjuries(d: PersonalData, lang: Lang): string[] {
  const t = T[lang];
  if (d.injuries.length === 0) return [lang === "he" ? "אין פציעות פתוחות בסגל שלכם." : "There are no open injuries among your athletes."];
  const sorted = [...d.injuries].sort((a, b) => a.injuryDate.localeCompare(b.injuryDate));
  const lines = sorted.slice(0, 15).map((i) => {
    const out = returnOutlook(i.expectedReturn, d.today);
    const days = daysOut(i.injuryDate, d.today);
    const flag = out.kind === "overdue" ? (lang === "he" ? ` (תאריך החזרה עבר לפני ${out.days} ימים)` : ` (expected return passed ${out.days} days ago)`) : "";
    return lang === "he"
      ? `- **${name(d, i.athleteId)}**: ${t.area(i.area)}, שלב ${t.stage[i.stage] ?? i.stage}, ${days} ימים${flag}`
      : `- **${name(d, i.athleteId)}**: ${t.area(i.area)}, stage ${t.stage[i.stage] ?? i.stage}, ${days} days${flag}`;
  });
  return [lang === "he" ? `${d.injuries.length} פציעות פתוחות:` : `${d.injuries.length} open injuries:`, ...lines];
}

function staffRecovery(d: PersonalData, lang: Lang): string[] {
  const latest = new Map<string, WearableRow>();
  for (const w of d.wearable) { if (w.recovery == null) continue; const c = latest.get(w.athleteId); if (!c || w.day > c.day) latest.set(w.athleteId, w); }
  if (latest.size === 0) return [lang === "he" ? "אין נתוני התאוששות משותפים. ספורטאים מחליטים אם לשתף את נתוני המכשיר שלהם עם הצוות." : "There is no shared recovery data. Athletes decide whether to share their wearable data with staff."];
  const low = [...latest.values()].filter((w) => w.recovery! < LOW_RECOVERY).sort((a, b) => a.recovery! - b.recovery!);
  const head = lang === "he" ? `נתונים משותפים מ-${latest.size} ספורטאים.` : `Shared data from ${latest.size} athlete(s).`;
  const body = low.length
    ? [lang === "he" ? `התאוששות נמוכה (מתחת ל-${LOW_RECOVERY}%):` : `Low recovery (below ${LOW_RECOVERY}%):`, ...low.slice(0, 12).map((w) => `- **${name(d, w.athleteId)}**: ${Math.round(w.recovery!)}% (${w.day})`)]
    : [lang === "he" ? "אף אחד מהם מתחת לסף ההתאוששות הנמוכה." : "None of them are below the low-recovery threshold."];
  return [head, ...body, lang === "he" ? "זה נתון אחד מתוך כמה; שוחחו עם הספורטאי לפני שמשנים משהו." : "This is one signal among several; talk to the athlete before changing anything."];
}

// ---- entry point -------------------------------------------------------------------------------------------

export function personalAnswer(intent: Intent, isStaff: boolean, d: PersonalData, lang: Lang): string {
  const t = T[lang];
  const section = (key: Intent, lines: string[]) => [`**${t.h[key]}**`, "", ...lines];
  const parts: string[][] = [];
  if (isStaff) {
    if (intent === "alerts") {
      parts.push(section("alerts", staffAlertLines(d, lang)), section("readiness", staffReadiness(d, lang)), section("injuries", staffInjuries(d, lang)));
    } else if (intent === "workload") parts.push(section("workload", staffWorkload(d, lang)));
    else if (intent === "readiness") parts.push(section("readiness", staffReadiness(d, lang)));
    else if (intent === "injuries") parts.push(section("injuries", staffInjuries(d, lang)));
    else parts.push(section("recovery", staffRecovery(d, lang)));
  } else {
    const make: Record<Exclude<Intent, "alerts">, () => string[]> = {
      workload: () => athleteWorkload(d, lang), readiness: () => athleteReadiness(d, lang), injuries: () => athleteInjuries(d, lang), recovery: () => athleteRecovery(d, lang),
      summary: () => [],
    };
    const keys: Exclude<Intent, "alerts" | "summary">[] = intent === "summary" || intent === "alerts" ? ["readiness", "workload", "recovery", "injuries"] : [intent];
    for (const k of keys) parts.push(section(k, make[k]()));
  }
  return [...parts.flatMap((p, i) => (i ? ["", ...p] : p)), "", t.asOf(d.today)].join("\n");
}

/** Which tables the loader needs for this question. */
export function needs(intent: Intent): { load: boolean; readiness: boolean; injuries: boolean; wearable: boolean } {
  if (intent === "summary" || intent === "alerts") return { load: true, readiness: true, injuries: true, wearable: true };
  return { load: intent === "workload", readiness: intent === "readiness", injuries: intent === "injuries", wearable: intent === "recovery" };
}
