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
  // stage 2 — training & load
  training: "Training", load: "Load", testing: "Testing",
  sessionType: { pitch: "Pitch", match: "Match", gym: "Gym", recovery: "Recovery" },
  prevWeek: "Previous week", nextWeek: "Next week", thisWeek: "This week", addSession: "Add session",
  date: "Date", type: "Type", minutes: "Minutes", title: "Title", wholeClub: "Whole club", sessionAdded: "Session added",
  sessionDeleted: "Session deleted", noSessions: "No sessions", responses: "RPE replies", avgRpe: "Avg RPE",
  totalLoad: "Total load", rpe: "RPE", enterRpe: "Enter RPE", rpeSaved: "RPE saved", notRated: "Not rated",
  loadByPlayer: "Load by player", acute: "Acute 7d", chronic: "Chronic 28d", acwr: "ACWR", au: "AU",
  loadSpike: "Load spike", underloaded: "Underloaded", acwrHelp: "ACWR = 7-day average daily load ÷ 28-day average. 0.8–1.3 is the usual target; above 1.5 flags a spike.",
  dailyLoad28: "Daily load, last 28 days", sessionsWeek: "Sessions this week",
  // athlete RPE
  rateSessions: "Rate your sessions", rateIntro: "How hard was each session overall? 0 = rest, 10 = maximal.",
  minutesPlayed: "Minutes you took part", rated: "Rated", rate: "Save", myLoad: "My training load", noSessionsToRate: "No sessions to rate right now.",
  // testing
  recordResults: "Record results", test: "Test", value: "Value", latest: "Latest", previous: "Previous", change: "Change",
  teamAvg: "Team average over time", resultsSaved: "Results saved", noResults: "No results yet.", lowerBetter: "lower is better",
  higherBetter: "higher is better", best: "Best", myTests: "My test results", testDate: "Test date",
  enterValuesHint: "Fill in the players you tested; leave the rest empty.",
  // stage 3 — library & planner
  library: "Exercise library", planner: "Workout planner", exercises: "exercises", allRegions: "All", allCategories: "All categories",
  allEquipment: "Any equipment", searchExercises: "Search exercises", video: "Video", equipmentL: "Equipment", category: "Category",
  region: { lower: "Lower body", upper: "Upper body", core: "Trunk / core", rehab: "Knee rehab", other: "Other" },
  equipment: { bodyweight: "Bodyweight", barbell: "Barbell", dumbbell: "Dumbbells", kettlebell: "Kettlebell", trapbar: "Trap bar", smith: "Smith machine",
    cable: "Cable", band: "Band", machine: "Machine", box: "Box / hurdle", medball: "Medicine ball", trx: "TRX", slider: "Slider", romanchair: "Roman chair / GHR",
    landmine: "Landmine", pullupbar: "Pull-up bar", bench: "Bench", dowel: "Dowel", bike: "Bike", crutches: "Crutches" } as Record<string, string>,
  cues: "Coaching cues", cuesHint: "One cue per line", addCustomExercise: "Add exercise", exerciseName: "Exercise name", nameHe: "Hebrew name",
  youtubeUrl: "YouTube link", exerciseAdded: "Exercise added", clubExercise: "Club exercise", openExternal: "Open demo", noVideo: "No video yet",
  workouts: "Workouts", newWorkout: "New workout", untitled: "Untitled workout", searchWorkouts: "Search workouts", noWorkouts: "No workouts yet. Create one or ask the AI.",
  focus: "Focus", estMinutes: "Est. minutes", description: "Description", addSection: "Add section", sectionTitle: "Section title",
  addExercise: "Add exercise", addToBlock: "Add to superset", single: "Straight sets", superset: "Superset", circuit: "Circuit", rounds: "rounds",
  set: "Set", addSet: "Add set", copySet: "Copy last set", removeSet: "Remove set", addField: "+ field", note: "Coaching note…",
  moveUp: "Move up", moveDown: "Move down", saveWorkout: "Save", savedJustNow: "Saved", unsaved: "Unsaved changes", duplicate: "Duplicate",
  workoutSaved: "Workout saved", workoutDeleted: "Workout deleted", emptyWorkout: "This workout is empty. Add an exercise or describe it to the AI.",
  pickExercise: "Choose an exercise", close: "Close",
  fields: { reps: "Reps", load: "Load", pct1rm: "%1RM", rpe: "RPE", rir: "RIR", tempo: "Tempo", time: "Time", distance: "Distance", rest: "Rest" } as Record<string, string>,
  focusN: { strength: "Strength", power: "Power", speed: "Speed", conditioning: "Conditioning", mobility: "Mobility", rtp: "Return to play", prehab: "Prehab", mixed: "Mixed" } as Record<string, string>,
  // assign
  assign: "Assign", assignT: "Assign workout", assignTo: "Assign to", aSquad: "A squad", anAthlete: "One athlete", assigned: "Workout assigned",
  // AI
  aiAssistant: "Workout assistant", aiIntro: "I build workouts from your exercise library. Describe the session — sections, focus, match-day timing, constraints.",
  aiPlaceholder: "e.g. Lower-body power for U19, MD-2: dynamic warm-up, mobility, plyo prep, power tri-set. 50 min.",
  aiNew: "New workout", aiChange: "Change this workout", aiSquadCtx: "Use squad readiness", send: "Send", aiThinking: "Building your workout…",
  aiApplied: "Added to the editor — review and save.", aiDropped: "exercises weren't in your library and were left out.",
  aiPresets: ["Progress for next week", "Cut volume by 30%", "Make it MD-2 friendly", "Fit into 40 minutes", "Adapt for a hamstring RTP athlete"],
  aiErr: { ai_not_configured: "AI isn't switched on yet: add the Anthropic API key in Supabase.", rate_limited: "Too many AI requests right now. Try again shortly.",
    forbidden: "Only staff can use the assistant.", refused: "The assistant declined this request. Rephrase it.", invalid_json: "The reply couldn't be read. Try again.",
    def: "The AI request failed. Try again." } as Record<string, string>,
  // athlete workout
  openWorkout: "Open workout", yourWorkout: "Your workout", done: "Done", finishWorkout: "Finish workout", workoutDone: "Workout completed — your coach can see it",
  howHard: "How hard was it overall?", actual: "Done", completedBy: "completed", tapVideo: "Tap for video",
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
  training: "אימונים", load: "עומסים", testing: "מבדקים",
  sessionType: { pitch: "מגרש", match: "משחק", gym: "חדר כושר", recovery: "התאוששות" },
  prevWeek: "שבוע קודם", nextWeek: "שבוע הבא", thisWeek: "השבוע", addSession: "הוספת אימון",
  date: "תאריך", type: "סוג", minutes: "דקות", title: "כותרת", wholeClub: "כל המועדון", sessionAdded: "האימון נוסף",
  sessionDeleted: "האימון נמחק", noSessions: "אין אימונים", responses: "דיווחי RPE", avgRpe: "RPE ממוצע",
  totalLoad: "עומס כולל", rpe: "RPE", enterRpe: "הזנת RPE", rpeSaved: "ה-RPE נשמר", notRated: "לא דורג",
  loadByPlayer: "עומס לפי ספורטאי", acute: "חריף 7 ימים", chronic: "כרוני 28 ימים", acwr: "ACWR", au: "יח'",
  loadSpike: "קפיצת עומס", underloaded: "עומס חסר", acwrHelp: "ACWR = ממוצע עומס יומי ב-7 ימים ÷ ממוצע ב-28 ימים. היעד המקובל 0.8–1.3; מעל 1.5 מסומן כקפיצה.",
  dailyLoad28: "עומס יומי, 28 ימים אחרונים", sessionsWeek: "אימונים השבוע",
  rateSessions: "דרגו את האימונים", rateIntro: "כמה קשה היה כל אימון באופן כללי? 0 = מנוחה, 10 = מקסימלי.",
  minutesPlayed: "דקות השתתפות", rated: "דורג", rate: "שמירה", myLoad: "העומס שלי", noSessionsToRate: "אין כרגע אימונים לדירוג.",
  recordResults: "הזנת תוצאות", test: "מבדק", value: "ערך", latest: "אחרון", previous: "קודם", change: "שינוי",
  teamAvg: "ממוצע קבוצתי לאורך זמן", resultsSaved: "התוצאות נשמרו", noResults: "אין עדיין תוצאות.", lowerBetter: "נמוך יותר עדיף",
  higherBetter: "גבוה יותר עדיף", best: "שיא", myTests: "תוצאות המבדקים שלי", testDate: "תאריך המבדק",
  enterValuesHint: "מלאו רק את הספורטאים שנבדקו; את השאר השאירו ריק.",
  library: "ספריית תרגילים", planner: "מתכנן אימונים", exercises: "תרגילים", allRegions: "הכול", allCategories: "כל הקטגוריות",
  allEquipment: "כל ציוד", searchExercises: "חיפוש תרגילים", video: "וידאו", equipmentL: "ציוד", category: "קטגוריה",
  region: { lower: "פלג גוף תחתון", upper: "פלג גוף עליון", core: "ליבה", rehab: "שיקום ברך", other: "אחר" },
  equipment: { bodyweight: "משקל גוף", barbell: "מוט", dumbbell: "משקולות יד", kettlebell: "קטלבל", trapbar: "מוט טראפ", smith: "מכונת סמית'",
    cable: "כבלים", band: "גומייה", machine: "מכונה", box: "קופסה / משוכה", medball: "כדור כוח", trx: "TRX", slider: "סליידר", romanchair: "כיסא רומי / GHR",
    landmine: "לנדמיין", pullupbar: "מוט מתח", bench: "ספסל", dowel: "מקל", bike: "אופניים", crutches: "קביים" } as Record<string, string>,
  cues: "דגשי ביצוע", cuesHint: "דגש אחד בכל שורה", addCustomExercise: "הוספת תרגיל", exerciseName: "שם התרגיל", nameHe: "שם בעברית",
  youtubeUrl: "קישור YouTube", exerciseAdded: "התרגיל נוסף", clubExercise: "תרגיל מועדון", openExternal: "פתיחת הדגמה", noVideo: "אין עדיין וידאו",
  workouts: "אימונים", newWorkout: "אימון חדש", untitled: "אימון ללא שם", searchWorkouts: "חיפוש אימונים", noWorkouts: "אין עדיין אימונים. צרו אחד או בקשו מה-AI.",
  focus: "מיקוד", estMinutes: "דקות משוערות", description: "תיאור", addSection: "הוספת חלק", sectionTitle: "שם החלק",
  addExercise: "הוספת תרגיל", addToBlock: "הוספה לסופרסט", single: "סטים רגילים", superset: "סופרסט", circuit: "מעגל", rounds: "סבבים",
  set: "סט", addSet: "הוספת סט", copySet: "העתקת הסט האחרון", removeSet: "הסרת סט", addField: "+ שדה", note: "הערת אימון…",
  moveUp: "הזזה למעלה", moveDown: "הזזה למטה", saveWorkout: "שמירה", savedJustNow: "נשמר", unsaved: "שינויים לא שמורים", duplicate: "שכפול",
  workoutSaved: "האימון נשמר", workoutDeleted: "האימון נמחק", emptyWorkout: "האימון ריק. הוסיפו תרגיל או תארו אותו ל-AI.",
  pickExercise: "בחירת תרגיל", close: "סגירה",
  fields: { reps: "חזרות", load: "משקל", pct1rm: "%1RM", rpe: "RPE", rir: "RIR", tempo: "טמפו", time: "זמן", distance: "מרחק", rest: "מנוחה" } as Record<string, string>,
  focusN: { strength: "כוח", power: "עוצמה", speed: "מהירות", conditioning: "סבולת", mobility: "ניידות", rtp: "חזרה למשחק", prehab: "מניעה", mixed: "משולב" } as Record<string, string>,
  assign: "שיבוץ", assignT: "שיבוץ אימון", assignTo: "שיבוץ ל", aSquad: "קבוצה", anAthlete: "ספורטאי אחד", assigned: "האימון שובץ",
  aiAssistant: "עוזר האימונים", aiIntro: "אני בונה אימונים מספריית התרגילים שלכם. תארו את האימון — חלקים, מיקוד, מיקום ביחס למשחק, מגבלות.",
  aiPlaceholder: "לדוגמה: אימון עוצמה פלג גוף תחתון ל-U19, יומיים לפני משחק: חימום דינמי, ניידות, הכנה פליומטרית, טרי-סט עוצמה. 50 דקות.",
  aiNew: "אימון חדש", aiChange: "שינוי האימון הזה", aiSquadCtx: "התחשבות במוכנות הקבוצה", send: "שליחה", aiThinking: "בונה את האימון…",
  aiApplied: "נוסף לעורך — עברו ושמרו.", aiDropped: "תרגילים לא נמצאו בספרייה והושמטו.",
  aiPresets: ["התקדמות לשבוע הבא", "הורדת נפח ב-30%", "התאמה ליומיים לפני משחק", "להכניס ל-40 דקות", "התאמה לשיקום ירך אחורית"],
  aiErr: { ai_not_configured: "ה-AI עדיין לא הופעל: יש להוסיף מפתח Anthropic API ב-Supabase.", rate_limited: "יותר מדי בקשות AI כרגע. נסו שוב בעוד רגע.",
    forbidden: "רק אנשי צוות יכולים להשתמש בעוזר.", refused: "העוזר סירב לבקשה. נסחו אותה מחדש.", invalid_json: "לא הצלחנו לקרוא את התשובה. נסו שוב.",
    def: "בקשת ה-AI נכשלה. נסו שוב." } as Record<string, string>,
  openWorkout: "פתיחת האימון", yourWorkout: "האימון שלך", done: "בוצע", finishWorkout: "סיום האימון", workoutDone: "האימון הושלם — המאמן רואה אותו",
  howHard: "כמה קשה היה באופן כללי?", actual: "בוצע", completedBy: "השלימו", tapVideo: "הקישו לווידאו",
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
