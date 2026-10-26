/** Rules for uploaded files. The database enforces the same list; this gives friendly errors first. */

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp", "gif", "csv", "txt", "doc", "docx", "xls", "xlsx", "ppt", "pptx"] as const;

export const ATTACHMENT_KINDS = ["message", "injury", "gps", "test", "athlete", "training"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const isAttachmentKind = (v: string | null | undefined): v is AttachmentKind => (ATTACHMENT_KINDS as readonly string[]).includes(v ?? "");

export type FileProblem = "empty" | "too_big" | "bad_type" | "content_mismatch";

/** Checks a chosen file by size and extension. Returns null when it may be uploaded. */
export function fileProblem(name: string, size: number): FileProblem | null {
  if (size <= 0) return "empty";
  if (size > MAX_FILE_BYTES) return "too_big";
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ext && (ALLOWED_EXTENSIONS as readonly string[]).includes(ext) ? null : "bad_type";
}

/** "1.2 MB", "340 KB", "820 B". */
export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${Math.round((n / (1024 * 1024)) * 10) / 10} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/** Postgres bytea hex input for a byte buffer. */
export const toByteaHex = (bytes: Uint8Array) => `\\x${Buffer.from(bytes).toString("hex")}`;

/** Bytes from the hex string PostgREST returns for a bytea column. */
export const fromByteaHex = (hex: string) => Buffer.from(hex.replace(/^\\x/, ""), "hex");

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/** What the first bytes of a file must look like for each extension. Text types are checked separately. */
const SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  pdf: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]),
  png: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]),
  jpg: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  jpeg: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  gif: (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]),
  webp: (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8),
  docx: (b) => startsWith(b, ZIP),
  xlsx: (b) => startsWith(b, ZIP),
  pptx: (b) => startsWith(b, ZIP),
  doc: (b) => startsWith(b, OLE),
  xls: (b) => startsWith(b, OLE),
  ppt: (b) => startsWith(b, OLE),
};

/** Program signatures that are never accepted, whatever the file is called: Windows/DOS (MZ), ELF, Mach-O, shell scripts. */
const PROGRAMS: number[][] = [[0x4d, 0x5a], [0x7f, 0x45, 0x4c, 0x46], [0xcf, 0xfa, 0xed, 0xfe], [0xfe, 0xed, 0xfa, 0xce], [0x23, 0x21]];

/**
 * Checks the content against the name: the first bytes must match the extension, text files must be text, and
 * executables are refused even when renamed. This is a plausibility check, not a virus scan.
 */
export function contentProblem(name: string, bytes: Uint8Array): FileProblem | null {
  if (PROGRAMS.some((sig) => startsWith(bytes, sig))) return "content_mismatch";
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const check = SIGNATURES[ext];
  if (check) return check(bytes) ? null : "content_mismatch";
  if (ext === "csv" || ext === "txt") return bytes.subarray(0, 4096).includes(0) ? "content_mismatch" : null;
  return null;
}
