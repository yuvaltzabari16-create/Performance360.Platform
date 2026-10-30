/**
 * Academy payment tracking: what each athlete owes and has paid. Status is derived from the row, never stored,
 * so it is always correct for "today": paid when it has a paid date, overdue when unpaid after its due date.
 */

export const CURRENCIES = ["ILS", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const PAYMENT_METHODS = ["cash", "bank_transfer", "card", "app", "cheque", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = "paid" | "overdue" | "due";

export interface PaymentRow {
  id: string;
  athlete_id: string;
  description: string;
  amount: number | string;
  currency: Currency;
  due_date: string;
  paid_on: string | null;
  method: PaymentMethod | null;
  note: string | null;
}

export function paymentStatus(p: Pick<PaymentRow, "paid_on" | "due_date">, today: string): PaymentStatus {
  if (p.paid_on) return "paid";
  return p.due_date < today ? "overdue" : "due";
}

/** Amounts per currency, so mixed currencies are never added together. */
export type Money = Partial<Record<Currency, number>>;

const add = (m: Money, currency: Currency, amount: number): Money => ({ ...m, [currency]: Math.round(((m[currency] ?? 0) + amount) * 100) / 100 });

export interface LedgerSummary {
  outstanding: Money;
  overdue: Money;
  overdueCount: number;
  collectedThisMonth: Money;
  unpaidCount: number;
}

/** Totals for the payments page: what is still owed, what is late, and what came in this calendar month. */
export function summarize(rows: PaymentRow[], today: string): LedgerSummary {
  const month = today.slice(0, 7);
  return rows.reduce<LedgerSummary>((s, p) => {
    const amount = Number(p.amount);
    const status = paymentStatus(p, today);
    if (status === "paid") return p.paid_on!.slice(0, 7) === month ? { ...s, collectedThisMonth: add(s.collectedThisMonth, p.currency, amount) } : s;
    const next = { ...s, outstanding: add(s.outstanding, p.currency, amount), unpaidCount: s.unpaidCount + 1 };
    return status === "overdue" ? { ...next, overdue: add(next.overdue, p.currency, amount), overdueCount: next.overdueCount + 1 } : next;
  }, { outstanding: {}, overdue: {}, overdueCount: 0, collectedThisMonth: {}, unpaidCount: 0 });
}

export interface AthleteBalance {
  athleteId: string;
  outstanding: Money;
  overdue: Money;
  overdueCount: number;
  lastPaid: string | null;
}

/** One line per athlete with something owed, most overdue first. */
export function balancesByAthlete(rows: PaymentRow[], today: string): AthleteBalance[] {
  const map = new Map<string, AthleteBalance>();
  for (const p of rows) {
    const b = map.get(p.athlete_id) ?? { athleteId: p.athlete_id, outstanding: {}, overdue: {}, overdueCount: 0, lastPaid: null };
    const status = paymentStatus(p, today);
    if (status === "paid") b.lastPaid = !b.lastPaid || p.paid_on! > b.lastPaid ? p.paid_on : b.lastPaid;
    else {
      b.outstanding = add(b.outstanding, p.currency, Number(p.amount));
      if (status === "overdue") { b.overdue = add(b.overdue, p.currency, Number(p.amount)); b.overdueCount += 1; }
    }
    map.set(p.athlete_id, b);
  }
  return [...map.values()]
    .filter((b) => Object.keys(b.outstanding).length > 0)
    .sort((a, b) => b.overdueCount - a.overdueCount || a.athleteId.localeCompare(b.athleteId));
}

export function formatMoney(amount: number, currency: Currency, locale: string): string {
  return new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

/** "₪700.00 · $50.00", or a dash when nothing. */
export function formatMoneyTotals(m: Money, locale: string): string {
  const parts = CURRENCIES.filter((c) => m[c]).map((c) => formatMoney(m[c]!, c, locale));
  return parts.length ? parts.join(" · ") : "—";
}
