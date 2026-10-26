/**
 * Reads a coach's free-text request (English or Hebrew) into a structured spec.
 * Plain keyword tables, no network: the same text always gives the same spec.
 */

export const FOCUSES = ["strength", "power", "speed", "plyometrics", "mobility", "core", "conditioning", "rehab", "activation", "general"] as const;
export type Focus = (typeof FOCUSES)[number];
export type Region = "lower" | "upper" | "full";
export type Level = "beginner" | "intermediate" | "advanced";
export type Area = "hamstring" | "quadriceps" | "groin" | "calf" | "ankle" | "knee" | "hip" | "back" | "shoulder";

export interface WorkoutSpec {
  focus: Focus;
  region: Region;
  minutes: number;
  level: Level;
  /** Equipment that must not appear. */
  banned: string[];
  /** When set, only these items (plus bodyweight) may appear. */
  only: string[] | null;
  /** Body areas to keep light or out of the session. */
  avoid: Area[];
  /** Match-day proximity or "easy" requests: fewer sets, lower effort. */
  lowFatigue: boolean;
  language: "en" | "he";
}

const norm = (s: string) => s.toLowerCase().replace(/[֑-ׇ]/g, "").replace(/\s+/g, " ").trim();

const FOCUS_WORDS: [Focus, string[]][] = [
  ["rehab", ["return to play", "return-to-play", "rtp", "rehab", "post-injury", "after a", "שיקום", "חזרה למשחק", "חזרה לפעילות", "אחרי פציעה"]],
  ["power", ["power", "explosive", "olympic", "עוצמה", "מתפרץ", "התפרצות", "פיצוץ"]],
  ["speed", ["speed", "sprint", "acceleration", "agility", "change of direction", "cod", "מהירות", "ספרינט", "האצה", "זריזות", "שינוי כיוון"]],
  ["plyometrics", ["plyo", "jump", "פליו", "קפיצות", "קפיצה"]],
  ["conditioning", ["conditioning", "endurance", "cardio", "hiit", "כושר", "סיבולת", "אירובי"]],
  ["mobility", ["mobility", "flexibility", "stretch", "גמישות", "ניידות", "מתיחות"]],
  ["core", ["core", "abs", "trunk", "ליבה", "בטן"]],
  ["strength", ["strength", "hypertrophy", "muscle", "weights", "lifting", "כוח", "חיזוק", "שרירים", "משקולות"]],
  ["activation", ["activation", "pre-match", "prematch", "md-1", "md-2", "md-3", "match day", "הפעלה", "לפני משחק", "ערב משחק"]],
];

const AREA_WORDS: [Area, string[]][] = [
  ["hamstring", ["hamstring", "ירך אחורית", "המסטרינג", "שריר אחורי"]],
  ["quadriceps", ["quad", "ירך קדמית", "קוואדריספס"]],
  ["groin", ["groin", "adductor", "מפשעה", "אדוקטור"]],
  ["calf", ["calf", "achilles", "תאומים", "אכילס", "שוק"]],
  ["ankle", ["ankle", "קרסול"]],
  ["knee", ["knee", "acl", "ברך", "רצועה צולבת"]],
  ["hip", ["hip", "ירך", "אגן"]],
  ["back", ["back", "lumbar", "spine", "גב", "מותני"]],
  ["shoulder", ["shoulder", "rotator", "כתף", "אפקט"]],
];

const EQUIPMENT_WORDS: [string, string[]][] = [
  ["barbell", ["barbell", "מוט"]],
  ["dumbbell", ["dumbbell", "משקולות יד", "דמבל", "משקולת יד"]],
  ["machine", ["machine", "מכונה", "מכשיר"]],
  ["cable", ["cable", "כבל"]],
  ["band", ["band", "גומי", "רצועת התנגדות"]],
  ["kettlebell", ["kettlebell", "קטלבל"]],
  ["medicine ball", ["medicine ball", "med ball", "כדור כוח", "כדור מדיסין"]],
  ["box", ["box", "ארגז", "קופסה"]],
];

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

export function detectLanguage(text: string): "en" | "he" {
  const he = (text.match(/[֐-׿]/g) ?? []).length;
  const en = (text.match(/[a-z]/gi) ?? []).length;
  return he > en ? "he" : "en";
}

export function parseRequest(raw: string): WorkoutSpec {
  const text = norm(raw);
  const language = detectLanguage(text);

  let focus: Focus = "general";
  for (const [f, words] of FOCUS_WORDS) if (has(text, words)) { focus = f; break; }

  let region: Region = "full";
  if (has(text, ["lower body", "lower-body", "legs", "leg day", "פלג גוף תחתון", "רגליים", "תחתון"])) region = "lower";
  else if (has(text, ["upper body", "upper-body", "arms", "chest", "פלג גוף עליון", "ידיים", "עליון", "חזה"])) region = "upper";

  const m = text.match(/(\d{1,3})\s*(?:-|\s)?\s*(?:min|minutes|mins|דקות|דק')/) ?? text.match(/(?:דקות|min(?:utes)?)\s*(\d{2,3})/);
  const minutes = Math.min(120, Math.max(15, m ? Number(m[1]) : 60));

  let level: Level = "intermediate";
  if (has(text, ["beginner", "novice", "youth", "u12", "u13", "u14", "מתחיל", "נוער צעיר"])) level = "beginner";
  else if (has(text, ["advanced", "elite", "professional", "מתקדם", "עלית", "מקצועי"])) level = "advanced";

  const banned: string[] = [];
  let only: string[] | null = null;
  const bodyweightOnly = has(text, ["bodyweight only", "no equipment", "without equipment", "ללא ציוד", "בלי ציוד", "משקל גוף בלבד", "משקל גוף"]);
  if (bodyweightOnly) only = [];
  for (const [item, words] of EQUIPMENT_WORDS) {
    const named = words.filter((w) => text.includes(w));
    if (!named.length) continue;
    const negated = named.some((w) => new RegExp(`(?:no|without|avoid|ללא|בלי)\\s+(?:[a-z\\u0590-\\u05ff]+\\s+)?${w}`).test(text));
    const exclusive = named.some((w) => new RegExp(`${w}s?\\s+only|only\\s+${w}|${w}\\s+בלבד|רק\\s+${w}`).test(text));
    if (negated) banned.push(item);
    else if (exclusive) only = [...(only ?? []), item];
  }

  const avoid: Area[] = [];
  const injuryContext = focus === "rehab" || has(text, ["injur", "strain", "tear", "sprain", "pain", "sore", "פציע", "קרע", "נקע", "כאב", "מתיחה בשריר"]);
  const avoidContext = has(text, ["avoid", "without", "no ", "ללא", "בלי", "להימנע"]);
  if (injuryContext || avoidContext) for (const [a, words] of AREA_WORDS) if (has(text, words)) avoid.push(a);

  const lowFatigue = focus === "activation" || focus === "rehab" || has(text, ["pre-match", "prematch", "md-1", "md-2", "match day", "לפני משחק", "ערב משחק", "low fatigue", "easy", "light", "taper", "recovery day", "קל", "עייפות נמוכה", "ירידה בעומס"]);

  return { focus, region, minutes, level, banned, only, avoid, lowFatigue, language };
}
