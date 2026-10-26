import { ASSISTANT_ROLES, type AssistantRole } from "./roles";

/**
 * Knowledge base for the built-in assistant: one card per topic, English and Hebrew, scoped by role.
 * `keys` are phrases matched against the question (longer phrases score higher); `body` is the answer in the
 * small Markdown subset that RichText renders. Everything here is written by hand, so it can be reviewed
 * and corrected by a coach, physiotherapist or S&C professional without touching the matching code.
 */

export interface TopicText { title: string; keys: string[]; body: string[] }
export interface Topic { id: string; roles: readonly AssistantRole[]; en: TopicText; he: TopicText }

const ALL = ASSISTANT_ROLES;
const STAFF = ASSISTANT_ROLES.filter((r) => r !== "athlete");
const COACHING = ["head_coach", "head_of_performance", "team_staff", "personal_trainer"] as const;
const BUILDERS = ["head_coach", "head_of_performance", "physiotherapist", "team_staff", "personal_trainer"] as const;

export const TOPICS: Topic[] = [
  {
    id: "recovery-between-matches", roles: ALL,
    en: {
      title: "Recovering between a match and the next training",
      keys: ["recover better", "recovery between", "between a match", "after a match", "after the game", "post match", "post-match", "recover faster", "match and the next training"],
      body: [
        "Recovery is mostly the basics done consistently:",
        "- **Refuel within a couple of hours:** carbohydrate plus protein, and drink until your urine is pale yellow.",
        "- **Sleep is the biggest lever:** keep your usual bedtime even after late matches, and add a short early-afternoon nap if the night was short.",
        "- **Move lightly the next day:** walking, easy bike or mobility beats lying still; keep it easy.",
        "- **Plan the next hard session around how you feel,** not only the calendar. Heavy legs and high soreness mean a lighter session, not a skipped one.",
        "- Cold-water immersion, compression and massage can make you feel better; the evidence for faster recovery is mixed, so treat them as extras.",
        "Use the daily check-in to track the pattern: one bad day matters less than three in a row.",
      ],
    },
    he: {
      title: "התאוששות בין משחק לאימון הבא",
      keys: ["להתאושש טוב", "התאוששות בין", "בין משחק", "אחרי משחק", "אחרי המשחק", "להתאושש מהר", "משחק לאימון"],
      body: [
        "התאוששות היא בעיקר הבסיס שנעשה בעקביות:",
        "- **לתדלק תוך שעתיים:** פחמימות וחלבון, ולשתות עד שהשתן בצבע צהוב בהיר.",
        "- **שינה היא הגורם החשוב ביותר:** לשמור על שעת השינה הרגילה גם אחרי משחק מאוחר, ואפשר להוסיף תנומה קצרה בצהריים אם הלילה היה קצר.",
        "- **תנועה קלה למחרת:** הליכה, אופניים קלים או ניידות עדיפים על שכיבה; חשוב לשמור על עצימות נמוכה.",
        "- **לתכנן את האימון הקשה הבא לפי התחושה** ולא רק לפי לוח הזמנים. רגליים כבדות וכאבי שרירים חזקים מצדיקים אימון קל יותר, לא ביטול שלו.",
        "- אמבטיית קרח, גרבי לחץ ועיסוי יכולים לשפר את התחושה; הראיות להתאוששות מהירה יותר מעורבות, לכן הם תוספת בלבד.",
        "מומלץ לעקוב אחרי המגמה בשאלון היומי: יום רע אחד פחות חשוב משלושה ברצף.",
      ],
    },
  },
  {
    id: "recovery-numbers", roles: ALL,
    en: {
      title: "What recovery and sleep numbers mean",
      keys: ["recovery and sleep numbers", "recovery numbers", "sleep numbers", "recovery score", "recovery percent", "whoop", "fitbit", "wearable numbers", "what do my numbers", "numbers really tell"],
      body: [
        "Recovery and sleep scores are estimates built from resting heart rate, heart-rate variability (HRV), sleep duration and sleep stages.",
        "- They are **relative to your own baseline,** so compare yourself to your last few weeks, not to other people.",
        "- Day-to-day swings are normal. A **trend over several days** is worth attention; a single low number usually is not.",
        "- Alcohol, illness, travel, late meals and stress all move them, so look for the likely cause before reacting.",
        "- How you feel and how you perform matter as much as the score. If the two disagree, trust the whole picture and tell your staff.",
        "They are not a medical test and cannot tell you whether you are injured or ready to play.",
      ],
    },
    he: {
      title: "מה אומרים מספרי ההתאוששות והשינה",
      keys: ["מספרי ההתאוששות", "מספרי השינה", "ציון התאוששות", "אחוז התאוששות", "וופ", "פיטביט", "מכשיר לביש", "מה המספרים", "באמת אומרים"],
      body: [
        "ציוני התאוששות ושינה הם הערכות שמבוססות על דופק מנוחה, שונות דופק (HRV), משך שינה ושלבי שינה.",
        "- הם **יחסיים לבסיס האישי שלכם:** משווים לשבועות האחרונים שלכם, לא לאנשים אחרים.",
        "- תנודות מיום ליום הן נורמליות. **מגמה לאורך כמה ימים** ראויה לתשומת לב; מספר נמוך בודד בדרך כלל לא.",
        "- אלכוהול, מחלה, נסיעות, ארוחות מאוחרות ולחץ משנים אותם, לכן כדאי לחפש את הסיבה הסבירה לפני שמגיבים.",
        "- התחושה והביצועים חשובים כמו הציון. אם הם לא מסכימים, מסתכלים על התמונה כולה ומעדכנים את הצוות.",
        "זו לא בדיקה רפואית והיא לא יכולה לקבוע אם נפצעתם או אם אתם מוכנים לשחק.",
      ],
    },
  },
  {
    id: "hrv-decisions", roles: STAFF,
    en: {
      title: "Using recovery and HRV data in decisions",
      keys: ["hrv", "heart rate variability", "recovery data", "without over-trusting", "over-trust", "resting heart rate"],
      body: [
        "Treat HRV and recovery scores as **one input, not a verdict:**",
        "- Compare each athlete with **their own rolling baseline** (for example seven days against the last four weeks), never with the squad average.",
        "- Look at **trends and several days together;** a single reading is noisy.",
        "- Keep measurement conditions the same (time, position, device) and watch for missing data before reading a drop as meaningful.",
        "- Combine with wellness answers, training load and context (travel, exams, illness). Agreement between sources is a strong signal; disagreement is a reason to talk to the athlete.",
        "- Use it to **start a conversation or adjust a session,** not to withdraw an athlete on a number alone.",
        "Athletes decide whether staff can see wearable data; respect that.",
      ],
    },
    he: {
      title: "שימוש בנתוני התאוששות ו-HRV בהחלטות",
      keys: ["hrv", "שונות דופק", "נתוני התאוששות", "בלי להסתמך", "להסתמך על מספר", "דופק מנוחה"],
      body: [
        "מתייחסים ל-HRV ולציוני התאוששות כ**נתון אחד, לא כפסק דין:**",
        "- משווים כל ספורטאי ל**בסיס הנע שלו** (למשל שבעה ימים מול ארבעת השבועות האחרונים), לא לממוצע הקבוצה.",
        "- מסתכלים על **מגמות ועל כמה ימים ביחד;** מדידה בודדת רועשת.",
        "- שומרים על תנאי מדידה זהים (שעה, תנוחה, מכשיר) ובודקים אם חסרים נתונים לפני שמפרשים ירידה כמשמעותית.",
        "- משלבים עם שאלון הרווחה, עומס אימונים והקשר (נסיעות, מבחנים, מחלה). הסכמה בין מקורות היא סימן חזק; פער הוא סיבה לשוחח עם הספורטאי.",
        "- משתמשים בזה כדי **לפתוח שיחה או להתאים אימון,** לא כדי להוציא ספורטאי על סמך מספר בלבד.",
        "הספורטאים קובעים אם הצוות רואה את נתוני המכשיר הלביש; יש לכבד זאת.",
      ],
    },
  },
  {
    id: "sleep", roles: ALL,
    en: {
      title: "Sleep for athletes",
      keys: ["sleep", "sleeping", "bedtime", "insomnia", "nap", "can't sleep", "cannot sleep"],
      body: [
        "Sleep is the cheapest performance and recovery tool you have.",
        "- Aim for roughly **8 to 10 hours for teenagers and 7 to 9 for adults;** many athletes need the upper end.",
        "- Keep **regular times,** including weekends. Consistency matters as much as the total.",
        "- Dim screens and lights for the last hour; keep the room dark, cool and quiet.",
        "- Stop caffeine roughly 8 hours before bed. Avoid heavy meals and alcohol late.",
        "- After late matches, wind down with a light snack, a shower and the same routine, then protect the next night.",
        "- A nap of 20 to 30 minutes in the early afternoon helps without hurting night sleep.",
        "If poor sleep lasts more than a couple of weeks, talk to a doctor.",
      ],
    },
    he: {
      title: "שינה לספורטאים",
      keys: ["שינה", "לישון", "שעת שינה", "נדודי שינה", "תנומה", "לא נרדם", "אי אפשר לישון"],
      body: [
        "שינה היא כלי הביצועים וההתאוששות הזול ביותר שיש לכם.",
        "- שואפים בערך ל**8 עד 10 שעות לנוער ו-7 עד 9 לבוגרים;** ספורטאים רבים צריכים את הקצה העליון.",
        "- שומרים על **שעות קבועות,** גם בסופי שבוע. עקביות חשובה כמו הכמות.",
        "- מעמעמים מסכים ואור בשעה האחרונה; חדר חשוך, קריר ושקט.",
        "- מפסיקים קפאין כ-8 שעות לפני השינה. נמנעים מארוחות כבדות ואלכוהול מאוחר.",
        "- אחרי משחק מאוחר: חטיף קל, מקלחת ושגרה קבועה, ואז שומרים על הלילה הבא.",
        "- תנומה של 20 עד 30 דקות בצהריים עוזרת בלי לפגוע בשינה בלילה.",
        "אם שינה גרועה נמשכת יותר מכמה שבועות, כדאי לפנות לרופא.",
      ],
    },
  },
  {
    id: "nutrition-hydration", roles: ALL,
    en: {
      title: "Nutrition and hydration basics",
      keys: ["nutrition", "eat", "eating", "food", "diet", "hydration", "hydrate", "drink", "protein", "carbohydrate", "carbs", "supplement"],
      body: [
        "General guidance only; a sports dietitian can tailor it.",
        "- **Carbohydrate is the main fuel** for matches and hard sessions: build meals around it on heavy days, and eat a carbohydrate-rich meal 3 to 4 hours before a match.",
        "- **Protein:** about 1.4 to 2.0 g per kg of body weight a day, spread over 3 to 5 meals, is a common target for athletes.",
        "- **Fluids:** drink through the day and aim for pale-yellow urine; add fluids with sodium in long, hot sessions.",
        "- **Eat after training** within a couple of hours, especially if there is another session soon.",
        "- Supplements are rarely the answer. Check anything you take against anti-doping rules before using it, and prefer products with independent batch testing.",
        "Young athletes should not diet to lose weight without a professional.",
      ],
    },
    he: {
      title: "יסודות תזונה והידרציה",
      keys: ["תזונה", "לאכול", "אוכל", "דיאטה", "הידרציה", "לשתות", "שתייה", "חלבון", "פחמימות", "תוסף", "תוספי"],
      body: [
        "הנחיות כלליות בלבד; תזונאי ספורט יכול להתאים אותן אישית.",
        "- **פחמימות הן הדלק העיקרי** למשחקים ולאימונים קשים: בונים סביבן את הארוחות בימים כבדים, ואוכלים ארוחה עשירה בפחמימות 3 עד 4 שעות לפני משחק.",
        "- **חלבון:** כ-1.4 עד 2.0 גרם לק״ג גוף ביום, מפוזר על 3 עד 5 ארוחות, הוא יעד נפוץ לספורטאים.",
        "- **נוזלים:** שותים לאורך היום ושואפים לשתן צהוב בהיר; באימונים ארוכים וחמים מוסיפים נוזלים עם נתרן.",
        "- **אוכלים אחרי אימון** בתוך שעתיים, במיוחד אם יש עוד אימון בקרוב.",
        "- תוספים הם לעיתים נדירות התשובה. לפני שימוש בודקים מול כללי אנטי-דופינג, ומעדיפים מוצרים עם בדיקת אצוות עצמאית.",
        "ספורטאים צעירים לא צריכים לעשות דיאטה להורדת משקל ללא איש מקצוע.",
      ],
    },
  },
  {
    id: "warmup", roles: ALL,
    en: {
      title: "Warm-up structure",
      keys: ["warm up", "warm-up", "warmup", "prepare before", "before training", "ramp"],
      body: [
        "A good warm-up takes 10 to 20 minutes and follows the **RAMP** idea:",
        "1. **Raise** heart rate and temperature with easy jogging, skipping or mobility flows.",
        "2. **Activate and mobilise** the joints and muscles you are about to use (hips, ankles, trunk, shoulders).",
        "3. **Potentiate** with progressively faster or more explosive drills: short accelerations, low jumps, light sets of the main lift.",
        "Keep static stretching for after training; long holds before sprinting or jumping can reduce power. Warm up longer in the cold and shorter before easy sessions.",
        "To add one to a session, open the session in **Training** and use the library or **Auto-build session**.",
      ],
    },
    he: {
      title: "מבנה חימום",
      keys: ["חימום", "להתחמם", "מתחממים", "מתחמם", "התחממות", "לפני אימון", "ramp"],
      body: [
        "חימום טוב נמשך 10 עד 20 דקות ופועל לפי רעיון ה-**RAMP:**",
        "1. **להעלות** דופק וטמפרטורה בריצה קלה, דילוגים או זרימות ניידות.",
        "2. **להפעיל ולשחרר** את המפרקים והשרירים שבהם תשתמשו (ירכיים, קרסוליים, גו, כתפיים).",
        "3. **להכין לעוצמה** בתרגילים מהירים או מתפרצים יותר בהדרגה: האצות קצרות, קפיצות נמוכות, סטים קלים של התרגיל המרכזי.",
        "מתיחות סטטיות משאירים לסוף האימון; החזקות ארוכות לפני ספרינט או קפיצות עלולות להפחית עוצמה. מתחממים יותר בקור ופחות לפני אימון קל.",
        "כדי להוסיף חימום לאימון, פותחים את האימון ב**אימונים** ומשתמשים בספרייה או ב**בניית אימון אוטומטית**.",
      ],
    },
  },
  {
    id: "acwr", roles: STAFF,
    en: {
      title: "Acute:chronic workload ratio and its limits",
      keys: ["acute chronic", "acute:chronic", "acwr", "workload ratio", "workload ratios", "load ratio", "acute load", "chronic load", "spike in load"],
      body: [
        "The ratio compares the last 7 days of load with the 28-day weekly average. In this app a ratio **above 1.5** is flagged high and **below 0.8** low.",
        "Useful as a **prompt to look closer,** but with known limits:",
        "- The two windows overlap, so the ratio can mislead and the evidence that it predicts injury is weak.",
        "- It ignores *what* the load was (sprinting and high-speed running, accelerations, contact) and the athlete's history.",
        "- It breaks down with missing sessions, a new athlete, or a very low chronic base.",
        "Also look at: **absolute load, week-to-week change, monotony,** high-speed and sprint exposure, wellness trend, age and injury history, and the context of the fixture list.",
        "Use a flag to ask a question (\"why did load jump?\") rather than to cut a session automatically. The **GPS** page shows the ratio and the dashboard raises alerts.",
      ],
    },
    he: {
      title: "יחס עומס אקוטי:כרוני והמגבלות שלו",
      keys: ["אקוטי כרוני", "אקוטי:כרוני", "יחס עומס", "יחס העומס", "acwr", "עומס אקוטי", "עומס כרוני", "זינוק בעומס"],
      body: [
        "היחס משווה את 7 הימים האחרונים לממוצע השבועי של 28 הימים. באפליקציה יחס **מעל 1.5** מסומן כגבוה ו**מתחת ל-0.8** כנמוך.",
        "שימושי כ**סימן להסתכל מקרוב,** אבל עם מגבלות ידועות:",
        "- החלונות חופפים, ולכן היחס עלול להטעות, והראיות שהוא מנבא פציעה חלשות.",
        "- הוא מתעלם מ*סוג* העומס (ספרינטים, ריצה מהירה, האצות, מגע) ומההיסטוריה של הספורטאי.",
        "- הוא מתפרק כשחסרים אימונים, אצל ספורטאי חדש, או כשהבסיס הכרוני נמוך מאוד.",
        "כדאי לבדוק גם: **עומס מוחלט, שינוי משבוע לשבוע, מונוטוניות,** חשיפה לריצה מהירה וספרינט, מגמת רווחה, גיל והיסטוריית פציעות, והקשר לוח המשחקים.",
        "משתמשים בסימון כדי לשאול שאלה (\"למה העומס קפץ?\") ולא כדי לבטל אימון אוטומטית. עמוד ה-**GPS** מציג את היחס והדשבורד מעלה התראות.",
      ],
    },
  },
  {
    id: "microcycle", roles: COACHING,
    en: {
      title: "Planning a microcycle around matches",
      keys: ["microcycle", "micro-cycle", "two matches", "matches in one week", "match week", "midweek match", "md-1", "md-2", "md-3", "weekly plan", "plan the week"],
      body: [
        "Plan backwards from the match, using the **MD (match-day) code:**",
        "- **MD+1:** recovery for starters (mobility, easy aerobic work); a top-up session for those who played little.",
        "- **MD-4 to MD-3:** the heaviest day for strength, power and high-intensity work, when the next match is far enough away.",
        "- **MD-2:** speed, tactical work and shorter, sharper drills; moderate volume.",
        "- **MD-1:** short activation, set pieces and low volume. Nothing new, nothing tiring.",
        "**Two matches in one week:** the first microcycle after match 1 is mostly recovery and one short high-quality exposure; protect sleep and refuelling, keep intensity but cut volume, and rotate where you can. Accept that the stimulus for fitness comes from the matches themselves.",
        "Review the plan against readiness and GPS load during the week and adjust.",
      ],
    },
    he: {
      title: "תכנון מיקרו-מחזור סביב משחקים",
      keys: ["מיקרו מחזור", "מיקרו-מחזור", "מיקרומחזור", "שני משחקים", "משחקים בשבוע", "שבוע משחק", "משחק אמצע שבוע", "תכנון שבועי", "לתכנן את השבוע"],
      body: [
        "מתכננים אחורה מהמשחק, לפי קוד **MD (יום משחק):**",
        "- **MD+1:** התאוששות לפותחים (ניידות, עבודה אירובית קלה); אימון השלמה למי ששיחק מעט.",
        "- **MD-4 עד MD-3:** היום הכבד ביותר לכוח, עוצמה ועבודה בעצימות גבוהה, כשהמשחק הבא רחוק מספיק.",
        "- **MD-2:** מהירות, עבודה טקטית ותרגילים קצרים וחדים יותר; נפח בינוני.",
        "- **MD-1:** הפעלה קצרה, מצבים נייחים ונפח נמוך. שום דבר חדש ושום דבר מעייף.",
        "**שני משחקים בשבוע:** המיקרו-מחזור אחרי המשחק הראשון הוא בעיקר התאוששות וחשיפה אחת קצרה באיכות גבוהה; שומרים על שינה ותדלוק, משמרים עצימות ומקצצים נפח, ומחליפים שחקנים במידת האפשר. הגירוי לכושר מגיע מהמשחקים עצמם.",
        "בודקים את התוכנית מול רווחה ועומס GPS במהלך השבוע ומתאימים.",
      ],
    },
  },
  {
    id: "taper-block", roles: [...COACHING, "physiotherapist"],
    en: {
      title: "A training block with a taper",
      keys: ["taper", "tapering", "four-week block", "four week block", "4 week block", "key match", "peak for", "periodization", "periodisation", "training block", "mesocycle"],
      body: [
        "A common four-week shape:",
        "1. **Weeks 1 to 3, build:** progressive loading with a clear focus (for example strength then power). Raise volume or load in small steps, about 5 to 10 percent a week, and make week 3 the peak.",
        "2. **Week 4, taper:** keep **intensity and frequency,** cut **volume** by roughly 40 to 60 percent over the 7 to 14 days before the key match. Short sharp sprints and heavy-but-low-volume lifts keep sharpness.",
        "3. In the last 48 hours: activation only, plenty of sleep and carbohydrate.",
        "Check readiness and GPS load weekly. If athletes arrive already tired, shorten the build instead of pushing through. In-season, a team-sport taper is much smaller than in individual sports: often a lighter match week, not a full reduction.",
      ],
    },
    he: {
      title: "בלוק אימונים עם טייפר",
      keys: ["טייפר", "טיפר", "בלוק של ארבעה", "בלוק ארבעה", "משחק חשוב", "לשיא", "פריודיזציה", "מחזור אימונים", "בלוק אימונים"],
      body: [
        "מבנה נפוץ של ארבעה שבועות:",
        "1. **שבועות 1 עד 3, בנייה:** העמסה הדרגתית עם מיקוד ברור (למשל כוח ואחריו עוצמה). מעלים נפח או עומס בצעדים קטנים, כ-5 עד 10 אחוז בשבוע, ושבוע 3 הוא השיא.",
        "2. **שבוע 4, טייפר:** שומרים על **עצימות ותדירות,** מקצצים **נפח** בכ-40 עד 60 אחוז ב-7 עד 14 הימים שלפני המשחק החשוב. ספרינטים קצרים וחדים והרמות כבדות בנפח נמוך שומרים על חדות.",
        "3. ב-48 השעות האחרונות: הפעלה בלבד, הרבה שינה ופחמימות.",
        "בודקים רווחה ועומס GPS מדי שבוע. אם ספורטאים מגיעים עייפים, מקצרים את הבנייה במקום לדחוף. בעונת משחקים טייפר בענף קבוצתי קטן בהרבה מאשר בענפים אישיים: לרוב שבוע משחק קל יותר, לא הפחתה מלאה.",
      ],
    },
  },
  {
    id: "fixture-congestion", roles: ["director", "head_coach", "head_of_performance"],
    en: {
      title: "Short-term results versus workload risk",
      keys: ["congested", "fixture", "fixtures", "short-term results", "workload risk", "busy period", "run of matches", "many matches"],
      body: [
        "Treat it as a **decision with named trade-offs,** not a feeling:",
        "- Decide in advance which matches matter most and where you will accept more risk.",
        "- **Protect minutes for the highest-load players:** rotate, use substitutes earlier, and plan who rests which match.",
        "- Between games, **cut volume before intensity;** recovery, sleep and food come first.",
        "- Watch the data that moves first: wellness trend, high-speed running and sprint exposure, and the workload ratio. Agree trigger points with the staff before the run starts.",
        "- Write down the reasoning so the decision is shared by coaching, medical and performance staff.",
        "Short-term gains from overusing a few players tend to be paid back later in availability.",
      ],
    },
    he: {
      title: "תוצאות לטווח קצר מול סיכון עומס",
      keys: ["תקופת משחקים עמוסה", "משחקים עמוסה", "עמוסה", "לוח משחקים", "תוצאות לטווח קצר", "סיכון עומס", "רצף משחקים", "הרבה משחקים"],
      body: [
        "מתייחסים לזה כ**החלטה עם פשרות מוגדרות,** לא כתחושה:",
        "- מחליטים מראש אילו משחקים הכי חשובים ואיפה מקבלים יותר סיכון.",
        "- **מגינים על דקות של השחקנים עם העומס הגבוה ביותר:** מבצעים רוטציה, מחליפים מוקדם יותר ומתכננים מי נח באיזה משחק.",
        "- בין משחקים **מקצצים נפח לפני עצימות;** התאוששות, שינה ואוכל קודמים.",
        "- עוקבים אחרי הנתונים שזזים ראשונים: מגמת רווחה, חשיפה לריצה מהירה וספרינט, ויחס העומס. מסכמים עם הצוות נקודות הפעלה לפני תחילת הרצף.",
        "- רושמים את הנימוקים כדי שההחלטה תהיה משותפת לצוות האימון, הרפואי והמקצועי.",
        "רווחים לטווח קצר משימוש יתר בכמה שחקנים נוטים להיפרע בהמשך בזמינות.",
      ],
    },
  },
  {
    id: "rotation-returning", roles: ["head_coach", "director", "head_of_performance", "team_staff"],
    en: {
      title: "Rotation when players are returning from injury",
      keys: ["rotation", "rotate", "returning from injury", "several players", "bring back", "minutes for", "squad rotation"],
      body: [
        "Return players in **steps agreed with the medical staff,** not by date:",
        "- Build match exposure gradually (a short cameo, then a start with a planned substitution) and confirm with the clinician that criteria were met first.",
        "- Pair returning players with fit teammates in the same role so you are never forced to overplay one.",
        "- Check the **next-day response:** soreness, wellness and GPS load. A poor response means hold the step.",
        "- Keep the athlete informed and involved; surprise changes in minutes damage trust and are risky.",
        "- Clearance is recorded in **Injuries** by authorised staff with a written basis; selection remains the coach's decision.",
      ],
    },
    he: {
      title: "רוטציה כששחקנים חוזרים מפציעה",
      keys: ["רוטציה", "חוזרים מפציעה", "כמה שחקנים", "להחזיר שחקנים", "דקות משחק", "רוטציית סגל"],
      body: [
        "מחזירים שחקנים ב**צעדים שמוסכמים עם הצוות הרפואי,** לא לפי תאריך:",
        "- בונים חשיפה למשחק בהדרגה (כניסה קצרה, אחר כך הרכב עם החלפה מתוכננת) ומוודאים מול הקלינאי שהקריטריונים התקיימו קודם.",
        "- משלבים שחקנים חוזרים עם חברים כשירים באותו תפקיד כדי שלא תאולצו לשחק יותר מדי שחקן אחד.",
        "- בודקים את **התגובה למחרת:** כאבי שרירים, רווחה ועומס GPS. תגובה גרועה פירושה לעצור בצעד הנוכחי.",
        "- מעדכנים את הספורטאי ומערבים אותו; שינויי דקות מפתיעים פוגעים באמון ומסוכנים.",
        "- אישור חזרה נרשם ב**פציעות** על ידי צוות מורשה עם נימוק כתוב; הבחירה בהרכב נשארת החלטת המאמן.",
      ],
    },
  },
  {
    id: "confidence-feedback", roles: ["head_coach", "personal_trainer", "team_staff", "head_of_performance"],
    en: {
      title: "Giving feedback to a young player losing confidence",
      keys: ["feedback", "confidence", "losing confidence", "young player", "motivation", "motivate", "demotivated", "mistakes"],
      body: [
        "- **Talk privately,** early and calmly, not straight after a mistake or in front of the group.",
        "- **Be specific and about behaviour:** name one thing done well and one thing to work on, not the person.",
        "- **Ask first:** how does the player see it? Often they already know, and ownership beats instruction.",
        "- **Set small, controllable goals** (process, not outcome) and notice progress out loud.",
        "- Keep your tone and expectations steady; confidence grows in a predictable environment.",
        "- If the drop is large, lasting or comes with sleep, mood or appetite changes, involve the club's welfare or a qualified professional.",
      ],
    },
    he: {
      title: "משוב לשחקן צעיר שמאבד ביטחון",
      keys: ["משוב", "ביטחון", "מאבד ביטחון", "שחקן צעיר", "מוטיבציה", "לתת מוטיבציה", "טעויות"],
      body: [
        "- **מדברים בפרטיות,** מוקדם ובנחת, לא מיד אחרי טעות ולא מול הקבוצה.",
        "- **ספציפיים ובנושא התנהגות:** מציינים דבר אחד שנעשה טוב ודבר אחד לעבוד עליו, לא את האדם.",
        "- **שואלים קודם:** איך השחקן רואה את זה? לעיתים קרובות הוא כבר יודע, ואחריות עדיפה על הוראה.",
        "- **מגדירים מטרות קטנות הניתנות לשליטה** (תהליך ולא תוצאה) ומציינים התקדמות בקול.",
        "- שומרים על טון וציפיות יציבים; ביטחון גדל בסביבה צפויה.",
        "- אם הירידה גדולה, ממושכת או מלווה בשינויי שינה, מצב רוח או תיאבון, מערבים את גורם הרווחה במועדון או איש מקצוע מוסמך.",
      ],
    },
  },
  {
    id: "staff-structure", roles: ["director"],
    en: {
      title: "Structuring coaching, medical and performance staff",
      keys: ["structure the", "staff structure", "shared decisions", "decisions are shared", "medical and coaching", "performance, medical", "organise staff", "organize staff", "roles and responsibilities", "performance department"],
      body: [
        "Make decision rights explicit so nobody is pressured and nobody is bypassed:",
        "- **Medical staff** own diagnosis, treatment and clearance. **Coaches** own selection and tactics. **Performance staff** own load planning and monitoring, and advise on the rest.",
        "- Hold a **short weekly meeting** with coaching, medical and performance leads (and the analyst): availability, load, upcoming fixtures, decisions needed.",
        "- Use **one shared source of truth** (this app) so everyone sees the same injuries, load and wellness.",
        "- Agree an **escalation path** for disagreements (for example the director decides after hearing both sides) and record the reasoning.",
        "- Protect clinicians from pressure to clear players early; clearance here requires a written basis from authorised staff.",
        "Invite staff and set their roles in **My Team**; the director's view is read-only on athletes and injuries by design.",
      ],
    },
    he: {
      title: "מבנה צוות אימון, רפואי ומקצועי",
      keys: ["לבנות את שיתוף", "שיתוף הפעולה", "החלטות מתקבלות יחד", "מבנה צוות", "צוות רפואי", "תפקידים ואחריות", "מחלקת ביצועים", "לארגן צוות"],
      body: [
        "מגדירים במפורש זכויות החלטה כדי שאף אחד לא יהיה תחת לחץ ואף אחד לא יעקף:",
        "- **הצוות הרפואי** אחראי לאבחון, טיפול ואישור חזרה. **המאמנים** אחראים לבחירת הרכב וטקטיקה. **צוות הביצועים** אחראי לתכנון וניטור עומסים ומייעץ בשאר.",
        "- מקיימים **פגישה שבועית קצרה** של ראשי האימון, הרפואי והביצועים (והאנליסט): זמינות, עומס, משחקים קרובים, החלטות נדרשות.",
        "- משתמשים ב**מקור אמת אחד** (האפליקציה הזו) כדי שכולם יראו את אותן פציעות, עומסים ורווחה.",
        "- מסכמים **מסלול הסלמה** למחלוקות (למשל המנהל מכריע אחרי ששמע את שני הצדדים) ורושמים את הנימוקים.",
        "- מגינים על הקלינאים מלחץ לאשר חזרה מוקדם; כאן אישור דורש נימוק כתוב מצוות מורשה.",
        "מזמינים צוות וקובעים תפקידים ב**הצוות שלי**; תצוגת המנהל היא לקריאה בלבד על ספורטאים ופציעות, בכוונה.",
      ],
    },
  },
  {
    id: "kpis", roles: ["director", "head_of_performance", "team_staff", "head_coach"],
    en: {
      title: "Injury and availability indicators",
      keys: ["indicators", "availability", "injury rate", "injury burden", "kpi", "kpis", "metrics to track", "over-reading", "each month", "monthly report"],
      body: [
        "Ask for a small, stable set each month:",
        "- **Availability:** share of the squad fully available for training and matches.",
        "- **Injury incidence** per 1000 hours of exposure, split by training and match.",
        "- **Injury burden:** days lost per injury and in total, plus the **recurrence** rate.",
        "- **Load trend** and the share of athletes outside the usual workload ratio range.",
        "Avoid over-reading: squads are small, so one injury moves the numbers a lot; compare with your **own history,** not other clubs; look at 3 to 6 month trends; and never rank staff by injury counts. Pair every number with the context that explains it.",
      ],
    },
    he: {
      title: "מדדי פציעות וזמינות",
      keys: ["מדדי פציעות", "מדדים", "זמינות", "שיעור פציעות", "עומס פציעות", "כל חודש", "לקרוא אותם יותר מדי", "דוח חודשי"],
      body: [
        "מבקשים קבוצה קטנה ויציבה של מדדים בכל חודש:",
        "- **זמינות:** חלק הסגל שכשיר במלואו לאימונים ולמשחקים.",
        "- **שכיחות פציעות** ל-1000 שעות חשיפה, בחלוקה לאימון ומשחק.",
        "- **נטל פציעות:** ימי היעדרות לפציעה ובסך הכול, ושיעור **חזרתיות**.",
        "- **מגמת עומס** וחלק הספורטאים מחוץ לטווח הרגיל של יחס העומס.",
        "כדי לא לקרוא יותר מדי: הסגלים קטנים ולכן פציעה אחת מזיזה הרבה את המספרים; משווים ל**היסטוריה שלכם** ולא למועדונים אחרים; מסתכלים על מגמות של 3 עד 6 חודשים; ולעולם לא מדרגים אנשי צוות לפי מספר פציעות. כל מספר מלווים בהקשר שמסביר אותו.",
      ],
    },
  },
  {
    id: "reporting", roles: ["team_staff", "head_of_performance", "director", "head_coach"],
    en: {
      title: "Presenting monitoring data and weekly reports",
      keys: ["present monitoring", "monitoring data", "coaches act", "weekly report", "simple report", "report for the staff", "dashboard for coaches", "share data with coaches"],
      body: [
        "Coaches act on reports that are short and clear:",
        "- **One page:** three or four key numbers, then the **exceptions** (who is flagged and why), then one recommended action each.",
        "- Use **traffic lights with the thresholds explained** (for example workload ratio above 1.5, low recovery) so nobody has to guess.",
        "- Compare each athlete with **their own baseline;** show trends, not just today.",
        "- Deliver at the **same time every week,** before the planning meeting, and follow up on what was decided.",
        "- Keep data quality visible (missing sessions, partial files) so numbers are not over-trusted.",
        "The dashboard alerts and the CSV exports in each section give a starting point for the weekly report.",
      ],
    },
    he: {
      title: "הצגת נתוני ניטור ודוחות שבועיים",
      keys: ["מציגים נתוני ניטור", "נתוני ניטור", "המאמנים יפעלו", "דוח שבועי", "דוח פשוט", "דוח לצוות", "לשתף נתונים עם מאמנים"],
      body: [
        "מאמנים פועלים לפי דוחות קצרים וברורים:",
        "- **עמוד אחד:** שלושה או ארבעה מספרים מרכזיים, אחר כך **החריגים** (מי מסומן ולמה), ואז פעולה מומלצת אחת לכל אחד.",
        "- משתמשים ב**רמזורים עם הסף המוסבר** (למשל יחס עומס מעל 1.5, התאוששות נמוכה) כדי שאיש לא יצטרך לנחש.",
        "- משווים כל ספורטאי ל**בסיס האישי שלו;** מציגים מגמות ולא רק את היום.",
        "- מוסרים ב**אותה שעה בכל שבוע,** לפני פגישת התכנון, ועוקבים אחרי מה שהוחלט.",
        "- משאירים את איכות הנתונים גלויה (אימונים חסרים, קבצים חלקיים) כדי שלא יבטחו יותר מדי במספרים.",
        "התראות הדשבורד וייצוא ה-CSV בכל מדור נותנים נקודת פתיחה לדוח השבועי.",
      ],
    },
  },
  {
    id: "wellness-quality", roles: STAFF,
    en: {
      title: "Making wellness questionnaires useful",
      keys: ["wellness questionnaire", "wellness questionnaires", "questionnaire", "check-in", "check in", "reliable enough", "self-report", "readiness survey"],
      body: [
        "Self-report works when athletes trust it and see it used:",
        "- Keep it **short** (five to seven items) and the same every day, at the same time, before training.",
        "- Look at **change from the athlete's own baseline,** not absolute scores or comparisons between athletes.",
        "- **Close the loop:** respond to flags quickly and say what you did; athletes stop answering when nothing happens.",
        "- Never punish an honest low score. Make it clear the data is for adjusting training and care.",
        "- Treat it as one signal; combine it with load, sleep and what you see in person.",
        "Athletes submit the check-in in **Readiness**; staff see flags on the dashboard.",
      ],
    },
    he: {
      title: "איך שאלוני רווחה הופכים לשימושיים",
      keys: ["שאלוני רווחה", "שאלון רווחה", "שאלון", "דיווח עצמי", "אמינים מספיק", "צ'ק אין", "בדיקת בוקר"],
      body: [
        "דיווח עצמי עובד כשספורטאים סומכים עליו ורואים שמשתמשים בו:",
        "- שומרים אותו **קצר** (חמש עד שבע שאלות) וזהה כל יום, באותה שעה, לפני האימון.",
        "- מסתכלים על **שינוי מהבסיס האישי של הספורטאי,** לא על ציונים מוחלטים או השוואה בין ספורטאים.",
        "- **סוגרים את המעגל:** מגיבים לסימונים מהר ואומרים מה עשיתם; ספורטאים מפסיקים לענות כשלא קורה כלום.",
        "- לעולם לא מענישים על ציון נמוך כן. מבהירים שהנתונים נועדו להתאמת אימון וטיפול.",
        "- מתייחסים לזה כאות אחד; משלבים עם עומס, שינה ומה שרואים בעיניים.",
        "ספורטאים ממלאים את השאלון ב**מוכנות**; הצוות רואה סימונים בדשבורד.",
      ],
    },
  },
  {
    id: "hamstring-rtr", roles: [...BUILDERS],
    en: {
      title: "Hamstring return-to-run progression (general)",
      keys: ["hamstring", "return-to-run", "return to run", "return to running", "sprint after injury", "running after injury"],
      body: [
        "General principles only; the treating clinician sets the criteria for each athlete.",
        "- **Gate each step with criteria, not dates:** pain-free walking and daily activity, full or near-full range of motion, and strength close to the other side (commonly around 90 percent or better on hamstring strength tests).",
        "- **Progress running through speeds:** easy running, then tempo, then progressive accelerations, then **high-speed and near-maximum sprinting** before full team training; hamstring risk is highest at top speed.",
        "- Add **change of direction and sport-specific drills** after straight-line running is tolerated, and keep eccentric/hip-extension strength work going.",
        "- Judge the **response in the next 24 hours** (pain, stiffness, wellness) before moving on.",
        "- Return to full training and matches in steps, and build the plan together with the performance and coaching staff.",
        "Record stages and clearance in **Injuries**; only authorised staff can clear.",
      ],
    },
    he: {
      title: "התקדמות בחזרה לריצה אחרי פגיעה בירך האחורית (כללי)",
      keys: ["ירך אחורית", "המסטרינג", "חזרה לריצה", "ספרינט אחרי פציעה", "ריצה אחרי פציעה"],
      body: [
        "עקרונות כלליים בלבד; הקלינאי המטפל קובע את הקריטריונים לכל ספורטאי.",
        "- **שערים לכל שלב לפי קריטריונים, לא תאריכים:** הליכה והפעילות היומיומית ללא כאב, טווח תנועה מלא או כמעט מלא, וכוח קרוב לצד השני (לרוב סביב 90 אחוז ומעלה במבדקי כוח ירך אחורית).",
        "- **מתקדמים בריצה דרך מהירויות:** ריצה קלה, אחר כך טמפו, אחר כך האצות הדרגתיות, ואז **ריצה מהירה וספרינט קרוב למקסימום** לפני אימון קבוצתי מלא; הסיכון בירך האחורית גבוה ביותר במהירות שיא.",
        "- מוסיפים **שינויי כיוון ותרגילים ייעודיים לענף** אחרי שריצה ישרה נסבלת, וממשיכים בעבודת כוח אקסצנטרית והארכת ירך.",
        "- בוחנים את **התגובה ב-24 השעות הבאות** (כאב, נוקשות, רווחה) לפני שממשיכים.",
        "- חוזרים לאימון מלא ולמשחקים בשלבים, ובונים את התוכנית יחד עם צוות הביצועים והאימון.",
        "רושמים שלבים ואישור חזרה ב**פציעות**; רק צוות מורשה יכול לאשר.",
      ],
    },
  },
  {
    id: "graded-loading", roles: ["physiotherapist", "personal_trainer", "head_of_performance", "head_coach", "team_staff", "athlete"],
    en: {
      title: "Explaining graded loading to a player who wants to rush back",
      keys: ["graded loading", "graded load", "rush back", "rushing back", "too fast", "come back too soon", "slow progression", "load tolerance"],
      body: [
        "Healing tissue gets stronger by being loaded **a little more than it was last week,** not by being rested or overloaded.",
        "- Use a simple picture: \"the tissue adapts to what we ask, and we raise the ask in steps it can take.\"",
        "- Agree **criteria** (pain level during and after, range, strength, running load) rather than dates, so progress is in the player's hands.",
        "- A commonly used guide: mild discomfort that settles within about a day is acceptable; sharp or lingering pain means hold the step.",
        "- Show what they **can** do each week; rushing back usually costs more time through re-injury.",
        "- Set a clear return plan with the performance staff so the player is never idle while waiting.",
        "Stage updates are recorded in **Injuries**, where the athlete can follow them too.",
      ],
    },
    he: {
      title: "הסבר טעינה מדורגת לשחקן שממהר לחזור",
      keys: ["טעינה מדורגת", "העמסה מדורגת", "ממהר לחזור", "למהר לחזור", "מהר מדי", "חוזר מוקדם", "התקדמות איטית", "סבילות לעומס"],
      body: [
        "רקמה מחלימה מתחזקת כשמעמיסים עליה **קצת יותר משבוע שעבר,** לא כשמנוחים או כשמעמיסים יתר על המידה.",
        "- משתמשים בדימוי פשוט: \"הרקמה מסתגלת למה שאנחנו מבקשים, ואנחנו מעלים את הבקשה בצעדים שהיא מסוגלת לקבל.\"",
        "- מסכמים **קריטריונים** (רמת כאב במהלך ואחרי, טווח, כוח, עומס ריצה) ולא תאריכים, כך שההתקדמות בידי השחקן.",
        "- כלל אצבע נפוץ: אי נוחות קלה שנרגעת תוך יום מקובלת; כאב חד או מתמשך פירושו לעצור בשלב.",
        "- מראים מה הוא **יכול** לעשות בכל שבוע; מהירות יתר בחזרה עולה בדרך כלל ביותר זמן בגלל פציעה חוזרת.",
        "- קובעים תוכנית חזרה ברורה עם צוות הביצועים כדי שהשחקן לא יהיה בטל בזמן ההמתנה.",
        "עדכוני שלבים נרשמים ב**פציעות**, שם גם הספורטאי יכול לעקוב.",
      ],
    },
  },
  {
    id: "rtp-criteria", roles: STAFF,
    en: {
      title: "Return-to-play decisions and criteria",
      keys: ["return to play", "return-to-play", "clearance", "cleared", "clear a player", "ready to play", "back to training", "rtp"],
      body: [
        "Return to play is a **step-by-step process with criteria,** decided by qualified medical staff together with the coach and performance staff:",
        "1. **Clinical:** pain, swelling and range of motion settled.",
        "2. **Function and strength:** tests close to the other side or to the athlete's own baseline.",
        "3. **Load tolerance:** running, high-speed and sport-specific drills progressed without a bad response.",
        "4. **Team training** in stages, then **match minutes** built up.",
        "5. **Psychological readiness:** the athlete trusts the body again.",
        "In this app the stages run from rest to cleared in **Injuries**; clearance needs a written basis and can only be recorded by authorised staff (the physiotherapist, head coach and head of performance). This assistant cannot diagnose or clear anyone.",
      ],
    },
    he: {
      title: "החלטות וקריטריונים לחזרה למשחק",
      keys: ["חזרה למשחק", "חזרה לפעילות", "אישור חזרה", "לאשר שחקן", "מוכן לשחק", "חזרה לאימון", "rtp"],
      body: [
        "חזרה למשחק היא **תהליך מדורג עם קריטריונים,** שמוחלט בידי צוות רפואי מוסמך יחד עם המאמן וצוות הביצועים:",
        "1. **קליני:** כאב, נפיחות וטווח תנועה התייצבו.",
        "2. **תפקוד וכוח:** מבדקים קרובים לצד השני או לבסיס האישי של הספורטאי.",
        "3. **סבילות לעומס:** ריצה, ריצה מהירה ותרגילים ייעודיים התקדמו בלי תגובה גרועה.",
        "4. **אימון קבוצתי** בשלבים, ואז **בניית דקות משחק.**",
        "5. **מוכנות נפשית:** הספורטאי סומך שוב על הגוף.",
        "באפליקציה השלבים רצים ממנוחה עד אישור ב**פציעות**; אישור דורש נימוק כתוב ויכול להירשם רק בידי צוות מורשה (פיזיותרפיסט, מאמן ראשי וראש ביצועים). העוזר הזה לא מאבחן ולא מאשר חזרה לאיש.",
      ],
    },
  },
  {
    id: "asymmetry", roles: ["physiotherapist", "head_of_performance", "personal_trainer", "head_coach", "team_staff"],
    en: {
      title: "Asymmetry tests and GPS load together",
      keys: ["asymmetry", "asymmetries", "limb difference", "left and right", "strength asymmetry", "symmetry", "side difference"],
      body: [
        "Use asymmetry and load as **two inputs to a clinical decision:**",
        "- **Limb difference** in strength or jump tests is most useful against the athlete's own pre-injury values; compare with the other side only where that is the best reference. Around 10 percent is a common flag, not a cut-off.",
        "- Repeat tests under the same conditions; one noisy session proves little.",
        "- Read **GPS load** alongside: has the athlete been exposed to high-speed running and sprinting at a level that matches the demands of matches?",
        "- Agreement (symmetric strength and adequate exposure) supports progressing; disagreement tells you what to work on next.",
        "Results are kept in **Testing** with trends and limb difference; GPS exposure is on the **GPS** page.",
      ],
    },
    he: {
      title: "אסימטריה בכוח ועומס GPS ביחד",
      keys: ["אסימטריה", "אסימטריית", "הבדל בין הצדדים", "ימין ושמאל", "סימטריה", "הפרש בין הרגליים"],
      body: [
        "משתמשים באסימטריה ובעומס כ**שני נתונים להחלטה קלינית:**",
        "- **הפרש בין הצדדים** במבדקי כוח או קפיצה שימושי ביותר מול ערכי הספורטאי עצמו לפני הפציעה; משווים לצד השני רק כשהוא הייחוס הטוב ביותר. כ-10 אחוז הוא סימון נפוץ, לא קו חיתוך.",
        "- חוזרים על המבדקים בתנאים זהים; מפגש רועש אחד מוכיח מעט.",
        "- קוראים את **עומס ה-GPS** לצד זה: האם הספורטאי נחשף לריצה מהירה וספרינט ברמה שמתאימה לדרישות המשחקים?",
        "- הסכמה (כוח סימטרי וחשיפה מספקת) תומכת בהתקדמות; פער מראה על מה לעבוד.",
        "התוצאות נשמרות ב**מבדקים** עם מגמות והפרש בין הצדדים; חשיפת GPS בעמוד ה-**GPS**.",
      ],
    },
  },
  {
    id: "program-structure", roles: [...BUILDERS],
    en: {
      title: "Structuring a longer program",
      keys: ["12-week", "12 week", "twelve week", "structure a", "program", "programme", "two sessions a week", "amateur", "plan for an athlete", "periodise", "build a plan"],
      body: [
        "For a 12-week plan with two sessions a week, three 4-week blocks work well:",
        "1. **Weeks 1 to 4, foundation:** technique and tissue tolerance (squat, hinge, single-leg, push, pull, trunk), moderate load.",
        "2. **Weeks 5 to 8, build:** raise load (about 5 to 10 percent steps) and add power (jumps, throws).",
        "3. **Weeks 9 to 12, transfer:** speed, change of direction and sport-specific work with the strength base maintained.",
        "Each session: **warm-up, speed or power, strength, trunk, short cool-down.** Make week 4, 8 and 12 lighter (deload), progress reps first and load second, and track effort with RPE. Amateur players also have matches and work or study, so keep sessions to about an hour and adjust around fixtures.",
        "In the app: **Training**, then new program, add sessions, and use the library or **Auto-build session** for a first draft you then edit.",
      ],
    },
    he: {
      title: "בניית תוכנית ארוכה",
      keys: ["12 שבועות", "תוכנית של", "תוכנית אימונים", "שני אימונים בשבוע", "חובב", "לבנות תוכנית", "מבנה תוכנית"],
      body: [
        "לתוכנית של 12 שבועות עם שני אימונים בשבוע, שלושה בלוקים של 4 שבועות עובדים טוב:",
        "1. **שבועות 1 עד 4, בסיס:** טכניקה וסבילות רקמות (סקוואט, ציר ירך, רגל אחת, דחיפה, משיכה, גו), עומס בינוני.",
        "2. **שבועות 5 עד 8, בנייה:** מעלים עומס (צעדים של כ-5 עד 10 אחוז) ומוסיפים עוצמה (קפיצות, זריקות).",
        "3. **שבועות 9 עד 12, העברה:** מהירות, שינויי כיוון ועבודה ייעודית לענף עם שימור בסיס הכוח.",
        "כל אימון: **חימום, מהירות או עוצמה, כוח, גו, סיום קצר.** שבועות 4, 8 ו-12 קלים יותר (דילוד), מתקדמים קודם בחזרות ואחר כך בעומס, ועוקבים אחרי מאמץ ב-RPE. לשחקני חובבים יש גם משחקים ועבודה או לימודים, לכן שומרים על אימונים של כשעה ומתאימים סביב המשחקים.",
        "באפליקציה: **אימונים**, תוכנית חדשה, הוספת אימונים, והספרייה או **בניית אימון אוטומטית** לטיוטה ראשונה שאותה עורכים.",
      ],
    },
  },
  {
    id: "poor-sleep-adjust", roles: [...BUILDERS],
    en: {
      title: "Adjusting a program after poor sleep",
      keys: ["poor sleep", "bad sleep", "slept badly", "adjust a program", "adjust the program", "adjust training", "tired athlete", "fatigued", "not slept", "week of poor sleep"],
      body: [
        "One bad night rarely needs a change; **a week of poor sleep does:**",
        "- Cut **volume by about 10 to 30 percent** and keep the quality of the first sets; drop the last, sloppiest ones.",
        "- Keep technique and speed work short and sharp; avoid maximum sprinting, heavy attempts near maximum and long hard conditioning while very tired.",
        "- Check the wider picture: stress, exams, travel, illness, food, and the wellness trend in **Readiness**.",
        "- Talk to the athlete about the cause and agree small sleep habits rather than just lowering load.",
        "- Return to plan as sleep and wellness recover, and note the change in the session.",
        "If sleep stays poor for weeks or is joined by low mood or frequent illness, refer to a doctor.",
      ],
    },
    he: {
      title: "התאמת תוכנית אחרי שינה גרועה",
      keys: ["שינה גרועה", "ישן גרוע", "שבוע שלם", "מתאימים תוכנית", "להתאים תוכנית", "להתאים אימון", "ספורטאי עייף", "עייפות"],
      body: [
        "לילה רע אחד כמעט לא דורש שינוי; **שבוע של שינה גרועה כן:**",
        "- מקצצים **נפח בכ-10 עד 30 אחוז** ושומרים על איכות הסטים הראשונים; מוותרים על האחרונים, הרשלניים ביותר.",
        "- שומרים עבודת טכניקה ומהירות קצרה וחדה; נמנעים מספרינט מקסימלי, ניסיונות כבדים קרוב למקסימום וקונדישנינג ארוך וקשה כשעייפים מאוד.",
        "- בודקים את התמונה הרחבה: לחץ, מבחנים, נסיעות, מחלה, תזונה, ומגמת הרווחה ב**מוכנות**.",
        "- משוחחים עם הספורטאי על הסיבה ומסכמים הרגלי שינה קטנים ולא רק מורידים עומס.",
        "- חוזרים לתוכנית כשהשינה והרווחה מתאוששות, ורושמים את השינוי באימון.",
        "אם השינה נשארת גרועה שבועות או מתלווה אליה מצב רוח ירוד או מחלות תכופות, מפנים לרופא.",
      ],
    },
  },
  {
    id: "referral", roles: ["personal_trainer", "head_coach", "team_staff", "head_of_performance", "athlete"],
    en: {
      title: "When to refer to a physiotherapist or doctor",
      keys: ["refer", "referral", "see a doctor", "see a physio", "see a physiotherapist", "physiotherapist or doctor", "when should i", "red flag", "red flags"],
      body: [
        "**Seek urgent care** (or call the local emergency number) for: a head injury with confusion, headache, vomiting or loss of consciousness; chest pain, fainting or breathlessness out of proportion; a limb that looks deformed or cannot bear weight after an injury; numbness, weakness or loss of bladder or bowel control.",
        "**Refer promptly** when: pain is sharp, sudden or does not settle within a few days; there is significant swelling, locking or giving way; pain wakes you at night or is present at rest; symptoms keep returning in the same place; or a problem is not improving after one to two weeks of sensible load reduction.",
        "Coaches and trainers should not diagnose; describe what you saw and refer. Record the injury in **Injuries** so the right staff can follow it.",
        "When in doubt, refer. This assistant cannot diagnose.",
      ],
    },
    he: {
      title: "מתי להפנות לפיזיותרפיסט או לרופא",
      keys: ["להפנות", "הפניה", "לפנות לרופא", "לפנות לפיזיו", "פיזיותרפיסט או לרופא", "מתי צריך", "דגל אדום", "דגלים אדומים"],
      body: [
        "**מפנים לטיפול דחוף** (או מתקשרים למספר החירום המקומי) כשיש: פגיעת ראש עם בלבול, כאב ראש, הקאות או איבוד הכרה; כאב בחזה, התעלפות או קוצר נשימה חריג; גף שנראה מעוות או שלא נושא משקל אחרי פציעה; חוסר תחושה, חולשה או איבוד שליטה על סוגרים.",
        "**מפנים במהירות** כשהכאב חד, פתאומי או לא נרגע תוך כמה ימים; יש נפיחות משמעותית, נעילה או חוסר יציבות; כאב מעיר בלילה או קיים במנוחה; התסמינים חוזרים באותו מקום; או שבעיה לא משתפרת אחרי שבוע עד שבועיים של הפחתת עומס סבירה.",
        "מאמנים ומאמנים אישיים לא מאבחנים; מתארים מה ראו ומפנים. רושמים את הפציעה ב**פציעות** כדי שהצוות הנכון יוכל לעקוב.",
        "בספק, מפנים. העוזר הזה לא מאבחן.",
      ],
    },
  },
  {
    id: "report-pain", roles: ["athlete"],
    en: {
      title: "Pain or an injury",
      keys: ["pain", "hurts", "hurt", "injured", "injury", "sore", "twinge", "strain", "sprain"],
      body: [
        "Tell your staff **early;** playing through pain usually makes things longer, not shorter.",
        "- Mention it in the daily check-in in **Readiness** (the pain option and notes) so staff are alerted.",
        "- Message your physiotherapist or coach in **Messages** and describe what you felt, when, and what makes it better or worse.",
        "- Do not self-diagnose or hide it to stay in the squad.",
        "- **Urgent signs** (head injury, severe pain, deformity, numbness, chest pain) need immediate medical care or your local emergency number.",
        "Follow your stages in **Injuries**; your staff update them as you progress.",
      ],
    },
    he: {
      title: "כאב או פציעה",
      keys: ["כאב", "כואב", "כואבת", "נפצעתי", "פציעה", "פצוע", "כאבי שרירים", "נקע", "מתיחה"],
      body: [
        "מספרים לצוות **מוקדם;** משחקים דרך כאב בדרך כלל מאריך את הזמן ולא מקצר אותו.",
        "- מציינים זאת בשאלון היומי ב**מוכנות** (אפשרות הכאב וההערות) כדי שהצוות יקבל התראה.",
        "- שולחים הודעה לפיזיותרפיסט או למאמן ב**הודעות** ומתארים מה הרגשתם, מתי, ומה משפר או מחמיר.",
        "- לא מאבחנים לבד ולא מסתירים כדי להישאר בסגל.",
        "- **סימנים דחופים** (פגיעת ראש, כאב עז, עיוות, חוסר תחושה, כאב בחזה) מחייבים טיפול רפואי מיידי או מספר החירום המקומי.",
        "עוקבים אחרי השלבים שלכם ב**פציעות**; הצוות מעדכן אותם עם ההתקדמות.",
      ],
    },
  },
  {
    id: "talk-coach", roles: ["athlete"],
    en: {
      title: "Talking to your coach about feeling overloaded",
      keys: ["overloaded", "overload", "overtrained", "too much training", "talk to my coach", "talk to the coach", "burnout", "burned out", "exhausted"],
      body: [
        "Choose a calm moment, not right after a session or match, and keep it factual:",
        "- Describe what you notice: sleep, soreness, mood, energy over the last days. Your **check-in trend in Readiness** is good evidence.",
        "- Say what you need: \"Could we lower the volume this week?\" is easier to answer than \"it's too much.\"",
        "- Say what you can do, such as sleep routine and food, so it is a shared plan.",
        "- You can bring the physio or performance coach into the conversation.",
        "- Message your coach in **Messages** if talking face to face is hard.",
        "Feeling flat for weeks, with poor sleep or low mood, is worth raising with a doctor too.",
      ],
    },
    he: {
      title: "שיחה עם המאמן על תחושת עומס יתר",
      keys: ["עומס יתר", "עומס", "מותש", "אימון יותר מדי", "לדבר עם המאמן", "מדברים עם המאמן", "שחיקה", "תשוש"],
      body: [
        "בוחרים רגע רגוע, לא מיד אחרי אימון או משחק, ושומרים על עובדות:",
        "- מתארים מה שמבחינים בו: שינה, כאבי שרירים, מצב רוח ואנרגיה בימים האחרונים. **מגמת השאלון היומי ב\"מוכנות\"** היא ראיה טובה.",
        "- אומרים מה צריך: \"אפשר להוריד נפח השבוע?\" קל יותר לענות עליו מ\"זה יותר מדי.\"",
        "- אומרים מה אתם יכולים לעשות, כמו שגרת שינה ותזונה, כדי שזו תהיה תוכנית משותפת.",
        "- אפשר לשתף בשיחה את הפיזיו או מאמן הכושר.",
        "- שולחים הודעה למאמן ב**הודעות** אם קשה לדבר פנים אל פנים.",
        "תחושה שטוחה במשך שבועות, עם שינה גרועה או מצב רוח ירוד, שווה לשתף גם עם רופא.",
      ],
    },
  },
  {
    id: "strength-basics", roles: [...BUILDERS],
    en: {
      title: "Strength training basics",
      keys: ["strength training", "get stronger", "build strength", "strength program", "hypertrophy", "squat", "deadlift", "sets and reps", "progressive overload", "1rm", "rpe"],
      body: [
        "- **Progressive overload:** raise reps, load or difficulty a little at a time, and record it.",
        "- Build around **multi-joint patterns:** squat or lunge, hinge, push, pull, and trunk, with single-leg work for sport.",
        "- Typical ranges: **strength** 3 to 5 sets of 3 to 6 reps at RPE 7 to 8 with 2 to 3 minutes rest; **hypertrophy** 3 to 4 sets of 6 to 12 reps; **power** 3 to 5 sets of 2 to 5 fast reps at lighter loads.",
        "- **2 to 3 sessions a week** build strength; **1 to 2 shorter sessions** maintain it in season.",
        "- Teach **technique before load,** especially with young athletes, and leave 1 to 3 reps in reserve on most sets.",
        "Use the **Exercises** library for videos and build sessions in **Training**; the chips there store sets, reps, load, percent of 1RM, RPE and rest.",
      ],
    },
    he: {
      title: "יסודות אימון כוח",
      keys: ["אימון כוח", "להתחזק", "לבנות כוח", "תוכנית כוח", "היפרטרופיה", "סקוואט", "דדליפט", "סטים וחזרות", "עומס פרוגרסיבי", "rpe"],
      body: [
        "- **עומס פרוגרסיבי:** מעלים חזרות, משקל או קושי טיפין טיפין, ורושמים.",
        "- בונים סביב **דפוסי תנועה רב-מפרקיים:** סקוואט או לאנג', ציר ירך, דחיפה, משיכה וגו, עם עבודה על רגל אחת לספורט.",
        "- טווחים טיפוסיים: **כוח** 3 עד 5 סטים של 3 עד 6 חזרות ב-RPE 7 עד 8 עם מנוחה של 2 עד 3 דקות; **היפרטרופיה** 3 עד 4 סטים של 6 עד 12 חזרות; **עוצמה** 3 עד 5 סטים של 2 עד 5 חזרות מהירות במשקלים קלים יותר.",
        "- **2 עד 3 אימונים בשבוע** בונים כוח; **1 עד 2 אימונים קצרים** משמרים אותו בעונה.",
        "- מלמדים **טכניקה לפני עומס,** במיוחד אצל צעירים, ומשאירים 1 עד 3 חזרות בעתודה ברוב הסטים.",
        "ספריית ה**תרגילים** כוללת סרטונים ובונים אימונים ב**אימונים**; הצ'יפים שם שומרים סטים, חזרות, משקל, אחוז מ-1RM, RPE ומנוחה.",
      ],
    },
  },
  {
    id: "speed-development", roles: [...BUILDERS],
    en: {
      title: "Developing speed and sprinting",
      keys: ["speed", "sprint", "sprinting", "acceleration", "max velocity", "faster", "agility", "change of direction", "cod"],
      body: [
        "- Train speed **fresh,** early in the session after a thorough warm-up, with **full recovery** between reps (roughly 1 minute per 10 metres for maximal efforts).",
        "- Cover both **acceleration** (0 to 20 metres, strong forward lean) and **maximum velocity** (30 to 40 metres with a build-up), 1 to 2 times a week.",
        "- Add **change-of-direction work** with a deceleration emphasis: slow in, stable, fast out.",
        "- Build up **exposure to near-maximum speed** gradually; regular sprinting is also protective for hamstrings.",
        "- Support with heavy-ish strength, jumps and trunk work; avoid sprinting when very fatigued.",
        "Sprint and change-of-direction drills are in the library; use **Auto-build session** with \"speed and agility\" for a first draft.",
      ],
    },
    he: {
      title: "פיתוח מהירות וספרינט",
      keys: ["מהירות", "ספרינט", "האצה", "מהירות מקסימלית", "יותר מהר", "זריזות", "שינוי כיוון"],
      body: [
        "- מאמנים מהירות **רעננים,** בתחילת האימון אחרי חימום יסודי, עם **התאוששות מלאה** בין חזרות (בערך דקה לכל 10 מטרים במאמצים מקסימליים).",
        "- מכסים גם **האצה** (0 עד 20 מטרים, הטיה קדימה חזקה) וגם **מהירות מקסימלית** (30 עד 40 מטרים עם בנייה), פעם עד פעמיים בשבוע.",
        "- מוסיפים **עבודת שינוי כיוון** עם דגש על האטה: לאט פנימה, יציב, מהר החוצה.",
        "- בונים **חשיפה למהירות קרובה למקסימום** בהדרגה; ספרינט סדיר גם מגן על הירך האחורית.",
        "- תומכים בכוח כבד-יחסית, קפיצות ועבודת גו; נמנעים מספרינט כשעייפים מאוד.",
        "תרגילי ספרינט ושינוי כיוון נמצאים בספרייה; ב**בניית אימון אוטומטית** אפשר לכתוב \"מהירות וזריזות\" לטיוטה ראשונה.",
      ],
    },
  },
  {
    id: "youth-load", roles: ["head_coach", "head_of_performance", "personal_trainer", "team_staff", "physiotherapist", "director"],
    en: {
      title: "Training young athletes",
      keys: ["youth", "young athletes", "adolescent", "teenager", "growth spurt", "growing", "academy", "u15", "u17", "u19", "kids", "children"],
      body: [
        "- **Growth spurts** (around peak height velocity) can temporarily reduce coordination and raise the risk of growth-related overuse problems; reduce impact volume and monitor pain around knees and heels.",
        "- Prioritise **movement skills, technique and general strength** over early specialisation and heavy loading.",
        "- Count the **whole load:** school, other sports, travel and sleep, not only club sessions.",
        "- Keep sessions varied and enjoyable, and make rest days real.",
        "- Parents or guardians must give consent for minors; the app records it at sign-up.",
        "Use the wellness check-in to catch problems early.",
      ],
    },
    he: {
      title: "אימון ספורטאים צעירים",
      keys: ["נוער", "ספורטאים צעירים", "מתבגר", "מתבגרים", "קפיצת גדילה", "גדילה", "אקדמיה", "ילדים", "ילד"],
      body: [
        "- **קפיצות גדילה** (סביב שיא קצב הגדילה) יכולות להפחית זמנית קואורדינציה ולהעלות סיכון לבעיות עומס יתר הקשורות לגדילה; מקטינים נפח פגיעות וממשיכים לעקוב אחרי כאב בברכיים ובעקבים.",
        "- נותנים עדיפות ל**מיומנויות תנועה, טכניקה וכוח כללי** על פני התמחות מוקדמת ועומס כבד.",
        "- סופרים את **העומס הכולל:** בית ספר, ענפים נוספים, נסיעות ושינה, לא רק אימוני מועדון.",
        "- שומרים על אימונים מגוונים ומהנים, וגורמים לימי מנוחה להיות אמיתיים.",
        "לקטינים נדרשת הסכמת הורה או אפוטרופוס; האפליקציה רושמת אותה בהרשמה.",
        "משתמשים בשאלון הרווחה כדי לזהות בעיות מוקדם.",
      ],
    },
  },
  {
    id: "howto-build-workout", roles: [...BUILDERS],
    en: {
      title: "How to build a workout in the app",
      keys: ["build a workout", "create a workout", "new program", "create a program", "add exercises", "session builder", "auto-build", "auto build", "assign a workout", "assign training", "how do i build"],
      body: [
        "1. Open **Training** and create a program (or open one).",
        "2. Add a session, open it, and add exercises from the **library** or press **Auto-build session** and describe the session (focus, minutes, equipment, injuries to avoid).",
        "3. Review the draft: it only uses exercises from your library; edit sets, reps, load, RPE and rest with the chips, drag to reorder.",
        "4. Changes are saved automatically.",
        "5. Assign the program to athletes or groups from the program page; athletes see it in **My Training** and **Today's workout**.",
      ],
    },
    he: {
      title: "איך בונים אימון באפליקציה",
      keys: ["לבנות אימון", "ליצור אימון", "תוכנית חדשה", "ליצור תוכנית", "להוסיף תרגילים", "בונה האימונים", "בניית אימון", "להקצות אימון", "איך בונים"],
      body: [
        "1. פותחים **אימונים** ויוצרים תוכנית (או פותחים קיימת).",
        "2. מוסיפים אימון, פותחים אותו ומוסיפים תרגילים מה**ספרייה** או לוחצים **בניית אימון אוטומטית** ומתארים את האימון (מיקוד, דקות, ציוד, פציעות להימנע מהן).",
        "3. בודקים את הטיוטה: היא משתמשת רק בתרגילים מהספרייה שלכם; עורכים סטים, חזרות, משקל, RPE ומנוחה בצ'יפים וגוררים לשינוי סדר.",
        "4. שינויים נשמרים אוטומטית.",
        "5. מקצים את התוכנית לספורטאים או לקבוצות מעמוד התוכנית; הספורטאים רואים אותה ב**האימונים שלי** וב**אימון היום**.",
      ],
    },
  },
  {
    id: "howto-checkin", roles: ["athlete"],
    en: {
      title: "Daily check-in",
      keys: ["daily check", "check-in", "check in", "readiness", "wellness", "how do i fill", "how am i feeling"],
      body: [
        "Open **Readiness** each day, before training, and rate sleep, fatigue, soreness, stress, mood and motivation, and mark pain if you have any. It takes under a minute.",
        "Your staff see flags when something changes from your usual, so be honest: a low score leads to adjustments, not punishment. You can follow your own trend there.",
      ],
    },
    he: {
      title: "שאלון יומי",
      keys: ["שאלון יומי", "צ'ק אין", "מוכנות", "רווחה", "איך ממלאים", "איך אני מרגיש"],
      body: [
        "פותחים את **מוכנות** כל יום, לפני האימון, ומדרגים שינה, עייפות, כאבי שרירים, לחץ, מצב רוח ומוטיבציה, ומסמנים כאב אם יש. לוקח פחות מדקה.",
        "הצוות רואה סימונים כשמשהו משתנה ממה שרגיל לכם, לכן כדאי להיות כנים: ציון נמוך מוביל להתאמות ולא לעונש. אפשר לעקוב שם אחרי המגמה שלכם.",
      ],
    },
  },
  {
    id: "howto-wearables", roles: ALL,
    en: {
      title: "Connecting a wearable",
      keys: ["connect whoop", "connect a wearable", "connect my", "import fitbit", "sync", "wearable", "wearables", "share my data", "sharing"],
      body: [
        "Open **Wearables.** Connect WHOOP (when the club has switched it on) or import a Fitbit or WHOOP export file. Recovery, HRV, sleep and strain appear on your page.",
        "**You decide whether your coaching staff can see this data,** and you can turn sharing off or erase the data at any time. Staff never see it without your permission.",
      ],
    },
    he: {
      title: "חיבור מכשיר לביש",
      keys: ["לחבר וופ", "לחבר מכשיר", "ייבוא פיטביט", "סנכרון", "מכשיר לביש", "מכשירים לבישים", "לשתף את הנתונים", "שיתוף"],
      body: [
        "פותחים **מכשירים לבישים.** מחברים WHOOP (כשהמועדון הפעיל אותו) או מייבאים קובץ ייצוא של Fitbit או WHOOP. התאוששות, HRV, שינה ומאמץ מופיעים בעמוד שלכם.",
        "**אתם מחליטים אם צוות האימון רואה את הנתונים,** ואפשר לכבות שיתוף או למחוק את הנתונים בכל עת. הצוות לא רואה אותם בלי אישורכם.",
      ],
    },
  },
  {
    id: "howto-export", roles: ALL,
    en: {
      title: "Exporting data",
      keys: ["export", "download my data", "download data", "csv", "spreadsheet", "excel", "backup my data"],
      body: [
        "Staff can export CSV files for athletes, tests, injuries, GPS, readiness and wearables; each export contains only what your role may already see. Open the file in Excel or Google Sheets.",
        "Anyone can download a full copy of their own data from **Settings,** under privacy and data.",
      ],
    },
    he: {
      title: "ייצוא נתונים",
      keys: ["ייצוא", "לייצא", "להוריד את הנתונים", "להוריד נתונים", "csv", "אקסל", "גיבוי נתונים"],
      body: [
        "הצוות יכול לייצא קובצי CSV של ספורטאים, מבדקים, פציעות, GPS, מוכנות ומכשירים לבישים; כל ייצוא כולל רק מה שהתפקיד שלכם כבר רשאי לראות. פותחים את הקובץ באקסל או ב-Google Sheets.",
        "כל אחד יכול להוריד עותק מלא של הנתונים שלו מ**הגדרות,** תחת פרטיות ונתונים.",
      ],
    },
  },
  {
    id: "howto-invite-staff", roles: ["director"],
    en: {
      title: "Inviting staff",
      keys: ["invite", "add a coach", "add staff", "new staff", "add physio", "invitation", "my team"],
      body: [
        "Open **My Team,** choose the person's role (head coach, head of performance, physiotherapist, assistant coach and so on) and send the invitation. They sign in with that email and join the club with the role you chose.",
        "Only the director can invite staff. You can manage squads there too, so a head coach sees only their own squad.",
      ],
    },
    he: {
      title: "הזמנת צוות",
      keys: ["להזמין", "הזמנה", "להוסיף מאמן", "להוסיף צוות", "איש צוות חדש", "להוסיף פיזיו", "הצוות שלי"],
      body: [
        "פותחים **הצוות שלי,** בוחרים את תפקיד האדם (מאמן ראשי, ראש ביצועים, פיזיותרפיסט, עוזר מאמן ועוד) ושולחים הזמנה. הם נכנסים עם אותו מייל ומצטרפים למועדון בתפקיד שבחרתם.",
        "רק המנהל יכול להזמין צוות. שם גם מנהלים קבוצות, כך שמאמן ראשי רואה רק את הקבוצה שלו.",
      ],
    },
  },
  {
    id: "howto-privacy", roles: ALL,
    en: {
      title: "Privacy and who sees what",
      keys: ["privacy", "who can see", "my data", "delete my account", "delete account", "two-factor", "two factor", "2fa", "password", "security"],
      body: [
        "Each role sees only what it needs: athletes see their own data, staff see their athletes, the director has a read-only overview, and a head coach sees only their squad. This is enforced in the database, not just on screen.",
        "In **Settings** you can turn on **two-factor authentication,** set automatic sign-out when idle, download your data or delete your account. Read the full **Privacy** page for details.",
      ],
    },
    he: {
      title: "פרטיות ומי רואה מה",
      keys: ["פרטיות", "מי יכול לראות", "הנתונים שלי", "למחוק את החשבון", "מחיקת חשבון", "אימות דו שלבי", "אימות דו-שלבי", "סיסמה", "אבטחה"],
      body: [
        "כל תפקיד רואה רק מה שהוא צריך: ספורטאים רואים את הנתונים שלהם, הצוות רואה את הספורטאים שלו, למנהל יש סקירה לקריאה בלבד, ומאמן ראשי רואה רק את הקבוצה שלו. זה נאכף במסד הנתונים ולא רק במסך.",
        "ב**הגדרות** אפשר להפעיל **אימות דו-שלבי,** לקבוע יציאה אוטומטית בחוסר פעילות, להוריד את הנתונים או למחוק את החשבון. את הפרטים המלאים אפשר לקרוא בעמוד **הפרטיות**.",
      ],
    },
  },
  {
    id: "howto-messages", roles: ALL,
    en: {
      title: "Messages",
      keys: ["message", "messages", "send a message", "chat with", "write to my coach", "contact my coach", "attach a file"],
      body: [
        "Open **Messages,** pick the person you work with and write; you can attach files. Conversations are private between the two of you, and you get a notification when someone replies.",
      ],
    },
    he: {
      title: "הודעות",
      keys: ["הודעה", "הודעות", "לשלוח הודעה", "לכתוב למאמן", "ליצור קשר עם המאמן", "לצרף קובץ"],
      body: [
        "פותחים **הודעות,** בוחרים את מי שעובדים איתו וכותבים; אפשר לצרף קבצים. השיחות פרטיות בין שניכם, וכשמישהו עונה מגיעה התראה.",
      ],
    },
  },
];
