import { FlashMessage } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { AthleteDashboard } from "./AthleteDashboard";
import { CoachDashboard } from "./CoachDashboard";
import { DirectorDashboard } from "./DirectorDashboard";

export const metadata = { title: "Dashboard" };

/** Picks the dashboard for the signed-in role. Each one lives in its own file. */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { profile, org, t } = await requireProfile();
  return (
    <>
      <FlashMessage ok={sp.ok} />
      {profile.role === "athlete" ? <AthleteDashboard t={t} /> : org?.org_role === "director" ? <DirectorDashboard t={t} /> : <CoachDashboard t={t} />}
    </>
  );
}
