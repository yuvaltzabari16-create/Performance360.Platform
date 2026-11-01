/* ---------- Terms of Service and Privacy Policy ({vendor} and {contact} are filled from the configuration) ---------- */
const LEGAL_DATE = "2026-11-01";
const LEGAL_EN = {
  terms: { title: "Terms of Service", body: `
<h3>1. The service</h3><p>{vendor} provides Performance360 Academy, an online service that sports academies use to plan training, record tests, track nutrition and payments, and communicate with their athletes. Each academy is opened by an owner, who decides who joins it.</p>
<h3>2. Accounts and sign-in</h3><p>You sign in with your email address and a one-time code. Keep access to your email secure; anyone who can read it can sign in as you. Sign-in codes given to you by an academy are personal to your role. Don't share them.</p>
<h3>3. Academy owners</h3><p>The owner is responsible for the academy's use of the service: inviting only people who belong, keeping codes private, the accuracy of the records they keep, and getting the consents the law requires before recording information about athletes, including a parent's or guardian's consent for minors. The owner controls the academy's data and can download or delete it.</p>
<h3>4. Coaches and physiotherapists</h3><p>Staff may use athletes' records only to coach and care for them, must keep them confidential and must not copy them outside the academy. Clinical decisions remain the professional responsibility of the staff member.</p>
<h3>5. Athletes</h3><p>Athletes see and add only their own information. The service does not give medical advice. Report pain or injury to your physiotherapist or doctor.</p>
<h3>6. Free trial and subscription</h3><p>New academies get a 30-day free trial. After that, an active subscription is needed to keep changing records. If a subscription ends, the academy's records stay readable and downloadable for at least 90 days before they may be deleted. Prices and payment terms are agreed with {vendor}.</p>
<h3>7. Acceptable use</h3><p>Don't try to reach data you weren't given, interfere with the service, upload unlawful content, or use the service to harass anyone. We may suspend accounts that break these rules.</p>
<h3>8. Availability and liability</h3><p>We work to keep the service available and secure but can't promise it will be uninterrupted or error-free. To the extent the law allows, {vendor}'s liability is limited to the fees the academy paid in the 12 months before the claim.</p>
<h3>9. Ending use</h3><p>You can delete your account at any time in Settings → Privacy & data. An owner who deletes their account also deletes their academy and its records.</p>
<h3>10. Changes and contact</h3><p>We'll announce material changes to these terms in the app before they apply. Questions: {contact}.</p>` },
  privacy: { title: "Privacy Policy", body: `
<h3>Who is responsible</h3><p>Each academy decides what it records about its athletes and staff, and is responsible for that information. {vendor} runs the service on the academy's behalf and processes the information only to provide it.</p>
<h3>What we store</h3><ul><li>Account: email address and the name you give.</li><li>Athlete profile: date of birth, sport, contact details, guardian and emergency contacts, and medical notes the athlete chooses to add.</li><li>Training: plans, workout logs, effort, pain reports, test results and coach notes.</li><li>Nutrition: meals, nutrition values and meal photos.</li><li>Messages between athletes and staff, and among staff.</li><li>Payments the owner records (amounts and dates, not card details).</li></ul>
<h3>Who can see it</h3><p>An athlete sees only their own records. The academy's coaches and physiotherapists see the records of the academy's athletes. Only the owner sees payments. Staff-only notes are hidden from athletes. Each person's preferences are visible only to them. Other academies can't see anything. These limits are enforced by the database itself.</p>
<h3>Where it's kept</h3><p>Records and photos are stored with our hosting provider (Supabase) in an encrypted database, sent only over encrypted connections, and kept apart from every other academy. We don't sell personal information or use it for advertising.</p>
<h3>Minors</h3><p>Athletes under 18 may use the service only with a parent's or guardian's agreement, which the academy is responsible for obtaining. A parent or guardian can ask the academy to see, correct or delete a minor's information.</p>
<h3>How long we keep it</h3><p>Records stay while the academy uses the service. The academy sets how long records are kept after an athlete leaves (24 months unless changed). Deleting an account removes the person's sign-in and their own records.</p>
<h3>Your rights</h3><p>You can see your information in the app, download a copy in Settings → Privacy & data, correct your profile, and delete your account. For anything else, ask your academy or contact {contact}.</p>
<h3>Security</h3><p>Sign-in uses one-time email codes, access is limited by role, and every change records who made it. If we learn of a breach affecting your information, we'll tell the academy and, where the law requires, the authorities.</p>` },
};
const LEGAL_HE = {
  terms: { title: "תנאי שימוש", body: `
<h3>1. השירות</h3><p>{vendor} מפעילה את Performance360 Academy, שירות מקוון שאקדמיות ספורט משתמשות בו כדי לתכנן אימונים, לתעד מבדקים, לעקוב אחר תזונה ותשלומים ולתקשר עם הספורטאים. כל אקדמיה נפתחת על ידי בעלים, שמחליטים מי מצטרף אליה.</p>
<h3>2. חשבונות וכניסה</h3><p>הכניסה נעשית עם כתובת אימייל וקוד חד-פעמי. שמרו על הגישה לתיבת המייל שלכם; כל מי שקורא אותה יכול להיכנס בשמכם. קודי הכניסה שהאקדמיה נותנת לכם אישיים לתפקיד שלכם. אל תעבירו אותם הלאה.</p>
<h3>3. בעלי אקדמיה</h3><p>הבעלים אחראים לשימוש של האקדמיה בשירות: להזמין רק את מי שצריך, לשמור על סודיות הקודים, לדייק ברשומות, ולקבל את ההסכמות שהחוק דורש לפני תיעוד מידע על ספורטאים, כולל הסכמת הורה או אפוטרופוס לקטינים. הבעלים שולטים בנתוני האקדמיה ויכולים להוריד או למחוק אותם.</p>
<h3>4. מאמנים ופיזיותרפיסטים</h3><p>אנשי צוות רשאים להשתמש ברשומות הספורטאים רק לאימון ולטיפול בהם, חייבים לשמור על סודיותן ואסור להם להעתיק אותן אל מחוץ לאקדמיה. החלטות קליניות נשארות באחריותו המקצועית של איש הצוות.</p>
<h3>5. ספורטאים</h3><p>ספורטאים רואים ומוסיפים רק את המידע שלהם. השירות אינו נותן ייעוץ רפואי. על כאב או פציעה דווחו לפיזיותרפיסט או לרופא.</p>
<h3>6. ניסיון חינם ומנוי</h3><p>אקדמיות חדשות מקבלות 30 ימי ניסיון חינם. לאחר מכן נדרש מנוי פעיל כדי להמשיך לעדכן רשומות. אם המנוי מסתיים, רשומות האקדמיה נשארות זמינות לקריאה ולהורדה לפחות 90 יום לפני שעשויות להימחק. המחירים ותנאי התשלום מוסכמים מול {vendor}.</p>
<h3>7. שימוש הוגן</h3><p>אין לנסות להגיע למידע שלא ניתן לכם, לפגוע בשירות, להעלות תוכן בלתי חוקי או להשתמש בשירות כדי להטריד. אנו רשאים להשעות חשבונות שמפרים כללים אלה.</p>
<h3>8. זמינות ואחריות</h3><p>אנו פועלים לשמור על השירות זמין ומאובטח, אך איננו מתחייבים שיפעל ללא הפרעות או תקלות. ככל שהחוק מתיר, אחריות {vendor} מוגבלת לסכום שהאקדמיה שילמה ב-12 החודשים שקדמו לתביעה.</p>
<h3>9. סיום שימוש</h3><p>אפשר למחוק את החשבון בכל עת בהגדרות ← פרטיות ונתונים. בעלים שמוחקים את החשבון מוחקים גם את האקדמיה ואת הרשומות שלה.</p>
<h3>10. שינויים ויצירת קשר</h3><p>על שינויים מהותיים בתנאים נודיע באפליקציה לפני שייכנסו לתוקף. לשאלות: {contact}.</p>` },
  privacy: { title: "מדיניות פרטיות", body: `
<h3>מי אחראי</h3><p>כל אקדמיה מחליטה מה היא מתעדת על הספורטאים והצוות שלה ואחראית למידע הזה. {vendor} מפעילה את השירות עבור האקדמיה ומעבדת את המידע רק כדי לספק אותו.</p>
<h3>מה נשמר</h3><ul><li>חשבון: כתובת אימייל והשם שמסרתם.</li><li>פרופיל ספורטאי: תאריך לידה, ענף, פרטי קשר, הורה ואיש קשר לחירום, והערות רפואיות שהספורטאי בוחר להוסיף.</li><li>אימונים: תוכניות, דיווחי אימון, מאמץ, דיווחי כאב, תוצאות מבדקים והערות מאמן.</li><li>תזונה: ארוחות, ערכים תזונתיים ותמונות ארוחות.</li><li>הודעות בין ספורטאים לצוות ובין אנשי הצוות.</li><li>תשלומים שהבעלים מתעדים (סכומים ותאריכים, לא פרטי כרטיס).</li></ul>
<h3>מי רואה</h3><p>ספורטאי רואה רק את הרשומות שלו. המאמנים והפיזיותרפיסטים של האקדמיה רואים את רשומות הספורטאים שלה. רק הבעלים רואים תשלומים. הערות לצוות בלבד מוסתרות מהספורטאים. ההעדפות של כל אדם גלויות רק לו. אקדמיות אחרות לא רואות דבר. המגבלות נאכפות על ידי מסד הנתונים עצמו.</p>
<h3>איפה זה נשמר</h3><p>הרשומות והתמונות נשמרות אצל ספק האחסון שלנו (Supabase) במסד נתונים מוצפן, מועברות רק בחיבורים מוצפנים ומופרדות מכל אקדמיה אחרת. איננו מוכרים מידע אישי ואיננו משתמשים בו לפרסום.</p>
<h3>קטינים</h3><p>ספורטאים מתחת לגיל 18 רשאים להשתמש בשירות רק בהסכמת הורה או אפוטרופוס, שהאקדמיה אחראית לקבל. הורה או אפוטרופוס יכולים לבקש מהאקדמיה לעיין במידע של הקטין, לתקן אותו או למחוק אותו.</p>
<h3>כמה זמן נשמר</h3><p>הרשומות נשמרות כל עוד האקדמיה משתמשת בשירות. האקדמיה קובעת כמה זמן לשמור רשומות אחרי שספורטאי עוזב (24 חודשים אם לא שונה). מחיקת חשבון מסירה את הכניסה של האדם ואת הרשומות שלו.</p>
<h3>הזכויות שלכם</h3><p>אפשר לראות את המידע שלכם באפליקציה, להוריד עותק בהגדרות ← פרטיות ונתונים, לתקן את הפרופיל ולמחוק את החשבון. לכל דבר אחר פנו לאקדמיה או אלינו: {contact}.</p>
<h3>אבטחה</h3><p>הכניסה בקודים חד-פעמיים במייל, הגישה מוגבלת לפי תפקיד, וכל שינוי מתועד עם מי שביצע אותו. אם נדע על אירוע אבטחה שפוגע במידע שלכם, נודיע לאקדמיה ולרשויות כשהחוק מחייב.</p>` },
};
