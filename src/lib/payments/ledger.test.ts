import { describe, expect, it } from "vitest";
import { balancesByAthlete, formatMoneyTotals, paymentStatus, summarize, type PaymentRow } from "./ledger";

const row = (p: Partial<PaymentRow>): PaymentRow => ({ id: Math.random().toString(), athlete_id: "a", description: "Fee", amount: 100, currency: "ILS", due_date: "2026-10-01", paid_on: null, method: null, note: null, ...p });
const today = "2026-10-15";

describe("payment ledger", () => {
  it("derives the status from the dates", () => {
    expect(paymentStatus(row({ paid_on: "2026-09-01" }), today)).toBe("paid");
    expect(paymentStatus(row({ due_date: "2026-10-14" }), today)).toBe("overdue");
    expect(paymentStatus(row({ due_date: "2026-10-15" }), today)).toBe("due");
  });
  it("totals outstanding, overdue and collected this month per currency", () => {
    const s = summarize([
      row({ amount: "350.50", due_date: "2026-10-01" }),
      row({ amount: 100, due_date: "2026-11-01" }),
      row({ amount: 50, currency: "USD", due_date: "2026-09-01" }),
      row({ amount: 200, paid_on: "2026-10-02" }),
      row({ amount: 999, paid_on: "2026-09-30" }),
    ], today);
    expect(s.outstanding).toEqual({ ILS: 450.5, USD: 50 });
    expect(s.overdue).toEqual({ ILS: 350.5, USD: 50 });
    expect(s.overdueCount).toBe(2);
    expect(s.unpaidCount).toBe(3);
    expect(s.collectedThisMonth).toEqual({ ILS: 200 });
  });
  it("lists athletes who owe, most overdue first, with their last payment", () => {
    const b = balancesByAthlete([
      row({ athlete_id: "x", due_date: "2026-11-01" }),
      row({ athlete_id: "y", due_date: "2026-09-01" }),
      row({ athlete_id: "y", due_date: "2026-08-01" }),
      row({ athlete_id: "y", paid_on: "2026-07-03" }),
      row({ athlete_id: "z", paid_on: "2026-10-01" }),
    ], today);
    expect(b.map((x) => x.athleteId)).toEqual(["y", "x"]);
    expect(b[0]).toMatchObject({ overdueCount: 2, outstanding: { ILS: 200 }, lastPaid: "2026-07-03" });
  });
  it("formats totals without adding currencies together", () => {
    expect(formatMoneyTotals({}, "en")).toBe("—");
    expect(formatMoneyTotals({ ILS: 10, USD: 5 }, "en")).toMatch(/10.*·.*5/);
  });
});
