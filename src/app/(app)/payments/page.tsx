import { Badge, ButtonLink, Card, Checkbox, EmptyState, Field, FlashMessage, Input, PageHeader, Select, Stat, Table, Td } from "@/components/ui";
import { AutoSubmitSelect, ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { requireSection } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { CURRENCIES, PAYMENT_METHODS, balancesByAthlete, formatMoney, formatMoneyTotals, paymentStatus, summarize, type PaymentRow } from "@/lib/payments/ledger";
import { chargeRoster, deletePayment, recordPayment, setPaid } from "./actions";

export const metadata = { title: "Payments" };

const FILTERS = ["all", "unpaid", "overdue", "paid"] as const;
type Filter = (typeof FILTERS)[number];
const TONE = { paid: "green", overdue: "red", due: "amber" } as const;

/** The director's payment tracker: totals, who owes, every charge with paid / unpaid, and forms to add charges. */
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, profile, t } = await requireSection("payments");
  const tp = t.payments;
  const today = new Date().toISOString().slice(0, 10);
  const filter: Filter = (FILTERS as readonly string[]).includes(sp.status ?? "") ? (sp.status as Filter) : "all";
  const athleteFilter = isUuid(sp.athlete) ? sp.athlete : null;
  const query = new URLSearchParams({ ...(filter !== "all" ? { status: filter } : {}), ...(athleteFilter ? { athlete: athleteFilter } : {}) }).toString();
  const back = `/payments${query ? `?${query}` : ""}`;

  const [{ data: roster }, { data: rows }] = await Promise.all([
    supabase.rpc("org_roster"),
    supabase.from("athlete_payments").select("id, athlete_id, description, amount, currency, due_date, paid_on, method, note").order("due_date", { ascending: false }).limit(2000),
  ]);
  const athletes = ((roster ?? []) as { athlete_id: string; full_name: string }[]).slice().sort((a, b) => a.full_name.localeCompare(b.full_name));
  const nameOf = new Map(athletes.map((a) => [a.athlete_id, a.full_name]));
  const payments = (rows ?? []) as PaymentRow[];
  const summary = summarize(payments, today);
  const balances = balancesByAthlete(payments, today);
  const shown = payments.filter((p) => {
    const s = paymentStatus(p, today);
    if (athleteFilter && p.athlete_id !== athleteFilter) return false;
    return filter === "all" || (filter === "unpaid" ? s !== "paid" : s === filter);
  });
  const money = (p: PaymentRow) => formatMoney(Number(p.amount), p.currency, profile.locale);
  const currencyField = (
    <Field label={tp.currency}>
      <Select name="currency" defaultValue="ILS">{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
    </Field>
  );

  return (
    <>
      <PageHeader title={tp.title} subtitle={tp.subtitle} actions={athletes.length > 0 && <ButtonLink href="#record">{tp.record}</ButtonLink>} />
      <FlashMessage error={sp.error} ok={sp.ok} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={tp.outstanding} value={<span className="text-xl">{formatMoneyTotals(summary.outstanding, profile.locale)}</span>} hint={`${summary.unpaidCount} ${tp.unpaid.toLowerCase()}`} />
        <Stat label={tp.overdue} value={<span className="text-xl">{formatMoneyTotals(summary.overdue, profile.locale)}</span>} hint={tp.overdueCount.replace("{n}", String(summary.overdueCount))} />
        <Stat label={tp.collected} value={<span className="text-xl">{formatMoneyTotals(summary.collectedThisMonth, profile.locale)}</span>} />
        <Stat label={tp.balances} value={balances.length} />
      </div>
      <p className="mt-2 text-xs text-muted">{tp.privacy}</p>

      <div className="mt-6 space-y-6">
        <div className="min-w-0 space-y-4">
          <form action="/payments" className="grid gap-2 sm:flex" aria-label={t.common.filter}>
            <div className="sm:w-44">
              <AutoSubmitSelect name="status" defaultValue={filter} aria-label={tp.status}>
                {FILTERS.map((f) => <option key={f} value={f}>{tp.filters[f]}</option>)}
              </AutoSubmitSelect>
            </div>
            <div className="sm:w-64">
              <AutoSubmitSelect name="athlete" defaultValue={athleteFilter ?? ""} aria-label={tp.athlete}>
                <option value="">{tp.allAthletes}</option>
                {athletes.map((a) => <option key={a.athlete_id} value={a.athlete_id}>{a.full_name}</option>)}
              </AutoSubmitSelect>
            </div>
          </form>

          {payments.length === 0 ? (
            <EmptyState title={tp.empty} body={athletes.length ? tp.emptyHelp : tp.rosterEmpty} />
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted">{tp.noMatches}</p>
          ) : (
            <Table head={[tp.athlete, tp.description, tp.amount, tp.dueDate, tp.status, ""]}>
              {shown.map((p) => {
                const status = paymentStatus(p, today);
                return (
                  <tr key={p.id} data-testid="payment-row" data-status={status}>
                    <Td className="whitespace-nowrap"><bdi className="font-medium">{nameOf.get(p.athlete_id) ?? "—"}</bdi></Td>
                    <Td>
                      <bdi>{p.description}</bdi>
                      {p.note && <div className="text-xs text-muted"><bdi>{p.note}</bdi></div>}
                    </Td>
                    <Td className="num whitespace-nowrap font-medium">{money(p)}</Td>
                    <Td className="num whitespace-nowrap">{p.due_date}</Td>
                    <Td>
                      <Badge tone={TONE[status]}>{tp.statuses[status]}</Badge>
                      {p.paid_on && <div className="num mt-1 text-xs text-muted">{p.paid_on}{p.method ? ` · ${tp.methods[p.method]}` : ""}</div>}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        {status === "paid" ? (
                          <form action={setPaid}>
                            <input type="hidden" name="id" value={p.id} /><input type="hidden" name="paid" value="0" /><input type="hidden" name="back" value={back} />
                            <SubmitButton variant="secondary" className="px-2.5 py-1 text-xs">{tp.markUnpaid}</SubmitButton>
                          </form>
                        ) : (
                          <form action={setPaid} className="flex items-center gap-1.5">
                            <input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={back} />
                            <Select name="method" defaultValue="cash" aria-label={tp.method} className="w-auto py-1 text-xs">
                              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{tp.methods[m]}</option>)}
                            </Select>
                            <SubmitButton className="whitespace-nowrap px-2.5 py-1 text-xs">{tp.markPaid}</SubmitButton>
                          </form>
                        )}
                        <form action={deletePayment}>
                          <input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={back} />
                          <ConfirmSubmit message={tp.deleteConfirm} variant="ghost" className="px-2 py-1 text-xs text-red-700">{t.common.delete}</ConfirmSubmit>
                        </form>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          )}

        </div>

        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Card title={tp.balances}>
            {balances.length === 0 ? <p className="text-sm text-muted">{tp.balancesEmpty}</p> : (
              <ul className="divide-y divide-line text-sm">
                {balances.map((b) => (
                  <li key={b.athleteId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <a href={`/payments?status=unpaid&athlete=${b.athleteId}`} className="font-medium hover:text-brand-700"><bdi>{nameOf.get(b.athleteId) ?? "—"}</bdi></a>
                    <span className="flex flex-wrap items-center gap-2">
                      {b.overdueCount > 0 && <Badge tone="red">{tp.overdue}: {formatMoneyTotals(b.overdue, profile.locale)}</Badge>}
                      <span className="num font-medium">{formatMoneyTotals(b.outstanding, profile.locale)}</span>
                      <span className="num text-xs text-muted">{tp.lastPaid}: {b.lastPaid ?? "—"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <div id="record" className="scroll-mt-6"><Card title={tp.record}>
            {athletes.length === 0 ? <p className="text-sm text-muted">{tp.rosterEmpty}</p> : (
              <form action={recordPayment} className="space-y-3">
                <input type="hidden" name="back" value={back} />
                <p className="text-xs text-muted">{tp.recordHelp}</p>
                <Field label={tp.athlete}>
                  <Select name="athlete_id" required defaultValue={athleteFilter ?? ""}>
                    <option value="" disabled>{tp.athlete}</option>
                    {athletes.map((a) => <option key={a.athlete_id} value={a.athlete_id}>{a.full_name}</option>)}
                  </Select>
                </Field>
                <Field label={tp.description}><Input name="description" required maxLength={120} placeholder={tp.descriptionPlaceholder} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={tp.amount}><Input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" required /></Field>
                  {currencyField}
                </div>
                <Field label={tp.dueDate}><Input name="due_date" type="date" defaultValue={today} required /></Field>
                <Checkbox name="paid" label={tp.alreadyPaid} />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Field label={tp.paidOn}><Input name="paid_on" type="date" defaultValue={today} /></Field>
                  <Field label={tp.method}>
                    <Select name="method" defaultValue="cash">{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{tp.methods[m]}</option>)}</Select>
                  </Field>
                </div>
                <Field label={tp.note}><Input name="note" maxLength={500} /></Field>
                <SubmitButton pendingText={t.common.saving}>{tp.record}</SubmitButton>
              </form>
            )}
          </Card></div>

          {athletes.length > 0 && (
            <Card title={tp.chargeRoster}>
              <form action={chargeRoster} className="space-y-3">
                <input type="hidden" name="back" value={back} />
                <p className="text-xs text-muted">{tp.chargeRosterHelp}</p>
                <Field label={tp.description}><Input name="description" required maxLength={120} placeholder={tp.descriptionPlaceholder} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={tp.amount}><Input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" required /></Field>
                  {currencyField}
                </div>
                <Field label={tp.dueDate}><Input name="due_date" type="date" defaultValue={today} required /></Field>
                <ConfirmSubmit message={tp.chargeConfirm} variant="secondary">{tp.chargeRoster} ({athletes.length})</ConfirmSubmit>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
