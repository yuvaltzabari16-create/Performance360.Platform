import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, formatBytes, fileProblem, fromByteaHex, toByteaHex } from "./rules";

describe("fileProblem", () => {
  it("accepts documents and images", () => {
    for (const n of ["report.pdf", "SCAN.JPG", "data.csv", "plan.docx", "x.xlsx"]) expect(fileProblem(n, 1000)).toBeNull();
  });
  it("rejects other types, including scripts and svg", () => {
    for (const n of ["run.exe", "page.svg", "a.html", "x.js", "noextension"]) expect(fileProblem(n, 1000)).toBe("bad_type");
  });
  it("rejects empty and oversized files", () => {
    expect(fileProblem("a.pdf", 0)).toBe("empty");
    expect(fileProblem("a.pdf", MAX_FILE_BYTES + 1)).toBe("too_big");
    expect(fileProblem("a.pdf", MAX_FILE_BYTES)).toBeNull();
  });
});

describe("helpers", () => {
  it("formats sizes", () => {
    expect(formatBytes(820)).toBe("820 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
  });
  it("round-trips bytea hex", () => {
    const hex = toByteaHex(new Uint8Array([1, 2, 255]));
    expect(hex).toBe("\\x0102ff");
    expect([...fromByteaHex(hex)]).toEqual([1, 2, 255]);
  });
});
