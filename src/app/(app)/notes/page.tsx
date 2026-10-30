import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { Avatar } from "@/components/ui";
import { getMyAthleteId, requireSection } from "@/lib/auth";

export const metadata = { title: "Coach Notes" };

/** Every note a coach has shared with the athlete, newest first. Private staff notes are never selected. */
export default async function NotesPage() {
  const { supabase, profile, t } = await requireSection("notes");
  const tn = t.notesPage;
  const athleteId = await getMyAthleteId();
  const header = <PageHeader title={tn.title} subtitle={tn.subtitle} />;
  if (!athleteId) return <>{header}<EmptyState title={t.dashboard.notConnected} action={<ButtonLink href="/connect">{t.dashboard.connectCta}</ButtonLink>} /></>;

  const { data: notes } = await supabase
    .from("athlete_notes")
    .select("id, body, created_at, author_id")
    .eq("athlete_id", athleteId)
    .eq("shared_with_athlete", true)
    .order("created_at", { ascending: false })
    .limit(200);
  const authorIds = [...new Set((notes ?? []).map((n) => n.author_id as string))];
  const { data: authors } = authorIds.length ? await supabase.from("profiles").select("id, full_name").in("id", authorIds) : { data: [] };
  const nameOf = new Map((authors ?? []).map((a) => [a.id as string, a.full_name as string]));

  return (
    <>
      {header}
      {(notes ?? []).length === 0 ? <EmptyState title={tn.empty} body={tn.emptyHelp} /> : (
        <ol className="space-y-3">
          {(notes ?? []).map((n) => {
            const name = nameOf.get(n.author_id as string) || tn.coach;
            return (
              <li key={n.id} className="flex gap-3 rounded-[22px] bg-surface/90 p-4 shadow-[var(--shadow-card)] ring-1 ring-line/60" data-testid="coach-note">
                <Avatar name={name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-ink"><bdi>{tn.from.replace("{name}", name)}</bdi></span>
                    <time className="num text-xs text-muted" dateTime={n.created_at as string}>{new Date(n.created_at as string).toLocaleDateString(profile.locale)}</time>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-ink"><bdi>{n.body}</bdi></p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
