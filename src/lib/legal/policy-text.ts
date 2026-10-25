/**
 * Privacy policy and terms of use, in both languages. Kept apart from the UI dictionary because they
 * are long, structured documents. Operator details come from environment variables (see operator.ts);
 * nothing about the operator is invented here. These texts are a working draft for legal review.
 */
import type { Locale } from "@/lib/types";

export interface PolicySection {
  title: string;
  body: string[];
  bullets?: string[];
}

export interface PolicyDoc {
  title: string;
  intro: string;
  sections: PolicySection[];
}

const privacyEn: PolicyDoc = {
  title: "Privacy policy",
  intro: "Performance360 is used by athletes, coaches and medical and performance staff. Some of the information you enter is sensitive, including health and training data. This page explains what we collect, who can see it and what you can do about it.",
  sections: [
    { title: "Who is responsible for your data", body: ["The operator named at the bottom of this page decides why and how personal data is used (the \"controller\"). Where a club or a coach adds athletes and their data, that club or coach is also responsible for having the right to do so, including the consent of athletes and, for minors, their parents or guardians."] },
    {
      title: "What we collect",
      body: ["We collect only what the service needs:"],
      bullets: [
        "Account: name, email address, a password (stored only as a hash), language and unit preferences, two-factor settings.",
        "Athlete profile: date of birth, sport, position, body measurements, goals, availability, emergency contact, and a parent or guardian's name and contact for minors.",
        "Health-related information: injuries and their timeline, diagnoses and clearance decisions entered by professionals, rehabilitation status, pain and wellness check-ins, limitations. This is sensitive information.",
        "Training and performance: programs, workout logs, test results, GPS and wearable data (distance, speeds, heart rate, pitch positions).",
        "Communication and files: messages and attached documents or images.",
        "Wearable data you choose to connect or import (WHOOP, Fitbit): recovery, heart-rate variability, resting heart rate, sleep and strain. Your device login tokens are stored encrypted.",
        "Technical: security and audit records (who did what and when), and the network address of requests, used for abuse prevention and rate limiting.",
      ],
    },
    {
      title: "Why we use it and on what basis",
      body: ["We use your information to run your account, show you your training and health information, let the people you work with do their jobs, protect the service from abuse, and meet legal obligations. Health-related information is used on the basis of your explicit consent, which you give when you create an account and accept this policy, and which you can withdraw by deleting your account. We do not sell personal data and do not show advertising."],
    },
    {
      title: "Who can see what",
      body: ["Access follows roles and is enforced in the database, not only in the screens:"],
      bullets: [
        "Athlete: sees their own data, including their own GPS results, injuries and messages.",
        "Head coach, head of performance, physiotherapist and other staff of the athlete's team: see the data of athletes on their roster that their role needs. The physiotherapist handles the medical side; the head of performance handles training, testing and GPS.",
        "Club director: can read all information about the club's roster athletes, read-only. The director cannot build training programs or use the exercise library.",
        "Independent personal trainers: see only athletes who connected to them.",
        "Private notes of coaches and staff are visible to their authors and the athlete's professionals; notes shared with the athlete are visible to the athlete.",
        "Wearable data is private to you until you switch on sharing; then the staff who work with you and your club director can read it. Sharing can be turned off, and the data erased, at any time.",
        "Messages and their files are visible only to the sender and the recipient.",
        "People who operate the service can access data only as far as needed to keep it running and secure, and their actions on personal data are logged.",
      ],
    },
    {
      title: "Service providers and transfers abroad",
      body: ["We use providers to host and run the service: database and authentication hosting, application hosting, and email delivery. If the AI workout builder or the chat assistant is switched on, the text you type into it is sent to the AI provider to generate a reply; the assistant does not receive your athletes' or your own records, and you should not enter personal or health details there. Providers may process data outside Israel. We choose providers that commit to appropriate security and data-protection terms."],
    },
    {
      title: "How long we keep data and how to delete it",
      body: ["You can permanently delete your account from Settings. This removes your sign-in and profile, and the athlete record you created for yourself. A record that a coach created about an athlete stays with that coach as a professional record, unlinked from the deleted account. Security audit entries keep only the removed account's identifier. Data in backups is removed when backups expire. Ask us if you need data removed from a coach's record."],
    },
    {
      title: "Your rights",
      body: ["You may ask to see the information we hold about you, to correct it, to delete it and to withdraw consent. Much of this is available directly in the app: edit your profile, export test results, and delete your account. For anything else, or to complain about how your data is handled, contact us. You may also contact the Israeli Privacy Protection Authority."],
    },
    {
      title: "Children and minors",
      body: ["Athletes under 18 may use Performance360 only with the consent of a parent or guardian. The athlete's profile has a place to record the guardian's name and contact and the date of consent. Until it is recorded, the profile is marked as missing parental consent. A parent or guardian may ask us or the club to see, correct or delete a minor's data."],
    },
    {
      title: "Security",
      body: ["We protect data with encrypted connections (HTTPS), access rules enforced per record in the database, optional two-factor authentication, automatic sign-out of idle sessions, request rate limits, bot protection on forms, and an audit log of sensitive actions. No system is perfectly secure; if a security incident affects your data we will notify you and the authorities as the law requires."],
    },
    {
      title: "Cookies and local storage",
      body: ["We use only what the service needs to work: a sign-in session, your language choice and the idle sign-out setting. We do not use advertising or tracking cookies."],
    },
    { title: "Changes to this policy", body: ["When we change this policy in a way that matters, we will tell you in the app and ask you to accept the new version. The version you accepted and when is recorded on your account."] },
  ],
};

