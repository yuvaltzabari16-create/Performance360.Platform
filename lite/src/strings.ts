import en from "@/lib/i18n/en";
import he from "@/lib/i18n/he";
import type { Lang } from "./model";

/** Strings that only exist in Lite. Everything else (sections, fields, injury stages, assistant) reuses the app's own dictionaries. */
const liteEn = {
  title: "Performance360 Lite",
  tagline: "One file. Your data stays in this browser.",
  nav: { overview: "Overview", athletes: "Athletes", training: "Training", library: "Exercises", assistant: "Assistant", settings: "Settings" },
  common: {
    add: "Add", save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", back: "Back", search: "Search", all: "All", none: "None",
    name: "Name", date: "Date", notes: "Notes", sport: "Sport", position: "Position", unit: "Unit", value: "Value", saved: "Saved", yes: "Yes", no: "No",
    confirm: "Are you sure?", close: "Close", open: "Open", empty: "Nothing here yet.", days: "days",
  },
  welcome: {
    title: "Welcome",
    body: "This is the single-file version of Performance360. It works without internet and without an account, and it keeps everything in this browser on this device.",
    points: [
      "One person only: there are no logins, roles, invitations or messages. For a team with athletes who use their own phones, use the full Performance360 app.",
      "Your data is saved in this browser. Clearing the browser's data or opening the file in another browser starts from empty. Export a backup regularly (Settings).",
      "Nothing is sent anywhere. Exercise videos open on YouTube only when you click them.",
      "The assistant gives general information, not medical advice. It never diagnoses or clears anyone.",
    ],
    start: "Start",
  },
  storage: {
    memory: "This browser can't store data for this file, so what you enter will be lost when you close the page. Export a backup in Settings before you leave.",
    backupDue: "Last backup: {when}. Export a fresh backup in Settings.",
    neverBacked: "You have data but no backup yet. Export one in Settings.",
  },
  overview: {
    title: "Overview", attention: "Needs attention", none: "Nothing needs attention right now.",
    athletes: "Athletes", openInjuries: "Open injuries", checkedIn: "Checked in today", programs: "Programs",
    startHint: "Start by adding your first athlete.", addAthlete: "Add an athlete",
    alertHigh: "workload ratio {v} (above 1.5)", alertLow: "workload ratio {v} (below 0.8)",
    flagged: "Wellness flag today", noCheckIn: "No check-in today", overdue: "expected return date has passed",
  },
  athletes: {
    title: "Athletes", add: "Add athlete", empty: "No athletes yet.", detail: "Athlete", tabs: { checkIns: "Check-ins", tests: "Tests", injuries: "Injuries", load: "Load" },
    deleteWarn: "Delete this athlete and everything recorded for them? This can't be undone.", noteHelp: "Private notes for you.",
  },
  checkIn: { today: "Today's check-in", history: "Recent check-ins", index: "Wellness index", flagged: "Review", empty: "No check-ins yet." },
  tests: {
    title: "Tests", add: "Add test result", name: "Test (e.g. CMJ)", unit: "Unit (e.g. cm)", higher: "Higher is better", empty: "No test results yet.",
    best: "Best", last: "Last", change: "Change", count: "Results",
  },
  injuries: {
    title: "Injuries", add: "Report injury", area: "Body area", date: "Injury date", expected: "Expected return", note: "Note", stageNote: "Note (required to clear)",
    move: "Move to stage", timeline: "Timeline", open: "Open", resolved: "Resolved", empty: "No injuries recorded.",
    disclaimer: "Records the decision of a qualified person. It never diagnoses an injury or clears anyone by itself.",
    needNote: "Write the basis for clearing (at least 3 characters).",
  },
  load: {
    title: "Training load", add: "Add load", value: "Load (arbitrary units)", import: "Import CSV", importHelp: "Columns: athlete name, date (YYYY-MM-DD), load. A header row is fine.",
    imported: "{n} rows imported, {s} skipped.", ratio: "Ratio", acute: "7 days", chronic: "Weekly average (28 days)", status: { high: "High", ok: "In range", low: "Low", unknown: "Not enough history" },
    help: "Acute:chronic ratio above 1.5 or below 0.8 is flagged. A prompt to look closer, not a diagnosis.", empty: "No load recorded.",
  },
  training: {
    title: "Training", newProgram: "New program", programTitle: "Program title", newSession: "New session", sessionTitle: "Session title", empty: "No programs yet.",
    addFromLibrary: "Add from the library", copy: "Copy as text", copied: "Copied", print: "Print", remove: "Remove", noItems: "This session is empty.",
    pickSession: "Add to session", deleteProgram: "Delete this program?", build: "Auto-build session",
  },
  library: { title: "Exercise library", category: "Category", equipment: "Equipment", level: "Level", video: "Watch video", results: "{n} exercises", more: "Show more", add: "Add to a session", none: "No exercises match." },
  settings: {
    title: "Settings", language: "Language", theme: "Appearance", themes: { auto: "Automatic", light: "Light", dark: "Dark" },
    backup: "Backup", exportJson: "Export backup (JSON)", importJson: "Import backup", importWarn: "Importing replaces everything currently in this browser. Continue?",
    importOk: "Imported {a} athletes and {p} programs.", importErr: { not_json: "That file is not a backup.", too_new: "That backup comes from a newer version.", empty: "That file has no Performance360 data." },
    csv: "Export CSV", csvAthletes: "Athletes", csvCheckIns: "Check-ins", csvTests: "Tests", csvInjuries: "Injuries", csvLoad: "Load",
    danger: "Delete all data", dangerWarn: "Delete everything stored in this browser? Export a backup first. This can't be undone.",
    about: "About", aboutBody: "Performance360 Lite runs entirely in your browser. It has no accounts, no sharing between devices and no database-enforced privacy. Anyone who can open this browser profile can see the data.",
    storageIn: { indexeddb: "Saved in this browser (IndexedDB).", localstorage: "Saved in this browser (local storage).", memory: "Not saved: this browser blocks storage for this file." },
  },
};

