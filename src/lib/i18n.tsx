import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "he" | "en";

const en = {
  appName: "Performance360",
  // nav
  overview: "Overview", players: "Players", squads: "Squads", staff: "Staff & invites", settings: "Settings",
  today: "Today", progress: "My progress", notesNav: "Coach notes",
  // auth
  signIn: "Sign in", signUp: "Create account", email: "Email", password: "Password", fullName: "Full name",
  haveAccount: "Already have an account?", noAccount: "New here?", signOut: "Sign out",
  checkEmail: "Check your email to confirm your account, then sign in.",
  authTagline: "Squad, wellness and readiness for your club — one place for coaches and athletes.",
  passwordHint: "At least 8 characters",
  // onboarding
  welcome: "Welcome", createClubT: "Set up your club", createClubSub: "You'll be the club director. You can invite coaches and athletes next.",
  clubName: "Club or academy name", createClub: "Create club",
  waitingInvite: "Joining an existing club?", waitingInviteSub: "Ask your coach or club director for an invite link and open it while signed in.",
  // invite
  inviteT: "You're invited", inviteTo: "to join", asRole: "as", forPlayer: "Player profile", accept: "Accept invite",
  inviteInvalid: "This invite link is no longer valid. Ask for a new one.", inviteSignIn: "Sign in or create an account to accept.",
  joined: "You joined the club",
  // roles & statuses
  role: { director: "Club director", coach: "Coach", athlete: "Athlete" },
  status: { available: "Available", injured: "Injured", rehab: "In rehab", unavailable: "Unavailable" },
  pos: { GK: "GK", DF: "DF", MF: "MF", FW: "FW" },
  foot: { left: "Left", right: "Right", both: "Both" },
  // overview
  playersK: "Players", availableK: "Available", checkedInK: "Checked in today", avgReadyK: "Avg readiness",
  needsAttention: "Needs attention", noAlerts: "No one flagged today.", todayCheckins: "Today's check-ins",
  lowReady: "Low readiness", pain: "Pain", noCheckin: "No check-in", allSquads: "All squads",
  // players
  roster: "Roster", addPlayer: "Add player", search: "Search players", name: "Name", squad: "Squad", noSquad: "No squad",
  position: "Position", number: "No.", readiness: "Readiness", account: "Athlete app", linked: "Connected",
  notLinked: "Not invited", invited: "Invite pending", dob: "Date of birth", heightCm: "Height (cm)", weightKg: "Weight (kg)",
  dominantFoot: "Dominant foot", statusL: "Status", notesL: "Notes", age: "Age", save: "Save", cancel: "Cancel",
  playerAdded: "Player added", saved: "Saved", back: "Back", details: "Details", edit: "Edit",
  coachSquadOnly: "You can add players to the squads you coach.",
  noPlayers: "No players yet. Add your first player.",
  archive: "Archive player", confirmArchive: "Tap again to archive", archived: "Player archived",
  // profile
  readiness14: "Readiness, last 14 days", recentCheckins: "Recent check-ins", noCheckins: "No check-ins yet.",
  athleteApp: "Athlete app access", inviteLink: "Invite link", createInvite: "Create invite link", copy: "Copy", copied: "Link copied",
  revoke: "Revoke", revoked: "Invite revoked", linkedNote: "This player is connected and can check in from their phone.",
  inviteNote: "Send this link to the player. It works once and expires in 14 days.",
  coachNotes: "Coach notes", addNote: "Add note", writeNote: "Write a note…", shareWithAthlete: "Visible to athlete",
  privateNote: "Staff only", sharedNote: "Shared", noteAdded: "Note added", noNotes: "No notes yet.", delete: "Delete",
  // squads
  newSquad: "New squad", squadName: "Squad name", ageGroup: "Age group", season: "Season", coaches: "Coaches",
  addCoach: "Add coach", noCoaches: "No coaches assigned", squadAdded: "Squad created", noSquads: "No squads yet.",
  pickCoach: "Choose a staff member",
  // staff
  members: "Members", inviteStaff: "Invite a coach", inviteStaffSub: "Coaches see the whole club and manage the squads you assign them.",
  optionalSquad: "Assign to squad (optional)", remove: "Remove", confirmRemove: "Tap again to remove", you: "you",
  openInvites: "Open invite links", noOpenInvites: "No open invites.", expires: "Expires",
  clubSettings: "Club", rename: "Rename",
  // athlete
  checkinT: "Daily check-in", checkinSub: "Takes 20 seconds. Your coaches use it to plan today's training.",
  sleep: "Sleep quality", energy: "Energy", freshness: "Muscle freshness", calm: "Calm / stress", mood: "Mood",
  poor: "Poor", great: "Great", sleepHours: "Hours slept", anyPain: "Any pain or injury?", yes: "Yes", no: "No",
  painArea: "Where?", notesCoach: "Anything for your coach?", submit: "Submit check-in", update: "Update check-in",
  checkinSaved: "Check-in saved", doneToday: "You checked in today", yourReadiness: "Your readiness",
  editCheckin: "Edit", notLinkedAthlete: "Your account isn't linked to a player profile yet. Ask your coach for an invite link.",
  last28: "Last 28 days", avg7: "7-day average", avg28: "28-day average", streak: "Check-in streak", days: "days",
  sharedNotes: "Notes from your coaches", noSharedNotes: "Your coaches haven't shared notes yet.",
  // settings
  language: "Language", profile: "Profile", activeClub: "Active club", theme: "Theme",
  // generic
  loading: "Loading…", error: "Something went wrong", retry: "Retry", none: "—",
};