const termsEn: PolicyDoc = {
  title: "Terms of use",
  intro: "These terms govern your use of Performance360. By creating an account you agree to them and to the privacy policy.",
  sections: [
    { title: "The service", body: ["Performance360 is software for planning and recording athletic training, testing, wellness, injuries, wearable data and communication between athletes and the staff who work with them. Features may change as the service develops."] },
    { title: "Accounts and roles", body: ["Keep your sign-in details secret and tell us if you think someone else has used your account. Your role (athlete, head coach, head of performance, physiotherapist, club director, personal trainer) decides what you can see and do. You may not try to access data your role does not allow."] },
    { title: "Professional judgment and no medical advice", body: ["Performance360 records and organizes information; it does not diagnose, treat or clear anyone. Injury stages, clearance to return to play and training decisions are made by qualified people, and the app records their decision. Figures from wearables and calculations are aids, not medical measurements. In an emergency contact emergency services; messages in the app are not monitored for emergencies."] },
    { title: "Your content and responsibilities", body: ["You are responsible for the information you enter and for having the right to enter it. Coaches and clubs who add athletes must have the athlete's consent and, for minors, the consent of a parent or guardian. Do not upload unlawful, harmful or infringing content."] },
    { title: "Files and imports", body: ["You may attach documents and images of the allowed types, up to 5 MB each, and import wearable export files. Files are made available only to the people allowed to see the record they belong to. We may remove files that break these terms."] },
    { title: "Acceptable use", body: ["Do not disrupt or overload the service, probe or bypass its security, scrape data, send spam through it, or use it to harass others. We may limit or suspend accounts that do."] },
    { title: "AI assistant", body: ["When enabled, the AI workout builder drafts workouts from your instructions and the chat assistant answers questions about the app and training. Drafts and answers can be wrong; a qualified person must review them before use, and the assistant does not diagnose or clear anyone. Do not enter personal or health details into the assistant."] },
    { title: "Payments and third-party links", body: ["Payments, if any, are handled by an external payment provider; Performance360 does not collect card details. Some links to products or services may be affiliate links, as stated on the disclosures page."] },
    { title: "Availability", body: ["We work to keep the service available but do not promise it will always be uninterrupted or error-free. Keep your own copies of information you cannot afford to lose."] },
    { title: "Liability", body: ["To the extent the law allows, the operator is not liable for indirect or consequential loss, or for decisions taken on the basis of information in the app. Nothing here limits liability that cannot be limited by law."] },
    { title: "Ending your use", body: ["You can delete your account at any time from Settings. We may suspend or close accounts that seriously or repeatedly break these terms."] },
    { title: "Changes and governing law", body: ["We may update these terms and will tell you in the app; continuing to use the service after an update means you accept it, and we may ask you to accept the new version explicitly. These terms are governed by the laws of the State of Israel, and the competent courts there have jurisdiction, unless mandatory consumer law says otherwise."] },
  ],
};

