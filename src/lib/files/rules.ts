/** Rules for uploaded files. The database enforces the same list; this gives friendly errors first. */

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp", "gif", "csv", "txt", "doc", "docx", "xls", "xlsx", "ppt", "pptx"] as const;

export const ATTACHMENT_KINDS = ["message", "injury", "gps", "test", "athlete", "training"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const isAttachmentKind = (v: string | null | undefined): v is AttachmentKind => (ATTACHMENT_KINDS as readonly string[]).includes(v ?? "");

export type FileProblem = "empty" | "too_big" | "bad_type";

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
