import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/en";
import he from "@/lib/i18n/he";
import { answer, cleanHistory, normalize, rank, topicsFor } from "./engine";
import { ASSISTANT_ROLES, assistantRole } from "./roles";
import { TOPICS } from "./topics";

describe("assistantRole", () => {
  it("maps logins to the seven roles", () => {
    expect(assistantRole("athlete", null)).toBe("athlete");
    expect(assistantRole("sc_coach", null)).toBe("personal_trainer");
    expect(assistantRole("sc_coach", "director")).toBe("director");
    expect(assistantRole("sc_coach", "assistant_coach")).toBe("team_staff");
  });
});

describe("cleanHistory", () => {
  it("drops malformed turns, trims, and requires a final user turn", () => {
    expect(cleanHistory("x")).toEqual([]);
    expect(cleanHistory([{ role: "user", content: "  hi  " }, { role: "system", content: "x" }, { role: "user", content: 5 }])).toEqual([{ role: "user", content: "hi" }]);
    expect(cleanHistory([{ role: "user", content: "a" }, { role: "assistant", content: "b" }])).toEqual([]);
    expect(cleanHistory(Array.from({ length: 50 }, () => ({ role: "user", content: "q" })))).toHaveLength(20);
  });
});

describe("normalize", () => {
  it("makes punctuation and Hebrew vowel marks irrelevant", () => {
    expect(normalize("Acute:Chronic, ratio?")).toBe("acute chronic ratio");
    expect(normalize("שָׁלוֹם")).toBe("שלום");
  });
});

describe("knowledge base", () => {
  it("has unique ids and complete English and Hebrew cards", () => {
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
    for (const t of TOPICS) {
      for (const lang of ["en", "he"] as const) {
        expect(t[lang].title.length, t.id).toBeGreaterThan(3);
        expect(t[lang].keys.length, t.id).toBeGreaterThan(2);
        expect(t[lang].body.length, t.id).toBeGreaterThan(0);
      }
    }
  });
  it("gives every role a useful set of topics", () => {
    for (const r of ASSISTANT_ROLES) expect(topicsFor(r).length, r).toBeGreaterThanOrEqual(12);
  });
  it("never offers the builder to the director or staff pages to athletes", () => {
    expect(topicsFor("director").some((t) => t.id === "howto-build-workout")).toBe(false);
    expect(topicsFor("athlete").some((t) => t.id === "howto-invite-staff")).toBe(false);
  });
});

describe("starter questions", () => {
  // Every suggested question must reach a real, role-appropriate answer in both languages.
  for (const lang of ["en", "he"] as const) {
    const starters = (lang === "en" ? en : he).assistant.starters as Record<string, string[]>;
    for (const role of ASSISTANT_ROLES) {
      for (const q of starters[role]) {
        it(`${lang} ${role}: ${q.slice(0, 50)}`, () => {
          const r = answer(q, role, lang);
          expect(r.topicId, q).not.toBeNull();
          expect(TOPICS.find((t) => t.id === r.topicId)!.roles).toContain(role);
        });
      }
    }
  }
});

describe("answer", () => {
  it("answers in the account language, whichever language the question uses", () => {
    expect(answer("How do I warm up?", "athlete", "he").text).toContain("חימום");
    expect(answer("איך מתחממים", "athlete", "en").text).toContain("RAMP");
  });
  it("matches Hebrew prefixes", () => {
    expect(answer("מה לגבי השינה שלי", "athlete", "he").topicId).toBe("sleep");
  });
  it("keeps role-scoped answers apart", () => {
    expect(answer("how do I invite a new coach", "director", "en").topicId).toBe("howto-invite-staff");
    expect(answer("how do I invite a new coach", "athlete", "en").topicId).not.toBe("howto-invite-staff");
  });
  it("does not match inside unrelated words", () => {
    expect(rank("great", "athlete").some((h) => h.topic.id === "nutrition-hydration")).toBe(false);
  });
  it("greets, thanks, and says plainly when it has no answer", () => {
    expect(answer("hello", "athlete", "en").text).toContain("built-in assistant");
    expect(answer("thanks", "athlete", "en").text).toContain("welcome");
    const none = answer("zxqv blorp", "head_coach", "en");
    expect(none.topicId).toBeNull();
    expect(none.text).toContain("I don't have a good answer");
  });
  it("ends every topic answer with the safety line and never claims to clear or diagnose", () => {
    for (const t of TOPICS) {
      for (const role of t.roles) {
        const text = answer(t.en.keys[0], role, "en").text;
        expect(text).toContain("not medical advice");
      }
    }
    expect(answer("can you clear him to play", "physiotherapist", "en").text).toContain("cannot diagnose or clear");
  });
});

describe("academy starters", () => {
  it("answers every suggested question from the knowledge base, in both languages", async () => {
    const { getDictionary } = await import("@/lib/i18n");
    const { ASSISTANT_ROLES } = await import("./roles");
    for (const lang of ["en", "he"] as const) {
      const t = getDictionary(lang);
      for (const role of ASSISTANT_ROLES) for (const q of t.assistant.starters[role]) expect(answer(q, role, lang).topicId, `${lang} ${role}: ${q}`).not.toBeNull();
    }
  });
});
