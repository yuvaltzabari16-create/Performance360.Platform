import type { Units } from "./types";

// Values are stored in metric; these helpers convert for display and input.
const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export function displayMass(kg: number | null, units: Units): string {
  if (kg == null) return "—";
  return units === "imperial" ? `${round(kg / KG_PER_LB, 1)} lb` : `${round(kg, 1)} kg`;
}

export function displayHeight(cm: number | null, units: Units): string {
  if (cm == null) return "—";
  if (units === "metric") return `${round(cm, 1)} cm`;
  const totalIn = cm / CM_PER_IN;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return inch === 12 ? `${ft + 1}′0″` : `${ft}′${inch}″`;
}

export function massToKg(value: number, units: Units): number {
  return units === "imperial" ? round(value * KG_PER_LB, 1) : value;
}

export function heightToCm(value: number, units: Units): number {
  return units === "imperial" ? round(value * CM_PER_IN, 1) : value;
}

export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