type Dict = typeof en;

const he: Dict = {
  appName: "Performance360",
  overview: "סקירה", players: "ספורטאים", squads: "קבוצות", staff: "צוות והזמנות", settings: "הגדרות",
  today: "היום", progress: "ההתקדמות שלי", notesNav: "הערות מאמן",
  signIn: "כניסה", signUp: "יצירת חשבון", email: "אימייל", password: "סיסמה", fullName: "שם מלא",
  haveAccount: "כבר יש לך חשבון?", noAccount: "חדש כאן?", signOut: "יציאה",
  checkEmail: "בדקו את המייל כדי לאשר את החשבון, ואז היכנסו.",
  authTagline: "סגל, מוכנות ומצב גופני של המועדון — מקום אחד למאמנים ולספורטאים.",
  passwordHint: "לפחות 8 תווים",
  welcome: "ברוכים הבאים", createClubT: "הקמת המועדון שלך", createClubSub: "תהיו מנהלי המועדון. בשלב הבא תוכלו להזמין מאמנים וספורטאים.",
  clubName: "שם המועדון או האקדמיה", createClub: "יצירת מועדון",
  waitingInvite: "מצטרפים למועדון קיים?", waitingInviteSub: "בקשו מהמאמן או ממנהל המועדון קישור הזמנה ופתחו אותו כשאתם מחוברים.",
  inviteT: "הוזמנת", inviteTo: "להצטרף אל", asRole: "בתפקיד", forPlayer: "פרופיל ספורטאי", accept: "אישור ההזמנה",
  inviteInvalid: "קישור ההזמנה כבר לא בתוקף. בקשו קישור חדש.", inviteSignIn: "היכנסו או צרו חשבון כדי לאשר.",
  joined: "הצטרפת למועדון",
  role: { director: "מנהל מועדון", coach: "מאמן", athlete: "ספורטאי" },
  status: { available: "כשיר", injured: "פצוע", rehab: "בשיקום", unavailable: "לא זמין" },
  pos: { GK: "שוער", DF: "הגנה", MF: "קישור", FW: "התקפה" },
  foot: { left: "שמאל", right: "ימין", both: "שתיהן" },
  playersK: "ספורטאים", availableK: "כשירים", checkedInK: "מילאו היום", avgReadyK: "מוכנות ממוצעת",
  needsAttention: "דורשים תשומת לב", noAlerts: "אין ספורטאים מסומנים היום.", todayCheckins: "צ'ק-אין של היום",
  lowReady: "מוכנות נמוכה", pain: "כאב", noCheckin: "לא מילא", allSquads: "כל הקבוצות",
  roster: "סגל", addPlayer: "הוספת ספורטאי", search: "חיפוש ספורטאים", name: "שם", squad: "קבוצה", noSquad: "ללא קבוצה",
  position: "עמדה", number: "מס'", readiness: "מוכנות", account: "אפליקציית ספורטאי", linked: "מחובר",
  notLinked: "לא הוזמן", invited: "הזמנה ממתינה", dob: "תאריך לידה", heightCm: "גובה (ס\"מ)", weightKg: "משקל (ק\"ג)",
  dominantFoot: "רגל דומיננטית", statusL: "מצב", notesL: "הערות", age: "גיל", save: "שמירה", cancel: "ביטול",
  playerAdded: "הספורטאי נוסף", saved: "נשמר", back: "חזרה", details: "פרטים", edit: "עריכה",
  coachSquadOnly: "אפשר להוסיף ספורטאים לקבוצות שאתם מאמנים.",
  noPlayers: "אין עדיין ספורטאים. הוסיפו את הראשון.",
  archive: "העברה לארכיון", confirmArchive: "הקישו שוב לאישור", archived: "הספורטאי הועבר לארכיון",
  readiness14: "מוכנות, 14 ימים אחרונים", recentCheckins: "צ'ק-אין אחרונים", noCheckins: "אין עדיין צ'ק-אין.",
  athleteApp: "גישה לאפליקציית ספורטאי", inviteLink: "קישור הזמנה", createInvite: "יצירת קישור הזמנה", copy: "העתקה", copied: "הקישור הועתק",
  revoke: "ביטול", revoked: "ההזמנה בוטלה", linkedNote: "הספורטאי מחובר ויכול למלא צ'ק-אין מהטלפון.",
  inviteNote: "שלחו את הקישור לספורטאי. הוא עובד פעם אחת ותקף ל-14 ימים.",
  coachNotes: "הערות מאמן", addNote: "הוספת הערה", writeNote: "כתבו הערה…", shareWithAthlete: "גלוי לספורטאי",
  privateNote: "לצוות בלבד", sharedNote: "משותף", noteAdded: "ההערה נוספה", noNotes: "אין עדיין הערות.", delete: "מחיקה",
  newSquad: "קבוצה חדשה", squadName: "שם הקבוצה", ageGroup: "שנתון", season: "עונה", coaches: "מאמנים",
  addCoach: "הוספת מאמן", noCoaches: "לא שובצו מאמנים", squadAdded: "הקבוצה נוצרה", noSquads: "אין עדיין קבוצות.",
  pickCoach: "בחירת איש צוות",
  members: "חברי צוות", inviteStaff: "הזמנת מאמן", inviteStaffSub: "מאמנים רואים את כל המועדון ומנהלים את הקבוצות שתשבצו אותם אליהן.",
  optionalSquad: "שיבוץ לקבוצה (לא חובה)", remove: "הסרה", confirmRemove: "הקישו שוב להסרה", you: "את/ה",
  openInvites: "קישורי הזמנה פתוחים", noOpenInvites: "אין הזמנות פתוחות.", expires: "בתוקף עד",
  clubSettings: "מועדון", rename: "שינוי שם",
  checkinT: "צ'ק-אין יומי", checkinSub: "לוקח 20 שניות. המאמנים משתמשים בזה כדי לתכנן את האימון של היום.",
  sleep: "איכות שינה", energy: "אנרגיה", freshness: "רעננות שרירים", calm: "רוגע / לחץ", mood: "מצב רוח",
  poor: "גרוע", great: "מצוין", sleepHours: "שעות שינה", anyPain: "יש כאב או פציעה?", yes: "כן", no: "לא",
  painArea: "איפה?", notesCoach: "משהו למאמן?", submit: "שליחת צ'ק-אין", update: "עדכון צ'ק-אין",
  checkinSaved: "הצ'ק-אין נשמר", doneToday: "מילאת צ'ק-אין היום", yourReadiness: "המוכנות שלך",
  editCheckin: "עריכה", notLinkedAthlete: "החשבון שלך עדיין לא מקושר לפרופיל ספורטאי. בקשו מהמאמן קישור הזמנה.",
  last28: "28 ימים אחרונים", avg7: "ממוצע 7 ימים", avg28: "ממוצע 28 ימים", streak: "רצף מילוי", days: "ימים",
  sharedNotes: "הערות מהמאמנים", noSharedNotes: "המאמנים עדיין לא שיתפו הערות.",
  language: "שפה", profile: "פרופיל", activeClub: "מועדון פעיל", theme: "ערכת נושא",
  loading: "טוען…", error: "משהו השתבש", retry: "נסו שוב", none: "—",
};

const DICTS: Record<Lang, Dict> = { en, he };

type I18n = { lang: Lang; t: Dict; dir: "rtl" | "ltr"; setLang: (l: Lang) => void };
const Ctx = createContext<I18n | null>(null);

function initialLang(): Lang {
  try {
    const s = localStorage.getItem("p360.lang");
    if (s === "he" || s === "en") return s;
  } catch { /* storage unavailable */ }
  return navigator.language?.startsWith("en") ? "en" : "he";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const dir = lang === "he" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("p360.lang", l); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ lang, t: DICTS[lang], dir, setLang }) as I18n, [lang, dir, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside provider");
  return v;
}
