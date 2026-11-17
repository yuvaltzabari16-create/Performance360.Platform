import { describe, expect, it } from "vitest";
import { entryToRestore, failedSubmission, keepable, MAX_AGE_MS, pickFields } from "./form-memory";

describe("form memory", () => {
  it("never keeps passwords, codes, hidden fields or files", () => {
    expect(keepable({ name: "password", type: "password" })).toBe(false);
    expect(keepable({ name: "new_password", type: "text" })).toBe(false);
    expect(keepable({ name: "token", type: "text" })).toBe(false);
    expect(keepable({ name: "invite_code", type: "text" })).toBe(false);
    expect(keepable({ name: "next", type: "hidden" })).toBe(false);
    expect(keepable({ name: "attachment", type: "file" })).toBe(false);
    expect(keepable({ name: "notes", type: "text", dataset: { noMemory: "" } })).toBe(false);
    expect(keepable({ name: "", type: "text" })).toBe(false);
  });

  it("keeps ordinary fields, with checkbox state", () => {
    const fields = pickFields([
      { name: "full_name", type: "text", value: "Noa" },
      { name: "password", type: "password", value: "secret123" },
      { name: "accept_terms", type: "checkbox", value: "on", checked: true },
    ]);
    expect(fields).toEqual([
      { name: "full_name", type: "text", value: "Noa" },
      { name: "accept_terms", type: "checkbox", value: "on", checked: true },
    ]);
  });

  it("restores only after a failed submission on the same page, while fresh", () => {
    const now = 1_000_000;
    const raw = JSON.stringify({ path: "/signup", form: 0, fields: [{ name: "email", type: "email", value: "a@b.co" }], at: now - 1000 });
    expect(failedSubmission("?error=Required")).toBe(true);
    expect(entryToRestore(raw, "/signup", "?error=Required", now)?.fields[0].value).toBe("a@b.co");
    expect(entryToRestore(raw, "/signup", "?ok=saved", now)).toBeNull();
    expect(entryToRestore(raw, "/login", "?error=x", now)).toBeNull();
    expect(entryToRestore(raw, "/signup", "?error=x", now + MAX_AGE_MS + 1)).toBeNull();
    expect(entryToRestore("{not json", "/signup", "?error=x", now)).toBeNull();
  });
});