const privacyHe: PolicyDoc = {
  title: "מדיניות פרטיות",
  intro: "Performance360 משמשת ספורטאים, מאמנים וצוותים רפואיים ומקצועיים. חלק מהמידע שמוזן הוא רגיש, כולל נתוני בריאות ואימון. בעמוד הזה מוסבר איזה מידע נאסף, מי רואה אותו ומה אפשר לעשות לגביו.",
  sections: [
    { title: "מי אחראי למידע שלך", body: ["המפעיל המופיע בתחתית העמוד קובע למה ואיך משתמשים במידע אישי (\"בעל מאגר המידע\"). כאשר מועדון או מאמן מוסיפים ספורטאים ונתונים עליהם, המועדון או המאמן אחראים גם לכך שיש להם זכות לעשות זאת, כולל הסכמת הספורטאים, ובקטינים הסכמת הוריהם או אפוטרופוסיהם."] },
    {
      title: "איזה מידע נאסף",
      body: ["נאסף רק המידע שהשירות צריך:"],
      bullets: [
        "חשבון: שם, כתובת מייל, סיסמה (נשמרת רק כגיבוב), העדפות שפה ויחידות, הגדרות אימות דו-שלבי.",
        "פרופיל ספורטאי: תאריך לידה, ענף, עמדה, מדדי גוף, מטרות, זמינות, איש קשר לחירום, ובקטינים שם ופרטי קשר של הורה או אפוטרופוס.",
        "מידע הקשור לבריאות: פציעות וציר הזמן שלהן, אבחנות והחלטות אישור חזרה שמזינים אנשי מקצוע, מצב שיקום, דיווחי כאב ותחושה, מגבלות. זהו מידע רגיש.",
        "אימון וביצועים: תוכניות, יומני אימון, תוצאות בדיקות, נתוני GPS וחיישנים (מרחק, מהירויות, דופק, מיקומים במגרש).",
        "תקשורת וקבצים: הודעות ומסמכים או תמונות מצורפים.",
        "נתוני שעון שבחרת לחבר או לייבא (WHOOP, ‏Fitbit): התאוששות, שונות דופק, דופק מנוחה, שינה ועומס. אסימוני ההתחברות למכשיר נשמרים מוצפנים.",
        "טכני: רישומי אבטחה וביקורת (מי עשה מה ומתי) וכתובת הרשת של בקשות, לצורך מניעת ניצול לרעה והגבלת קצב בקשות.",
      ],
    },
    {
      title: "למה משתמשים במידע ועל סמך מה",
      body: ["אנחנו משתמשים במידע כדי להפעיל את החשבון, להציג לך את מידע האימון והבריאות שלך, לאפשר לאנשים שאתה עובד איתם לבצע את תפקידם, להגן על השירות מניצול לרעה ולעמוד בחובות חוקיות. מידע הקשור לבריאות מעובד על סמך הסכמתך המפורשת, שניתנת בעת יצירת החשבון וקבלת המדיניות, ואפשר לבטל אותה על ידי מחיקת החשבון. איננו מוכרים מידע אישי ואיננו מציגים פרסומות."],
    },
    {
      title: "מי רואה מה",
      body: ["הגישה נקבעת לפי תפקידים ונאכפת במסד הנתונים, לא רק במסכים:"],
      bullets: [
        "ספורטאי: רואה את המידע שלו, כולל תוצאות ה-GPS, הפציעות וההודעות שלו.",
        "מאמן ראשי, ראש מחלקת ביצועים, פיזיותרפיסט ויתר אנשי הצוות של קבוצת הספורטאי: רואים את מידע ספורטאי הסגל שהתפקיד שלהם דורש. הפיזיותרפיסט מטפל בצד הרפואי; ראש מחלקת הביצועים מטפל באימון, בבדיקות וב-GPS.",
        "מנהל המועדון: יכול לקרוא את כל המידע על ספורטאי הסגל, לקריאה בלבד. המנהל אינו בונה תוכניות אימון ואינו משתמש בספריית התרגילים.",
        "מאמנים אישיים עצמאיים: רואים רק ספורטאים שהתחברו אליהם.",
        "הערות פרטיות של מאמנים ואנשי צוות גלויות לכותבן ולאנשי המקצוע של הספורטאי; הערות ששותפו עם הספורטאי גלויות גם לו.",
        "נתוני שעון פרטיים לך עד שתדליק שיתוף; אז אנשי הצוות שעובדים איתך ומנהל המועדון יכולים לקרוא אותם. אפשר לכבות את השיתוף ולמחוק את הנתונים בכל רגע.",
        "הודעות והקבצים שלהן גלויים רק לשולח ולנמען.",
        "מי שמפעיל את השירות ניגש למידע רק במידה הנדרשת לתפעול ואבטחה, ופעולותיו על מידע אישי נרשמות.",
      ],
    },
    {
      title: "ספקי שירות והעברה לחו\"ל",
      body: ["אנחנו משתמשים בספקים לאחסון והפעלת השירות: אחסון מסד נתונים והזדהות, אחסון האפליקציה ושליחת מיילים. אם בונה האימונים עם AI או עוזר הצ'אט מופעלים, הטקסט שאתה מקליד בהם נשלח לספק ה-AI לצורך יצירת תשובה; העוזר אינו מקבל את הרשומות של הספורטאים או שלך, ואין להזין בו פרטים אישיים או בריאותיים. ספקים עשויים לעבד מידע מחוץ לישראל. אנחנו בוחרים ספקים שמתחייבים לאבטחה ולתנאי הגנת מידע הולמים."],
    },
    {
      title: "כמה זמן שומרים ואיך מוחקים",
      body: ["אפשר למחוק את החשבון לצמיתות דרך ההגדרות. הפעולה מסירה את ההתחברות והפרופיל ואת רשומת הספורטאי שיצרת לעצמך. רשומה שמאמן יצר על ספורטאי נשארת אצל המאמן כרשומה מקצועית, מנותקת מהחשבון שנמחק. רישומי ביקורת אבטחה שומרים רק את מזהה החשבון שהוסר. מידע בגיבויים נמחק כשהגיבויים פגים. אם צריך להסיר מידע מרשומה של מאמן, פנו אלינו."],
    },
    {
      title: "הזכויות שלך",
      body: ["אתה רשאי לבקש לעיין במידע שנשמר עליך, לתקן אותו, למחוק אותו ולבטל הסכמה. חלק גדול מזה זמין ישירות באפליקציה: עריכת פרופיל, ייצוא תוצאות בדיקות ומחיקת חשבון. לכל דבר אחר, או כדי להתלונן על אופן הטיפול במידע, פנו אלינו. אפשר גם לפנות לרשות להגנת הפרטיות."],
    },
    {
      title: "ילדים וקטינים",
      body: ["ספורטאים מתחת לגיל 18 רשאים להשתמש ב-Performance360 רק בהסכמת הורה או אפוטרופוס. בפרופיל הספורטאי יש מקום לרשום את שם ופרטי הקשר של האפוטרופוס ואת תאריך ההסכמה. עד שזה נרשם, הפרופיל מסומן כחסר הסכמת הורים. הורה או אפוטרופוס רשאי לבקש מאיתנו או מהמועדון לעיין במידע של קטין, לתקן או למחוק אותו."],
    },
    {
      title: "אבטחה",
      body: ["אנחנו מגינים על המידע בחיבור מוצפן (HTTPS), בכללי גישה הנאכפים לכל רשומה במסד הנתונים, באימות דו-שלבי אופציונלי, בניתוק אוטומטי של חיבורים לא פעילים, בהגבלת קצב בקשות, בחסימת בוטים בטפסים וביומן ביקורת של פעולות רגישות. אין מערכת מאובטחת לחלוטין; אם אירוע אבטחה יפגע במידע שלך נודיע לך ולרשויות כנדרש בחוק."],
    },
    {
      title: "עוגיות ואחסון מקומי",
      body: ["אנחנו משתמשים רק במה שהשירות צריך כדי לעבוד: חיבור פעיל, בחירת השפה והגדרת הניתוק האוטומטי. איננו משתמשים בעוגיות פרסום או מעקב."],
    },
    { title: "שינויים במדיניות", body: ["כשנשנה את המדיניות בצורה מהותית נודיע באפליקציה ונבקש לאשר את הגרסה החדשה. הגרסה שאישרת ומועד האישור נרשמים בחשבון."] },
  ],
};

