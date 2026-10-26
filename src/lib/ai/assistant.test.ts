import { describe, expect, it } from "vitest";
import { assistantRole, ASSISTANT_ROLES } from "./assistant-roles";
import { assistantSystemPrompt, cleanHistory, MAX_HISTORY } from "./assistant";

describe("assistantRole", () => {
  it("maps accounts to the seven kinds", () => {
    expect(assistantRole("athlete", null)).toBe("athlete");
    expect(assistantRole("personal_trainer", null)).toBe("personal_trainer");
    expect(assistantRole("org_admin", "director")).toBe("director");
    expect(assistantRole("performance_coach", "head_of_performance")).toBe("head_of_performance");
    expect(assistantRole("physiotherapist", "physiotherapist")).toBe("physiotherapist");
    expect(assistantRole("performance_coach", "assistant_coach")).toBe("team_staff");
    expect(ASSISTANT_ROLES).toHaveLength(7);
  });
});

describe("assistantSystemPrompt", () => {
  it("is specific to the role and lists only the sections it can open", () => {
    const director = assistantSystemPrompt("org_admin", "director", "en");
    expect(director).toContain("club director");
    expect(director).toContain("- gps:");
    expect(director).not.toContain("- training:");
    expect(director).not.toContain("- exercises:");
    const physio = assistantSystemPrompt("physiotherapist", "physiotherapist", "en");
    expect(physio).toContain("- training:");
    expect(physio).toContain("records clearance");
    const athlete = assistantSystemPrompt("athlete", null, "he");
    expect(athlete).toContain("athlete");
    expect(athlete).toContain("Hebrew");
    expect(athlete).not.toContain("- athletes:");
  });
  it("carries the safety rules for everyone", () => {
    for (const [role, org] of [["athlete", null], ["org_admin", "director"], ["personal_trainer", null]] as const) {
      const p = assistantSystemPrompt(role, org, "en");
      expect(p).toContain("Never diagnose");
      expect(p).toContain("do not see this person's athletes");
      expect(p).toContain("emergency services");
    }
  });
});

describe("cleanHistory", () => {
  it("keeps valid turns, trims, and ends with the user", () => {
    const h = cleanHistory([{ role: "assistant", content: "hi" }, { role: "user", content: "  hello  " }, { role: "assistant", content: "ok" }, { role: "user", content: "next" }]);
    expect(h).toEqual([{ role: "user", content: "hello" }, { role: "assistant", content: "ok" }, { role: "user", content: "next" }]);
  });
  it("drops junk, caps length and count", () => {
    expect(cleanHistory("nope")).toEqual([]);
    expect(cleanHistory([{ role: "system", content: "x" }, { role: "user", content: "" }, null, { role: "user", content: 5 }])).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "m" + i }));
    expect(cleanHistory(many).length).toBeLessThanOrEqual(MAX_HISTORY);
    expect(cleanHistory([{ role: "user", content: "x".repeat(9000) }])[0].content).toHaveLength(3000);
  });
  it("merges consecutive turns from the same side and refuses a conversation that ends with the assistant", () => {
    expect(cleanHistory([{ role: "user", content: "a" }, { role: "user", content: "b" }])).toEqual([{ role: "user", content: "a\nb" }]);
    expect(cleanHistory([{ role: "user", content: "a" }, { role: "assistant", content: "b" }])).toEqual([]);
  });

  it("is a consultant with role-specific expertise, honest about evidence and anonymity", () => {
    const hop = assistantSystemPrompt("performance_coach", "head_of_performance", "en");
    expect(hop).toContain("professional consultant");
    expect(hop).toContain("periodization");
    expect(hop).toContain("Do not invent studies");
    expect(hop).toContain("leave out names");
    const physio = assistantSystemPrompt("physiotherapist", "physiotherapist", "en");
    expect(physio).toContain("return-to-sport");
    expect(physio).toContain("makes the decision");
    expect(assistantSystemPrompt("org_admin", "director", "he")).toContain("running a performance department");
    expect(assistantSystemPrompt("athlete", null, "en")).toContain("sleep");
  });
});
