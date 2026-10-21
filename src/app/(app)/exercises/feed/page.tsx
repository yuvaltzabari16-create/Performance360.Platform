import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/ui/client";
import { requireProfile } from "@/lib/auth";
import { EXERCISE_CATEGORIES, type ExerciseCategory } from "@/lib/catalog";
import { VideoFeed, type FeedItem } from "./VideoFeed";

export const metadata = { title: "Video feed" };

export default async function FeedPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user, t } = await requireProfile();
  const te = t.exercises;
  const category = EXERCISE_CATEGORIES.includes(sp.category as ExerciseCategory) ? (sp.category as ExerciseCategory) : "";
  const onlyFav = sp.fav === "1";

  const { data: favRows } = await supabase.from("exercise_favorites").select("exercise_id").eq("user_id", user.id);
  const favorites = new Set((favRows ?? []).map((f) => f.exercise_id as string));

  let q = supabase
    .from("exercises")
    .select("id, name, category, movement_pattern, coaching_cues, equipment, video_url, thumbnail_url")
    .eq("archived", false)
    .not("video_url", "is", null)
    .order("category")
    .order("movement_pattern")
    .order("name")
    .limit(500);
  if (category) q = q.eq("category", category);
  if (onlyFav) q = q.in("id", favorites.size ? [...favorites] : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await q;

  const items: FeedItem[] = (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    categoryLabel: te.categories[e.category as ExerciseCategory] ?? e.category,
    pattern: e.movement_pattern,
    cues: e.coaching_cues ?? [],
    equipment: e.equipment ?? [],
    video_url: e.video_url!,
    thumbnail_url: e.thumbnail_url,
    favorite: favorites.has(e.id),
  }));

  return (
    <>
      <PageHeader title={te.feed} subtitle={`${items.length} ${te.videoCount}`} crumbs={[{ href: "/exercises", label: te.title }]} />
      <form action="/exercises/feed" className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-56">
          <AutoSubmitSelect name="category" defaultValue={category} aria-label={te.category}>
            <option value="">{te.category}: {t.common.all}</option>
            {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{te.categories[c]}</option>)}
          </AutoSubmitSelect>
        </div>
        <Link
          href={`/exercises/feed?${new URLSearchParams({ ...(category ? { category } : {}), ...(onlyFav ? {} : { fav: "1" }) })}`}
          className={`rounded-lg border px-3 py-2 text-sm ${onlyFav ? "border-brand-500 bg-brand-50 text-brand-800" : "border-line bg-white text-ink-soft hover:bg-canvas"}`}
        >
          ★ {te.onlyFavorites}
        </Link>
      </form>
      <VideoFeed
        items={items}
        labels={{ tapToPlay: te.tapToPlay, details: te.details, openOnYouTube: te.openOnYouTube, favorite: te.favorite, unfavorite: te.unfavorite, empty: te.feedEmpty }}
      />
    </>
  );
}
