import { describe, expect, it } from "vitest";
import { composeMail, safeLink } from "./compose";

const item = { email: "a@example.com", full_name: "Dana Cohen", locale: "en", title: "New plan <b>", body: "Check \"it\"", link: "/training/1" };

describe("composeMail", () => {
  it("escapes the title and body", () => {
    const m = composeMail(item, "https://app.example.com/");
    expect(m.html).toContain("New plan &lt;b&gt;");
    expect(m.html).toContain("Check &quot;it&quot;");
    expect(m.html).not.toContain("<b>New plan <b>");
  });
  it("links only inside the app", () => {
    expect(composeMail(item, "https://app.example.com/").html).toContain('href="https://app.example.com/training/1"');
    expect(safeLink("https://x.com", "//evil.com")).toBeNull();
    expect(safeLink("https://x.com", "https://evil.com")).toBeNull();
    expect(safeLink("https://x.com", "javascript:alert(1)")).toBeNull();
    expect(safeLink("https://x.com", null)).toBeNull();
  });
  it("writes Hebrew right to left", () => {
    const m = composeMail({ ...item, locale: "he" }, "https://x.com");
    expect(m.dir).toBe("rtl");
    expect(m.html).toContain('dir="rtl"');
    expect(m.text).toContain("שלום Dana");
  });
});
