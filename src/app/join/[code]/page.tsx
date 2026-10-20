import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Invitation links: /join/P360-XXXXXX. The code is only pre-filled; the athlete
// must sign in and explicitly confirm the coach before anything is connected.
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = /^P360-[A-Z0-9]{6}$/i.test(code) ? code.toUpperCase() : "";
  const target = `/connect${clean ? `?code=${clean}` : ""}`;
  const { user } = await getSession();
  if (!user) redirect(`/signup?next=${encodeURIComponent(target)}`);
  redirect(target);
}
