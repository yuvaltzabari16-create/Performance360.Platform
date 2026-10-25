import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("defuses spreadsheet formulas", () => {
    for (const bad of ["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\tx"]) expect(csvCell(bad).startsWith("'")).toBe(true);
  });

  it("keeps real negative numbers as numbers", () => {
    expect(csvCell(-4.5)).toBe("-4.5");
  });

  it("handles empty values, arrays and Hebrew", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell([1, 2, 3])).toBe("1 | 2 | 3");
    expect(csvCell("שלום")).toBe("שלום");
  });

  it("writes a BOM, a header row and CRLF line ends", () => {
    const out = toCsv(["a", "b"], [[1, "x,y"]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toBe("﻿a,b\r\n1,\"x,y\"\r\n");
  });
});
