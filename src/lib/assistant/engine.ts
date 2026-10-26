import { assistantRole, type AssistantRole } from "./roles";
import { TOPICS, type Topic, type TopicText } from "./topics";

/**
 * The built-in assistant. It answers from the hand-written knowledge base in `topics.ts`: no network,
 * no model. It finds the best topic for the role and language, and says plainly when it has no answer.
 * It never changes data, never diagnoses and never clears anyone.
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type Lang = "en" | "he";
export const MAX_MESSAGE_CHARS = 3000;
export const MAX_HISTORY = 20;

/** Keeps the last turns, trims them, drops anything malformed; empty unless the history ends with the user. */
export function cleanHistory(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  const msgs = input
    .filter((m): m is ChatMessage => Boolean(m) && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_CHARS) }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_HISTORY);
  return msgs[msgs.length - 1]?.role === "user" ? msgs : [];
}

/** Lowercase, no Hebrew vowel marks, punctuation turned into spaces so "acute:chronic" and "acute chronic" match. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const isHebrew = (s: string) => /[֐-׿]/.test(s);
const textOf = (t: Topic, lang: Lang): TopicText => t[lang];

/** Longer phrases count more than single words. */
const weight = (key: string) => Math.pow(key.split(" ").length, 1.5);

const INDEX = TOPICS.map((topic) => ({
  topic,
  keys: [...topic.en.keys, ...topic.he.keys].map(normalize).filter(Boolean).map((k) => ({ k, w: weight(k), he: isHebrew(k) })),
}));

function score(padded: string, keys: { k: string; w: number; he: boolean }[]): number {
  let s = 0;
  for (const { k, w, he } of keys) {
    // Latin keys must start at a word boundary ("eat" must not match "great"); Hebrew attaches prefixes, so substring.
    if (he ? padded.includes(k) : padded.includes(` ${k}`)) s += w;
  }
  return s;
}

/** Topics for a role, best match first. */
export function rank(question: string, role: AssistantRole): { topic: Topic; score: number }[] {
  const padded = ` ${normalize(question)} `;
  return INDEX
    .filter(({ topic }) => topic.roles.includes(role))
    .map(({ topic, keys }) => ({ topic, score: score(padded, keys) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

export const topicsFor = (role: AssistantRole) => TOPICS.filter((t) => t.roles.includes(role));

const COPY: Record<Lang, { boundary: string; footer: string; related: string; fallback: string; canHelp: string; hello: string; thanks: string; help: string; start: string }> = {
  en: {
    boundary: "I cannot diagnose or clear anyone to play. That is a decision for qualified medical staff, based on an examination and agreed criteria.",
    footer: "_General information, not medical advice. A qualified professional decides on diagnosis, treatment and return to play._",
    related: "You could also ask about:",
    fallback: "I don't have a good answer to that yet. I answer from a fixed set of topics for your role.",
    canHelp: "I can help with:",
    hello: "Hello! I'm the built-in assistant. Ask a question in your own words, or pick a topic below.",
    thanks: "You're welcome. Ask anything else whenever you like.",
    help: "I answer from a library of topics written for your role, and I can point you to the right part of the app.",
    start: "Topics for your role:",
  },
  he: {
    boundary: "אני לא יכול לאבחן ולא לאשר לאיש לחזור לשחק. זו החלטה של צוות רפואי מוסמך, על סמך בדיקה וקריטריונים מוסכמים.",
    footer: "_מידע כללי, לא ייעוץ רפואי. איש מקצוע מוסמך מחליט על אבחון, טיפול וחזרה למשחק._",
    related: "אפשר לשאול גם על:",
    fallback: "עדיין אין לי תשובה טובה לשאלה הזו. אני עונה מתוך קבוצת נושאים קבועה שמתאימה לתפקיד שלכם.",
    canHelp: "אפשר לעזור בנושאים:",
    hello: "שלום! אני העוזר המובנה. שאלו בחופשיות או בחרו נושא מהרשימה.",
    thanks: "בבקשה. אפשר לשאול עוד בכל עת.",
    help: "אני עונה מתוך ספריית נושאים שנכתבה לתפקיד שלכם, ויכול להפנות לחלק הנכון באפליקציה.",
    start: "נושאים לתפקיד שלכם:",
  },
};

/** Requests to diagnose, prescribe or clear someone: answered with a clear boundary, then general guidance. */
const BOUNDARY = /\b(diagnos\w*|clear (him|her|them|me|a player|the player|my player)|cleared to play|safe to play|ok(ay)? to play|fit to play|is it (a )?(tear|fracture|broken|rupture)|prescribe)\b|לאבחן|תאבחן|אבחון|לאשר (לו|לה|להם|לי|לשחקן) (לשחק|לחזור)|מותר (לו|לה|לי) לשחק|כשיר לשחק|בטוח לשחק|האם זה קרע|שבר/;

const GREETING = /^(hi|hello|hey|good (morning|evening|afternoon)|שלום|היי|הי|בוקר טוב|ערב טוב)\b/;
const THANKS = /^(thanks|thank you|thx|תודה|תודה רבה)\b/;
const HELP = /\b(help|what can you do|what can i ask|topics|menu)\b|(?:^|\s)(עזרה|מה אתה יכול|מה אפשר לשאול|נושאים|תפריט)/;

const bullets = (topics: Topic[], lang: Lang, limit = 8) => topics.slice(0, limit).map((t) => `- ${textOf(t, lang).title}`);

/** The answer for one question. `lang` is the account language; the question may be in either language. */
export function answer(question: string, role: AssistantRole, lang: Lang): { text: string; topicId: string | null } {
  const c = COPY[lang];
  const q = normalize(question);
  const mine = topicsFor(role);

  if (THANKS.test(q)) return { text: c.thanks, topicId: null };
  const hits = rank(question, role);
  if (hits.length === 0 && BOUNDARY.test(question.toLowerCase())) {
    return { text: [c.boundary, "", c.canHelp, ...bullets(mine, lang)].join("\n"), topicId: null };
  }
  if (hits.length === 0) {
    if (GREETING.test(q)) return { text: [c.hello, "", c.start, ...bullets(mine, lang)].join("\n"), topicId: null };
    if (HELP.test(q)) return { text: [c.help, "", c.start, ...bullets(mine, lang, 12)].join("\n"), topicId: null };
    return { text: [c.fallback, "", c.canHelp, ...bullets(mine, lang)].join("\n"), topicId: null };
  }

  const boundary = BOUNDARY.test(question.toLowerCase()) ? [c.boundary, ""] : [];
  const best = hits[0].topic;
  const t = textOf(best, lang);
  const alsoTopics = hits.slice(1, 3).map((h) => h.topic);
  const also = alsoTopics.length ? ["", c.related, ...bullets(alsoTopics, lang)] : [];
  return { text: [...boundary, `**${t.title}**`, "", ...t.body, ...also, "", c.footer].join("\n"), topicId: best.id };
}

export { assistantRole };
