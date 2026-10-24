/** Small CSV reader for wearable exports: quotes, BOM, comma / semicolon / tab separators. */

export interface Csv {
  headers: string[];
  rows: string[][];
}

function detectDelimiter(line: string): string {
  const counts = [",", ";", "\t"].map((d) => [d, line.split(d).length - 1] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts.sort((a, b) => b[1] - a[1])[0][0] : ",";
}

/** Splits CSV text into a header row and data rows. Blank lines are skipped. */
export function parseCsv(input: string): Csv {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field.trim()); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim()); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field.trim());
  if (row.some((v) => v !== "")) rows.push(row);
  const [headers = [], ...data] = rows;
  return { headers, rows: data };
}

/** Lower-case letters and digits only, so "Total Distance (m)" and "total_distance_m" compare equal. */
export const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Index of the first header matching any alias, or -1. */
export function findColumn(headers: string[], aliases: string[]): number {
  const wanted = aliases.map(normalizeHeader);
  // "Total Distance (km)" also matches the alias "total distance": a bracketed unit is ignored.
  return headers.findIndex((h) => wanted.includes(normalizeHeader(h)) || wanted.includes(normalizeHeader(h.replace(/\(.*?\)/g, ""))));
}

/** Parses a number that may use a decimal comma. */
export function toNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
