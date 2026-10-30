import Link from "next/link";
import { BarsChart } from "@/components/charts/BarsChart";
import { ButtonLink, Card, EmptyState, Field, FlashMessage, Input, PageHeader, Select, Stat, Textarea } from "@/components/ui";
import { AutoSubmitSelect, ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { Icon } from "@/components/ui/Icon";
import { getMyAthleteId, requireSection } from "@/lib/auth";
import type { Dictionary } from "@/lib/i18n";
import { isUuid } from "@/lib/forms";
import { MEAL_TYPES, dailySeries, dayTotals, isIsoDay, shiftDay, sortMeals, type MealRow } from "@/lib/nutrition";
import { commentMeal, deleteMeal, logMeal } from "./actions";

export const metadata = { title: "Nutrition" };

const MEAL_COLUMNS = "id, athlete_id, eaten_on, meal_type, description, calories, protein_g, carbs_g, fat_g, water_ml, photo_id, coach_comment, created_at";

/**
 * Athletes log their meals (with an optional photo) and see day totals and the last week; staff pick an athlete
 * they work with, read the same log and comment on meals. Row-level security decides whose meals are visible.
 */
export default async function NutritionPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, profile, t } = await requireSection("nutrition");
  const tn = t.nutrition;
  const isAthlete = profile.role === "athlete";
  const today = new Date().toISOString().slice(0, 10);
  const day = isIsoDay(sp.day) && sp.day <= today ? sp.day : today;

  const myId = isAthlete ? await getMyAthleteId() : null;
  const { data: roster } = isAthlete ? { data: [] } : await supabase.from("athletes").select("id, full_name").eq("status", "active").order("full_name").limit(500);
  const athletes = (roster ?? []) as { id: string; full_name: string }[];
  const athleteId = isAthlete ? myId : isUuid(sp.athlete) && athletes.some((a) => a.id === sp.athlete) ? sp.athlete : null;

  const header = <PageHeader title={tn.title} subtitle={isAthlete ? tn.subtitleAthlete : tn.subtitleStaff} />;
  const picker = !isAthlete && (
    <form action="/nutrition" className="mb-5 max-w-sm">
      <AutoSubmitSelect name="athlete" defaultValue={athleteId ?? ""} aria-label={tn.chooseAthlete}>
        <option value="">{tn.chooseAthlete}</option>
        {athletes.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
      </AutoSubmitSelect>
    </form>
  );

  if (isAthlete && !athleteId) {
    return <>{header}<EmptyState title={tn.notConnected} action={<ButtonLink href="/connect">{t.nav.connect}</ButtonLink>} /></>;
  }

  // Staff without a chosen athlete: the latest meals across the athletes they work with.
  if (!athleteId) {
    const { data: recent } = await supabase.from("meal_logs").select(MEAL_COLUMNS).order("created_at", { ascending: false }).limit(30);
    const nameOf = new Map(athletes.map((a) => [a.id, a.full_name]));
    return (
      <>
        {header}
        <FlashMessage error={sp.error} ok={sp.ok} />
        {picker}
        <Card title={tn.recent}>
          {(recent ?? []).length === 0 ? <p className="text-sm text-muted">{tn.recentEmpty}</p> : (
            <ul className="divide-y divide-line text-sm">
              {((recent ?? []) as (MealRow & { athlete_id: string })[]).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/nutrition?athlete=${m.athlete_id}&day=${m.eaten_on}`} className="font-medium hover:text-brand-700"><bdi>{nameOf.get(m.athlete_id) ?? "—"}</bdi></Link>
                    <div className="truncate text-xs text-muted">{tn.types[m.meal_type]} · <bdi>{m.description}</bdi></div>
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    {m.photo_id && <Icon name="camera" className="size-3.5" aria-label={tn.photoAlt} />}
                    <span className="num whitespace-nowrap">{m.eaten_on}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </>
    );
  }

  const weekStart = shiftDay(day, -6);
  const { data: rows } = await supabase.from("meal_logs").select(MEAL_COLUMNS).eq("athlete_id", athleteId).gte("eaten_on", weekStart).lte("eaten_on", day).order("created_at").limit(500);
  const week = (rows ?? []) as MealRow[];
  const meals = sortMeals(week.filter((m) => m.eaten_on === day));
  const totals = dayTotals(meals);
  const series = dailySeries(week, day);
  const qs = (d: string) => `/nutrition?${new URLSearchParams({ ...(isAthlete ? {} : { athlete: athleteId }), ...(d !== today ? { day: d } : {}) })}`;
  const back = qs(day);

  return (
    <>
      {header}
      <FlashMessage error={sp.error} ok={sp.ok} />
      {picker}

      <nav className="mb-5 flex flex-wrap items-center gap-2" aria-label={tn.dayTotals}>
        <ButtonLink variant="secondary" href={qs(shiftDay(day, -1))} aria-label={tn.previousDay}><Icon name="arrowLeft" className="size-4 rtl:rotate-180" /></ButtonLink>
        <span className="num min-w-28 text-center font-semibold text-ink">{day === today ? tn.today : day}</span>
        {day < today && <ButtonLink variant="secondary" href={qs(shiftDay(day, 1))} aria-label={tn.nextDay}><Icon name="arrowRight" className="size-4 rtl:rotate-180" /></ButtonLink>}
        {day !== today && <ButtonLink variant="ghost" href={qs(today)}>{tn.today}</ButtonLink>}
      </nav>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={tn.mealsCount} value={totals.meals} />
        <Stat label={tn.calories} value={totals.calories} />
        <Stat label={tn.protein} value={totals.protein} />
        <Stat label={tn.carbs} value={totals.carbs} />
        <Stat label={tn.fat} value={totals.fat} />
        <Stat label={tn.water} value={totals.water} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-4">
          {meals.length === 0 ? <EmptyState title={tn.noMeals} /> : meals.map((m) => (
            <MealCard key={m.id} meal={m} t={t} back={back} canEdit={isAthlete} canComment={!isAthlete} />
          ))}
          <Card title={tn.week}>
            <BarsChart data={series} dataKey="calories" label={tn.weekCalories} />
            <p className="mt-2 text-xs text-muted">{tn.weekHelp}</p>
          </Card>
        </div>

        {isAthlete && (
          <Card title={tn.logMeal}>
            <form action={logMeal} className="space-y-3" encType="multipart/form-data">
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="eaten_on" value={day} />
              <Field label={tn.mealType}>
                <Select name="meal_type" defaultValue={defaultMealType()}>{MEAL_TYPES.map((x) => <option key={x} value={x}>{tn.types[x]}</option>)}</Select>
              </Field>
              <Field label={tn.description}><Textarea name="description" required maxLength={1000} placeholder={tn.descriptionPlaceholder} /></Field>
              <Field label={tn.photo} hint={tn.photoHelp}>
                <input name="photo" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="block w-full text-sm text-ink-soft file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700" />
              </Field>
              <fieldset className="space-y-3">
                <legend className="text-xs font-medium uppercase tracking-wide text-muted">{tn.optionalNumbers}</legend>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={tn.calories}><Input name="calories" type="number" inputMode="numeric" min="0" max="10000" /></Field>
                  <Field label={tn.protein}><Input name="protein_g" type="number" inputMode="decimal" min="0" max="1000" step="0.1" /></Field>
                  <Field label={tn.carbs}><Input name="carbs_g" type="number" inputMode="decimal" min="0" max="2000" step="0.1" /></Field>
                  <Field label={tn.fat}><Input name="fat_g" type="number" inputMode="decimal" min="0" max="1000" step="0.1" /></Field>
                  <Field label={tn.water}><Input name="water_ml" type="number" inputMode="numeric" min="0" max="10000" step="50" /></Field>
                </div>
              </fieldset>
              <SubmitButton pendingText={t.common.saving}>{tn.save}</SubmitButton>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}

/** A sensible meal type for the time of day the form is opened (server time). */
function defaultMealType(): (typeof MEAL_TYPES)[number] {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 21 ? "dinner" : "snack";
}

function MealCard({ meal: m, t, back, canEdit, canComment }: { meal: MealRow; t: Dictionary; back: string; canEdit: boolean; canComment: boolean }) {
  const tn = t.nutrition;
  const figures = ([[m.calories, tn.kcal], [m.protein_g, "P"], [m.carbs_g, "C"], [m.fat_g, "F"], [m.water_ml, "ml"]] as const)
    .filter(([v]) => v != null && v !== "")
    .map(([v, unit]) => `${Number(v)} ${unit}`);
  return (
    <article className="flex flex-col gap-4 rounded-[22px] bg-surface/90 p-4 shadow-[var(--shadow-card)] ring-1 ring-line/60 sm:flex-row" data-testid="meal">
      {m.photo_id && (
        <a href={`/files/${m.photo_id}?inline=1`} target="_blank" rel="noopener" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- private, permission-checked file route */}
          <img src={`/files/${m.photo_id}?inline=1`} alt={tn.photoAlt} className="h-32 w-full rounded-xl object-cover sm:w-40" loading="lazy" />
        </a>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">{tn.types[m.meal_type]}</h3>
          {canEdit && (
            <form action={deleteMeal}>
              <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} />
              <ConfirmSubmit message={tn.deleteConfirm} variant="ghost" className="px-2 py-0.5 text-xs text-red-700">{t.common.delete}</ConfirmSubmit>
            </form>
          )}
        </div>
        <p className="mt-1 whitespace-pre-line text-sm text-ink"><bdi>{m.description}</bdi></p>
        {figures.length > 0 && <p className="num mt-2 text-xs text-muted">{figures.map((f, i) => <span key={f}>{i > 0 && " · "}<bdi>{f}</bdi></span>)}</p>}
        {m.coach_comment && !canComment && (
          <p className="mt-3 rounded-xl bg-brand-50/70 px-3 py-2 text-sm text-brand-900"><span className="font-medium">{tn.coachComment}: </span><bdi>{m.coach_comment}</bdi></p>
        )}
        {canComment && (
          <form action={commentMeal} className="mt-3 flex items-end gap-2">
            <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} />
            <label className="min-w-0 flex-1">
              <span className="sr-only">{tn.coachComment}</span>
              <Input name="comment" defaultValue={m.coach_comment ?? ""} maxLength={1000} placeholder={tn.commentPlaceholder} />
            </label>
            <SubmitButton variant="secondary" className="px-3 py-2 text-xs">{tn.addComment}</SubmitButton>
          </form>
        )}
      </div>
    </article>
  );
}
