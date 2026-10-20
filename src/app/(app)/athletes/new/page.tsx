import { FlashMessage, PageHeader } from "@/components/ui";
import { requireProfessional } from "@/lib/auth";
import { createAthlete } from "../actions";
import { AthleteForm } from "../AthleteForm";

export const metadata = { title: "Add athlete" };

export default async function NewAthletePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t, profile } = await requireProfessional();
  return (
    <>
      <PageHeader title={t.athletes.add} crumbs={[{ href: "/athletes", label: t.athletes.title }]} />
      <FlashMessage error={sp.error} />
      <AthleteForm action={createAthlete} t={t} units={profile.units} cancelHref="/athletes" />
    </>
  );
}
