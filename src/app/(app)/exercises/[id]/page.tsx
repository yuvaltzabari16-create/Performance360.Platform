import { Icon } from "@/components/ui/Icon";
import { notFound } from "next/navigation";
import { ExternalLink } from "@/components/legal/ExternalLink";
import { ExercisePlayer } from "@/components/exercises/ExercisePlayer";
import { Badge, ButtonLink, Card, DefinitionList, FlashMessage, PageHeader } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { requireProfile } from "@/lib/auth";
import { embedUrl, type ExerciseCategory, youtubeInfo } from "@/lib/catalog";
import { isUuid } from "@/lib/forms";
import type { Exercise } from "@/lib/types";
import { archiveExercise, duplicateExercise, toggleFavorite } from "../actions";

export default async function ExercisePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, profile, t } = await requireProfile();
  if (!isUuid(id)) notFound();
  const { data } = await supabase.from("exercises").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const e = data as Exercise;
  const te = t.exercises;
  const isOwner = e.owner_id === user.id;
  const isPro = profile.role !== "athlete";
  const { data: fav } = await supabase.from("exercise_favorites").select("exercise_id").eq("exercise_id", id).eq("user_id", user.id).maybeSingle();
  const media = embedUrl(e.video_url, { learn: true });
  // Only verified HTTPS YouTube links are rendered as links (source is free text).
  const explainerUrl = e.source?.match(/^Detailed explanation: (\S+)$/)?.[1] ?? null;
  const explainer = explainerUrl && youtubeInfo(explainerUrl) ? explainerUrl : null;

  return (
    <>
      <PageHeader
        title={e.name}
        crumbs={[{ href: "/exercises", label: te.title }]}
        actions={
          <>
            <form action={toggleFavorite}>
              <input type="hidden" name="id" value={e.id} />
              <SubmitButton variant="secondary"><span className="inline-flex items-center gap-1.5"><Icon name="star" filled={Boolean(fav)} />{fav ? te.unfavorite : te.favorite}</span></SubmitButton>
            </form>
            {isPro && !isOwner && (
              <form action={duplicateExercise}>
                <input type="hidden" name="id" value={e.id} />
                <SubmitButton variant="secondary">{te.duplicate}</SubmitButton>
              </form>
            )}
            {isOwner && <ButtonLink variant="secondary" href={`/exercises/${e.id}/edit`}>{t.common.edit}</ButtonLink>}
            {isOwner && (
              <form action={archiveExercise}>
                <input type="hidden" name="id" value={e.id} />
                <ConfirmSubmit variant="danger" message={`${t.common.archive}?`}>{t.common.archive}</ConfirmSubmit>
              </form>
            )}
          </>
        }
      />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="green">{te.categories[e.category as ExerciseCategory]}</Badge>
        <Badge>{te.difficulties[e.difficulty]}</Badge>
        {e.owner_id ? <Badge tone="blue">{te.custom}</Badge> : <Badge>{te.system}</Badge>}
        {e.tags.map((tag) => <Badge key={tag}>#{tag}</Badge>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            {media?.kind === "iframe" ? (
              <>
                <ExercisePlayer
                  src={media.src}
                  title={e.name}
                  vertical={media.vertical}
                  speedControl={media.src.includes("youtube-nocookie.com")}
                  labels={{ speed: te.speed, normal: te.speedNormal, restart: te.restart, speedHelp: te.speedHelp }}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>{te.embedNote}</span>
                  <ExternalLink href={e.video_url} className="font-medium text-brand-700 hover:underline">{te.openOnYouTube} <Icon name="external" className="size-3.5" /></ExternalLink>
                </div>
              </>
            ) : media?.kind === "video" ? (
              <video src={media.src} controls preload="metadata" playsInline className="aspect-video w-full rounded-lg bg-black" poster={e.thumbnail_url ?? undefined} />
            ) : media?.kind === "link" ? (
              <ExternalLink href={media.src} className="text-sm text-brand-700 hover:underline">{te.video} <Icon name="external" className="size-3.5" /></ExternalLink>
            ) : (
              <p className="text-sm text-muted">{te.noVideo}</p>
            )}
            {e.description && <p className="mt-4 whitespace-pre-line text-sm leading-6 text-ink">{e.description}</p>}
          </Card>
          <Card title={te.cues}>
            {e.coaching_cues.length ? (
              <ol className="space-y-3 text-sm" data-testid="exercise-steps">
                {e.coaching_cues.map((c, n) => (
                  <li key={c} className="flex items-start gap-3">
                    <span className="num mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-gradient-to-b from-brand-500 to-brand-600 text-xs font-bold text-white">{n + 1}</span>
                    <span className="leading-6"><bdi>{c}</bdi></span>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-muted">—</p>}
          </Card>
          <Card title={te.errors}>
            {e.common_errors.length ? (
              <ul className="space-y-2 text-sm">
                {e.common_errors.map((c) => (
                  <li key={c} className="flex items-start gap-3 rounded-xl bg-red-50/70 px-3 py-2">
                    <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-red-500 text-xs font-bold text-white">!</span>
                    <span className="leading-6"><bdi>{c}</bdi></span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">—</p>}
          </Card>
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <DefinitionList
              items={[
                [te.objective, e.primary_objective],
                [te.pattern, e.movement_pattern],
                [te.muscles, e.primary_muscles.join(", ") || null],
                [te.equipment, e.equipment.join(", ") || null],
                [te.prescription, e.suggested_prescription],
                [te.regressions, e.regressions],
                [te.progressions, e.progressions],
                [te.modNotes, e.modification_notes],
                [te.source, explainer ? <ExternalLink key="src" className="text-brand-700 hover:underline" href={explainer}>{te.openOnYouTube} <Icon name="external" className="size-3.5" /></ExternalLink> : e.source],
              ]}
            />
          </Card>
          {!e.owner_id && isPro && <p className="text-xs text-muted">{te.readOnly}</p>}
        </div>
      </div>
    </>
  );
}
