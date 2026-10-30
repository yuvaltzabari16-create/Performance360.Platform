import { fieldDisplay, parseField, FIELD_KEYS, type ExercisePatch } from "@/lib/builder-fields";
import type { Dictionary } from "@/lib/i18n/en";
import type { SessionItem, TrainingSession } from "./model";

export { saveFile as download } from "./platform";

/** The prescription of one item as chip texts, e.g. ["3x8", "RPE 7"]. */
export function itemChips(item: SessionItem, d: Dictionary): string[] {
  const patch: ExercisePatch = {};
  for (const k of FIELD_KEYS) {
    const v = item.values[k];
    if (!v) continue;
    const r = parseField(k, v);
    if (r.ok) Object.assign(patch, r.patch);
  }
  return FIELD_KEYS.map((k) => {
    const shown = fieldDisplay(patch, k);
    return shown ? (k === "reps" ? shown : `${d.training.builder.fields[k]} ${shown}`) : null;
  }).filter((x): x is string => x !== null);
}

export function sessionText(session: TrainingSession, d: Dictionary): string {
  const lines = [session.title, ""];
  let section = "";
  for (const it of session.items) {
    if (it.section !== section) { section = it.section; lines.push(`${d.training.sections[it.section]}:`); }
    const chips = itemChips(it, d);
    lines.push(`- ${it.name}${chips.length ? ` (${chips.join(", ")})` : ""}`);
  }
  return lines.join("\n");
}

export const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const daysSince = (iso: string, now = Date.now()) => Math.floor((now - Date.parse(iso)) / 86_400_000);
