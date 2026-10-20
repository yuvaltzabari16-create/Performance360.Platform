import { notFound } from "next/navigation";
import { FlashMessage, PageHeader } from "@/components/ui";
import { requireProfessional } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import type { Exercise } from "@/lib/types";
import { updateExercise } from "../../actions";
import { ExerciseForm } from "../../ExerciseForm";

export default async function EditExercisePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, t } = await requireProfessional();
  if (!isUuid(id)) notFound();
  const { data } = await supabase.from("exercises").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!data) notFound();
  const e = data as Exercise;
  return (
    <>
      <PageHeader title={`${t.common.edit}: ${e.name}`} crumbs={[{ href: "/exercises", label: t.exercises.title }, { href: `/exercises/${id}`, label: e.name }]} />
      <FlashMessage error={sp.error} />
      <ExerciseForm action={updateExercise} exercise={e} t={t} cancelHref={`/exercises/${id}`} />
    </>
  );
}