const termsHe: PolicyDoc = {
  title: "תנאי שימוש",
  intro: "התנאים האלה חלים על השימוש ב-Performance360. בעת יצירת חשבון אתה מסכים להם ולמדיניות הפרטיות.",
  sections: [
    { title: "השירות", body: ["Performance360 היא תוכנה לתכנון ולתיעוד אימוני כושר, בדיקות, תחושת ספורטאים, פציעות, נתוני חיישנים ותקשורת בין ספורטאים לצוותים שעובדים איתם. יכולות עשויות להשתנות עם התפתחות השירות."] },
    { title: "חשבונות ותפקידים", body: ["שמרו את פרטי ההתחברות בסוד ודווחו לנו אם אתם חושבים שמישהו אחר השתמש בחשבון. התפקיד שלכם (ספורטאי, מאמן ראשי, ראש מחלקת ביצועים, פיזיותרפיסט, מנהל מועדון, מאמן אישי) קובע מה תוכלו לראות ולעשות. אסור לנסות לגשת למידע שהתפקיד אינו מתיר."] },
    { title: "שיקול דעת מקצועי ואין ייעוץ רפואי", body: ["Performance360 מתעדת ומארגנת מידע; היא אינה מאבחנת, מטפלת או מאשרת חזרה לפעילות. שלבי פציעה, אישור חזרה למשחק והחלטות אימון מתקבלים על ידי אנשים מוסמכים, והאפליקציה מתעדת את החלטתם. נתוני חיישנים וחישובים הם כלי עזר ולא מדידות רפואיות. במצב חירום פנו לשירותי החירום; הודעות באפליקציה אינן מנוטרות למצבי חירום."] },
    { title: "התוכן שלכם ואחריותכם", body: ["אתם אחראים למידע שאתם מזינים ולכך שיש לכם זכות להזין אותו. מאמנים ומועדונים שמוסיפים ספורטאים חייבים לקבל את הסכמתם, ובקטינים את הסכמת הורה או אפוטרופוס. אסור להעלות תוכן בלתי חוקי, מזיק או מפר זכויות."] },
    { title: "קבצים וייבוא", body: ["אפשר לצרף מסמכים ותמונות מהסוגים המותרים, עד 5 מ״ב כל אחד, ולייבא קובצי חיישנים. קבצים זמינים רק למי שמורשה לראות את הרשומה שאליה הם שייכים. אנחנו רשאים להסיר קבצים שמפרים את התנאים."] },
    { title: "שימוש מותר", body: ["אסור להפריע לשירות או להעמיס עליו, לבדוק או לעקוף את האבטחה שלו, לגרד ממנו מידע, לשלוח דרכו ספאם או להשתמש בו להטרדה. אנחנו רשאים להגביל או להשעות חשבונות שעושים זאת."] },
    { title: "עוזר ה-AI", body: ["כשהם מופעלים, בונה האימונים עם AI כותב טיוטות אימון לפי ההוראות שלכם ועוזר הצ'אט עונה על שאלות על האפליקציה ועל אימון. טיוטות ותשובות עלולות להיות שגויות; איש מקצוע מוסמך חייב לעבור עליהן לפני שימוש, והעוזר אינו מאבחן או מאשר חזרה לפעילות. אל תזינו בעוזר פרטים אישיים או בריאותיים."] },
    { title: "תשלומים וקישורים חיצוניים", body: ["תשלומים, אם יהיו, מטופלים על ידי ספק סליקה חיצוני; Performance360 אינה אוספת פרטי כרטיס. חלק מהקישורים למוצרים או שירותים עשויים להיות קישורי שותפים, כמפורט בעמוד הגילויים."] },
    { title: "זמינות", body: ["אנחנו פועלים לשמור על זמינות השירות אך אין הבטחה שיפעל ברציפות וללא תקלות. שמרו עותקים של מידע שאי אפשר לוותר עליו."] },
    { title: "אחריות", body: ["במידה שהדין מתיר, המפעיל אינו אחראי לנזק עקיף או תוצאתי, או להחלטות שהתקבלו על סמך מידע באפליקציה. אין בכך הגבלה של אחריות שאי אפשר להגביל על פי דין."] },
    { title: "סיום השימוש", body: ["אפשר למחוק את החשבון בכל עת דרך ההגדרות. אנחנו רשאים להשעות או לסגור חשבונות שמפרים את התנאים הפרה חמורה או חוזרת."] },
    { title: "שינויים ודין חל", body: ["אנחנו רשאים לעדכן את התנאים ונודיע באפליקציה; המשך שימוש אחרי עדכון מהווה הסכמה, ואנו עשויים לבקש אישור מפורש של הגרסה החדשה. על התנאים חל הדין במדינת ישראל, ולבתי המשפט המוסמכים בה סמכות שיפוט, אלא אם דיני צרכנות קוגנטיים קובעים אחרת."] },
  ],
};

const DOCS = { privacy: { en: privacyEn, he: privacyHe }, terms: { en: termsEn, he: termsHe } } as const;

export function policyDoc(kind: "privacy" | "terms", locale: Locale): PolicyDoc {
  return DOCS[kind][locale];
}
