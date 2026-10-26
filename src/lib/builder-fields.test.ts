import { describe, expect, it } from "vitest";
import { fieldDisplay, filledFields, parseField } from "./builder-fields";

describe("builder fields", () => {
  it("parses sets x reps", () => {
    expect(parseField("reps", "3x4")).toEqual({ ok: true, patch: { sets: 3, reps: "4" } });
    expect(parseField("reps", "4 × 8-10")).toEqual({ ok: true, patch: { sets: 4, reps: "8-10" } });
    expect(parseField("reps", "AMRAP")).toEqual({ ok: true, patch: { reps: "AMRAP" } });
    expect(parseField("reps", "")).toEqual({ ok: true, patch: { sets: null, reps: null } });
    expect(parseField("reps", "99x5").ok).toBe(false);
  });

  it("parses times as seconds", () => {
    expect(parseField("rest", "90")).toEqual({ ok: true, patch: { rest_s: 90 } });
    expect(parseField("rest", "90s")).toEqual({ ok: true, patch: { rest_s: 90 } });
    expect(parseField("rest", "1:30")).toEqual({ ok: true, patch: { rest_s: 90 } });
    expect(parseField("duration", "2min")).toEqual({ ok: true, patch: { duration_s: 120 } });
    expect(parseField("rest", "abc").ok).toBe(false);
  });

  it("validates ranges and rounds", () => {
    expect(parseField("rpe", "8.3")).toEqual({ ok: true, patch: { rpe: 8.5 } });
    expect(parseField("rpe", "11").ok).toBe(false);
    expect(parseField("rir", "2.4")).toEqual({ ok: true, patch: { rir: 2 } });
    expect(parseField("load", "60kg")).toEqual({ ok: true, patch: { load_kg: 60 } });
    expect(parseField("pct1rm", "85%")).toEqual({ ok: true, patch: { percent_1rm: 85 } });
    expect(parseField("load", "-5").ok).toBe(false);
  });

  it("displays chips and lists filled fields", () => {
    const e = { sets: 3, reps: "4", rest_s: 90, rpe: 8, load_kg: null };
    expect(fieldDisplay(e, "reps")).toBe("3x4");
    expect(fieldDisplay(e, "rest")).toBe("90s");
    expect(fieldDisplay(e, "load")).toBeNull();
    expect(filledFields(e)).toEqual(["reps", "rpe", "rest"]);
  });
});
