import { FlashMessage, PageHeader } from "@/components/ui";
import { requireProfessional } from "@/lib/auth";
import { createExercise } from "../actions";
import { ExerciseForm } from "../ExerciseForm";

export default async function NewExercisePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t } = await requireProfessional();
  return (
    <>
      <PageHeader title={t.exercises.add} crumbs={[{ href: "/exercises", label: t.exercises.title }]} />
      <FlashMessage error={sp.error} />
      <ExerciseForm action={createExercise} t={t} cancelHref="/exercises" />
    </>
  );
}
