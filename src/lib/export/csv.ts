/**
 * CSV for spreadsheets (Excel, Numbers, Google Sheets).
 * Cells that start with = + - @ or a control character are prefixed with an apostrophe so a spreadsheet
 * never runs them as a formula (CSV injection). UTF-8 BOM first so Excel reads Hebrew correctly.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = Array.isArray(value) ? value.join(" | ") : typeof value === "object" ? JSON.stringify(value) : String(value);
  // A plain negative number is a number, not a formula.
  if (FORMULA_START.test(text) && !(typeof value === "number" && Number.isFinite(value))) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
