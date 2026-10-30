"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/auth";
import { bool, done, fail, num, oneOf, safeNext, str, uuid } from "@/lib/forms";
import { CURRENCIES, PAYMENT_METHODS } from "@/lib/payments/ledger";

const today = () => new Date().toISOString().slice(0, 10);
const day = (fd: FormData, key: string) => {
  const v = str(fd, key, 10);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};
const backOf = (fd: FormData) => safeNext(str(fd, "back", 300), "/payments");

/** The database checks that the caller is the director and the athlete is on the roster. */
export async function recordPayment(formData: FormData) {
  const { supabase, t } = await requireSection("payments");
  const back = backOf(formData);
  const athlete = uuid(formData, "athlete_id");
  const description = str(formData, "description", 120);
  const amount = num(formData, "amount");
  if (!athlete || !description || amount == null || amount <= 0) fail(back, t.common.required);
  const paid = bool(formData, "paid");
  const { error } = await supabase.rpc("record_payment", {
    p_athlete: athlete, p_description: description, p_amount: amount,
    p_currency: oneOf(formData, "currency", CURRENCIES, "ILS"), p_due: day(formData, "due_date") ?? today(),
    p_paid_on: paid ? day(formData, "paid_on") ?? today() : null,
    p_method: paid ? oneOf(formData, "method", PAYMENT_METHODS, "cash") : null,
    p_note: str(formData, "note", 500),
  });
  if (error) fail(back, t.common.error);
  revalidatePath("/payments");
  done(back, t.payments.saved);
}

export async function chargeRoster(formData: FormData) {
  const { supabase, t } = await requireSection("payments");
  const back = backOf(formData);
  const description = str(formData, "description", 120);
  const amount = num(formData, "amount");
  if (!description || amount == null || amount <= 0) fail(back, t.common.required);
  const { data, error } = await supabase.rpc("charge_roster", {
    p_description: description, p_amount: amount, p_currency: oneOf(formData, "currency", CURRENCIES, "ILS"), p_due: day(formData, "due_date") ?? today(),
  });
  if (error) fail(back, t.common.error);
  revalidatePath("/payments");
  done(back, t.payments.charged.replace("{n}", String(data ?? 0)));
}

/** Marks paid (with date and method) or, with paid=0, back to unpaid. */
export async function setPaid(formData: FormData) {
  const { supabase, t } = await requireSection("payments");
  const back = backOf(formData);
  const id = uuid(formData, "id");
  if (!id) fail(back, t.common.error);
  const paid = str(formData, "paid", 1) !== "0";
  const { error } = await supabase.rpc("set_payment_paid", {
    p_id: id, p_paid_on: paid ? day(formData, "paid_on") ?? today() : null, p_method: paid ? oneOf(formData, "method", PAYMENT_METHODS, "cash") : null,
  });
  if (error) fail(back, t.common.error);
  revalidatePath("/payments");
  done(back, t.payments.updated);
}

export async function deletePayment(formData: FormData) {
  const { supabase, t } = await requireSection("payments");
  const back = backOf(formData);
  const id = uuid(formData, "id");
  if (!id) fail(back, t.common.error);
  const { error } = await supabase.rpc("delete_payment", { p_id: id });
  if (error) fail(back, t.common.error);
  revalidatePath("/payments");
  done(back, t.payments.deleted);
}
