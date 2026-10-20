import Link from "next/link";
import { Badge, ButtonLink, EmptyState, FlashMessage, Input, PageHeader, Select } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { EXERCISE_CATEGORIES, type ExerciseCategory } from "@/lib/catalog";
import type { Exercise } from "@/lib/types";

export const metadata = { title: "Exercise Library" };
const PAGE_SIZE = 60;

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user, profile, t } = await requireProfile();
  const te = t.exercises;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const category = EXERCISE_CATEGORIES.includes(sp.category as ExerciseCategory) ? (sp.category as ExerciseCategory) : "";
  const equipment = (sp.equipment ?? "").trim().toLowerCase().slice(0, 40);
  const scope = ["mine", "system", "favorites"].includes(sp.scope ?? "") ? sp.scope! : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const { data: favRows } = await supabase.from("exercise_favorites").select("exercise_id").eq("user_id", user.id);
  const favorites = new Set((favRows ?? []).map((f) => f.exercise_id as string));

  let query = supabase
    .from("exercises")
    .select("id, owner_id, name, category, difficulty, equipment, primary_objective, thumbnail_url, video_url", { count: "exact" })
    .eq("archived", false)
    .order("name");
  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "")}%`);
  if (category) query = query.eq("category", category);
  if (equipment) query = query.contains("equipment", [equipment]);
  if (scope === "mine") query = query.eq("owner_id", user.id);
  if (scope === "system") query = query.is("owner_id", null);
  if (scope === "favorites") query = query.in("id", favorites.size ? [...favorites] : ["00000000-0000-0000-0000-000000000000"]);
  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const exercises = (data ?? []) as Pick<Exercise, "id" | "owner_id" | "name" | "category" | "difficulty" | "equipment" | "primary_objective" | "thumbnail_url" | "video_url">[];
  const total = count ?? 0;

  const qs = (p: number) => {
    const params = new URLSearchParams({ q, category, equipment, scope, page: String(p) });
    [...params.keys()].forEach((k) => !params.get(k) && params.delete(k));
    return `/exercises?${params}`;
  };

  return (
    <>
      <PageHeader title={te.title} actions={profile.role !== "athlete" && <ButtonLink href="/exercises/new">{te.add}</ButtonLink>} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <form action="/exercises" className="mb-5 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <Input name="q" defaultValue={q} placeholder={te.searchPlaceholder} aria-label={t.common.search} />
        <Select name="category" defaultValue={category} aria-label={te.category}>
          <option value="">{te.category}: {t.common.all}</option>
          {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{te.categories[c]}</option>)}
        </Select>
        <Input name="equipment" defaultValue={equipment} placeholder={te.equipment} aria-label={te.equipment} className="sm:w-36" />
        <Select name="scope" defaultValue={scope} aria-label={t.common.filter}>
          <option value="">{t.common.all}</option>
          <option value="system">{te.system}</option>
          {profile.role !== "athlete" && <option value="mine">{te.mine}</option>}
          <option value="favorites">{te.onlyFavorites}</option>
        </Select>
        <button className="rounded-lg border border-line bg-white px-3 text-sm hover:bg-canvas" type="submit">{t.common.filter}</button>
      </form>

      {exercises.length === 0 ? (
        <EmptyState title={te.empty} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {exercises.map((e) => (
            <li key={e.id}>
              <Link href={`/exercises/${e.id}`} className="flex h-full flex-col rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand-300">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-ink"><bdi>{e.name}</bdi></h3>
                  {favorites.has(e.id) && <span className="text-brand-600" aria-label={te.favorites}>★</span>}
                </div>
                {e.primary_objective && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{e.primary_objective}</p>}
                <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                  <Badge tone="green">{te.categories[e.category as ExerciseCategory]}</Badge>
                  <Badge>{te.difficulties[e.difficulty]}</Badge>
                  {e.owner_id && <Badge tone="blue">{te.custom}</Badge>}
                  {e.video_url && <Badge>▶</Badge>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
          <span className="num">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} {t.common.of} {total}</span>
          <div className="flex gap-2">
            {page > 1 && <ButtonLink variant="secondary" href={qs(page - 1)}>‹</ButtonLink>}
            {page * PAGE_SIZE < total && <ButtonLink variant="secondary" href={qs(page + 1)}>›</ButtonLink>}
          </div>
        </div>
      )}
    </>
  );
}
