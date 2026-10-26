import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, contentProblem, formatBytes, fileProblem, fromByteaHex, toByteaHex } from "./rules";

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

describe("contentProblem", () => {
  const bytes = (...v: number[]) => new Uint8Array([...v, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  it("accepts content that matches the extension", () => {
    expect(contentProblem("a.pdf", bytes(0x25, 0x50, 0x44, 0x46))).toBeNull();
    expect(contentProblem("a.png", bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
    expect(contentProblem("a.JPG", bytes(0xff, 0xd8, 0xff))).toBeNull();
    expect(contentProblem("a.xlsx", bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull();
    expect(contentProblem("a.csv", new TextEncoder().encode("a,b\n1,2\n"))).toBeNull();
  });
  it("rejects a file whose content is something else", () => {
    expect(contentProblem("a.pdf", new TextEncoder().encode("<html>"))).toBe("content_mismatch");
    expect(contentProblem("a.png", bytes(0xff, 0xd8, 0xff))).toBe("content_mismatch");
    expect(contentProblem("a.csv", bytes(0x61, 0x00, 0x62))).toBe("content_mismatch");
  });
  it("rejects renamed programs", () => {
    expect(contentProblem("holiday.pdf", bytes(0x4d, 0x5a))).toBe("content_mismatch");
    expect(contentProblem("notes.txt", new TextEncoder().encode("#!/bin/sh\nrm -rf /"))).toBe("content_mismatch");
    expect(contentProblem("x.png", bytes(0x7f, 0x45, 0x4c, 0x46))).toBe("content_mismatch");
  });
});
