import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Invitation links: /join/P360-XXXXXX (coach), /join/TEAM-XXXXXX (team roster, for athletes)
// and /join/STAFF-XXXXXX (staff invitation). The code is only pre-filled; the person must sign
// in and explicitly confirm before anything is connected.
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  const { user, profile } = await getSession();

  if (/^STAFF-[A-Z0-9]{6}$/.test(upper)) {
    const onboarding = `/onboarding?type=team&mode=join&code=${upper}`;
    if (!user) redirect(`/signup?next=${encodeURIComponent(onboarding)}`);
    redirect(profile?.role ? `/team/join?code=${upper}` : onboarding);
  }

  const clean = /^(P360|TEAM)-[A-Z0-9]{6}$/.test(upper) ? upper : "";
  const target = `/connect${clean ? `?code=${clean}` : ""}`;
  if (!user) redirect(`/signup?next=${encodeURIComponent(target)}`);
  redirect(target);
}
