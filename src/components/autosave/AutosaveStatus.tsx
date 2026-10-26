import type { AutosaveStatus as Status } from "@/lib/autosave/useAutosave";

/** Small live status next to an autosaving form ("Saving…", "Saved", "Not saved"). */
export function AutosaveStatus({ status, labels }: { status: Status; labels: { saving: string; saved: string; failed: string } }) {
  const text = status === "saving" ? labels.saving : status === "saved" ? labels.saved : status === "error" ? labels.failed : "";
  const tone = status === "error" ? "text-red-700" : status === "saved" ? "text-brand-700" : "text-muted";
  return <span role="status" aria-live="polite" className={`text-xs ${tone}`}>{text}</span>;
}