type Dict = typeof liteEn;
const liteHe: Dict = {
  title: "Performance360 Lite",
  tagline: "קובץ אחד. המידע נשאר בדפדפן הזה.",
  nav: { overview: "סקירה", athletes: "ספורטאים", training: "אימונים", library: "תרגילים", assistant: "עוזר", settings: "הגדרות" },
  common: {
    add: "הוספה", save: "שמירה", cancel: "ביטול", delete: "מחיקה", edit: "עריכה", back: "חזרה", search: "חיפוש", all: "הכול", none: "ללא",
    name: "שם", date: "תאריך", notes: "הערות", sport: "ענף", position: "תפקיד", unit: "יחידה", value: "ערך", saved: "נשמר", yes: "כן", no: "לא",
    confirm: "בטוחים?", close: "סגירה", open: "פתיחה", empty: "אין כאן כלום עדיין.", days: "ימים",
  },
  welcome: {
    title: "ברוכים הבאים",
    body: "זו הגרסה בקובץ אחד של Performance360. היא עובדת בלי אינטרנט ובלי חשבון, ושומרת הכול בדפדפן הזה במכשיר הזה.",
    points: [
      "משתמש אחד בלבד: אין התחברות, תפקידים, הזמנות או הודעות. לצוות עם ספורטאים שמשתמשים בטלפון שלהם, השתמשו באפליקציית Performance360 המלאה.",
      "המידע נשמר בדפדפן הזה. ניקוי נתוני הדפדפן, או פתיחת הקובץ בדפדפן אחר, מתחילים מאפס. מומלץ לייצא גיבוי באופן קבוע (הגדרות).",
      "שום דבר לא נשלח לשום מקום. סרטוני התרגילים נפתחים ביוטיוב רק כשלוחצים עליהם.",
      "העוזר נותן מידע כללי ולא ייעוץ רפואי. הוא לא מאבחן ולא מאשר לאיש לחזור לשחק.",
    ],
    start: "מתחילים",
  },
  storage: {
    memory: "הדפדפן הזה לא מאפשר לשמור נתונים עבור הקובץ הזה, ולכן מה שתזינו יאבד כשתסגרו את הדף. ייצאו גיבוי בהגדרות לפני שתעזבו.",
    backupDue: "גיבוי אחרון: {when}. ייצאו גיבוי חדש בהגדרות.",
    neverBacked: "יש לכם נתונים אבל עוד אין גיבוי. ייצאו אחד בהגדרות.",
  },
  overview: {
    title: "סקירה", attention: "דורש תשומת לב", none: "שום דבר לא דורש תשומת לב כרגע.",
    athletes: "ספורטאים", openInjuries: "פציעות פתוחות", checkedIn: "מילאו שאלון היום", programs: "תוכניות",
    startHint: "מתחילים בהוספת הספורטאי הראשון.", addAthlete: "הוספת ספורטאי",
    alertHigh: "יחס עומס {v} (מעל 1.5)", alertLow: "יחס עומס {v} (מתחת ל-0.8)",
    flagged: "סימון רווחה היום", noCheckIn: "לא מילא שאלון היום", overdue: "תאריך החזרה הצפוי עבר",
  },
  athletes: {
    title: "ספורטאים", add: "הוספת ספורטאי", empty: "אין ספורטאים עדיין.", detail: "ספורטאי", tabs: { checkIns: "שאלונים", tests: "מבדקים", injuries: "פציעות", load: "עומס" },
    deleteWarn: "למחוק את הספורטאי ואת כל מה שנרשם עליו? אי אפשר לבטל.", noteHelp: "הערות פרטיות עבורכם.",
  },
  checkIn: { today: "שאלון של היום", history: "שאלונים אחרונים", index: "מדד רווחה", flagged: "לבדיקה", empty: "אין שאלונים עדיין." },
  tests: {
    title: "מבדקים", add: "הוספת תוצאת מבדק", name: "מבדק (למשל CMJ)", unit: "יחידה (למשל ס״מ)", higher: "ערך גבוה יותר הוא טוב יותר", empty: "אין תוצאות מבדק עדיין.",
    best: "הטוב ביותר", last: "אחרון", change: "שינוי", count: "תוצאות",
  },
  injuries: {
    title: "פציעות", add: "דיווח על פציעה", area: "אזור בגוף", date: "תאריך הפציעה", expected: "חזרה צפויה", note: "הערה", stageNote: "הערה (חובה באישור חזרה)",
    move: "מעבר לשלב", timeline: "ציר זמן", open: "פתוחה", resolved: "נסגרה", empty: "לא נרשמו פציעות.",
    disclaimer: "רושם את החלטתו של איש מקצוע מוסמך. לא מאבחן פציעות ולעולם לא מאשר חזרה בעצמו.",
    needNote: "כתבו את הנימוק לאישור החזרה (לפחות 3 תווים).",
  },
  load: {
    title: "עומס אימונים", add: "הוספת עומס", value: "עומס (יחידות שרירותיות)", import: "ייבוא CSV", importHelp: "עמודות: שם הספורטאי, תאריך (YYYY-MM-DD), עומס. שורת כותרת מותרת.",
    imported: "יובאו {n} שורות, דולגו {s}.", ratio: "יחס", acute: "7 ימים", chronic: "ממוצע שבועי (28 ימים)", status: { high: "גבוה", ok: "בטווח", low: "נמוך", unknown: "אין מספיק היסטוריה" },
    help: "יחס אקוטי:כרוני מעל 1.5 או מתחת ל-0.8 מסומן. סימן להסתכל מקרוב, לא אבחון.", empty: "לא נרשם עומס.",
  },
  training: {
    title: "אימונים", newProgram: "תוכנית חדשה", programTitle: "שם התוכנית", newSession: "אימון חדש", sessionTitle: "שם האימון", empty: "אין תוכניות עדיין.",
    addFromLibrary: "הוספה מהספרייה", copy: "העתקה כטקסט", copied: "הועתק", print: "הדפסה", remove: "הסרה", noItems: "האימון הזה ריק.",
    pickSession: "הוספה לאימון", deleteProgram: "למחוק את התוכנית?", build: "בניית אימון אוטומטית",
  },
  library: { title: "ספריית תרגילים", category: "קטגוריה", equipment: "ציוד", level: "רמה", video: "צפייה בסרטון", results: "{n} תרגילים", more: "הצגת עוד", add: "הוספה לאימון", none: "אין תרגילים מתאימים." },
  settings: {
    title: "הגדרות", language: "שפה", theme: "מראה", themes: { auto: "אוטומטי", light: "בהיר", dark: "כהה" },
    backup: "גיבוי", exportJson: "ייצוא גיבוי (JSON)", importJson: "ייבוא גיבוי", importWarn: "הייבוא מחליף את כל מה שנמצא כרגע בדפדפן הזה. להמשיך?",
    importOk: "יובאו {a} ספורטאים ו-{p} תוכניות.", importErr: { not_json: "הקובץ הזה אינו גיבוי.", too_new: "הגיבוי הזה מגרסה חדשה יותר.", empty: "בקובץ הזה אין נתוני Performance360." },
    csv: "ייצוא CSV", csvAthletes: "ספורטאים", csvCheckIns: "שאלונים", csvTests: "מבדקים", csvInjuries: "פציעות", csvLoad: "עומס",
    danger: "מחיקת כל הנתונים", dangerWarn: "למחוק את כל מה ששמור בדפדפן הזה? ייצאו קודם גיבוי. אי אפשר לבטל.",
    about: "אודות", aboutBody: "Performance360 Lite רץ כולו בדפדפן שלכם. אין בו חשבונות, שיתוף בין מכשירים או הגנת פרטיות שנאכפת במסד נתונים. כל מי שיכול לפתוח את פרופיל הדפדפן הזה יכול לראות את הנתונים.",
    storageIn: { indexeddb: "נשמר בדפדפן הזה (IndexedDB).", localstorage: "נשמר בדפדפן הזה (אחסון מקומי).", memory: "לא נשמר: הדפדפן הזה חוסם אחסון עבור הקובץ הזה." },
  },
};

export const LITE: Record<Lang, Dict> = { en: liteEn, he: liteHe };
export const MAIN = { en, he } as const;
export const fill = (t: string, vars: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
