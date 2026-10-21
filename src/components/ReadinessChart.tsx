import { readinessTone } from "../lib/dates";
import { DayBars } from "./charts";

/** Daily readiness bars (0–100) with 50/70 guide lines. */
export function ReadinessChart({ values, days = 14 }: { values: Record<string, number>; days?: number }) {
  return (
    <DayBars
      values={values}
      days={days}
      max={100}
      guides={[50, 70, 100]}
      label="Readiness"
      color={(v) => {
        const t = readinessTone(v);
        return t === "good" ? "var(--good)" : t === "warn" ? "var(--warn)" : "var(--bad)";
      }}
    />
  );
}

/** Daily sRPE load bars; match days aren't distinguished here, colour is constant. */
export function LoadChart({ values, days = 28 }: { values: Record<string, number>; days?: number }) {
  return <DayBars values={values} days={days} label="Load" color={() => "var(--accent)"} />;
}
