import { notFound } from "next/navigation";
import { FlashMessage, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import type { Athlete } from "@/lib/types";
import { updateAthlete } from "../../actions";
import { AthleteForm } from "../../AthleteForm";

export default async function EditAthletePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, t, profile } = await requireProfile();
  if (!isUuid(id)) notFound();
  const { data } = await supabase.from("athletes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const athlete = data as Athlete;
  return (
    <>
      <PageHeader title={`${t.athletes.editProfile}: ${athlete.full_name}`} crumbs={profile.role === "athlete" ? [] : [{ href: "/athletes", label: t.athletes.title }, { href: `/athletes/${id}`, label: athlete.full_name }]} />
      <FlashMessage error={sp.error} />
      <AthleteForm action={updateAthlete} athlete={athlete} t={t} units={profile.units} cancelHref={`/athletes/${id}`} />
    </>
  );
}
