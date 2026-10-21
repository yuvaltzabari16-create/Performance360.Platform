import { useEffect, useRef } from "react";
import { Shell } from "./components/Shell";
import { Loading } from "./components/ui";
import { useI18n } from "./lib/i18n";
import { match, navigate, useRoute } from "./lib/router";
import { isStaff, pendingInvite, useSession } from "./lib/session";
import { AuthPage } from "./pages/Auth";
import { InvitePage } from "./pages/Invite";
import { Onboarding } from "./pages/Onboarding";
import { Settings } from "./pages/Settings";
import { AthleteNotes } from "./pages/athlete/Notes";
import { Progress } from "./pages/athlete/Progress";
import { Today } from "./pages/athlete/Today";
import { Overview } from "./pages/coach/Overview";
import { PlayerProfile } from "./pages/coach/PlayerProfile";
import { Players } from "./pages/coach/Players";
import { Squads } from "./pages/coach/Squads";
import { Staff } from "./pages/coach/Staff";

export function App() {
  const path = useRoute();
  const { t, setLang } = useI18n();
  const s = useSession();

  // Apply the user's saved language once per sign-in.
  const appliedFor = useRef<string | null>(null);
  useEffect(() => {
    if (s.profile && appliedFor.current !== s.profile.id) {
      appliedFor.current = s.profile.id;
      setLang(s.profile.locale);
    }
  }, [s.profile, setLang]);

  const invite = match("/invite/:token", path);
  // Remember an invite across the sign-in / sign-up round trip.
  useEffect(() => { if (invite) pendingInvite.set(invite.token); }, [invite?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s.ready) return <Loading />;
  if (!s.session) return <AuthPage notice={invite || pendingInvite.get() ? t.inviteSignIn : undefined} />;

  const token = invite?.token ?? pendingInvite.get();
  if (token) return <InvitePage token={token} />;
  if (!s.memberships.length || !s.role) return <Onboarding />;

  return <Shell path={path}>{route(path, s.role)}</Shell>;
}

function route(path: string, role: "director" | "coach" | "athlete") {
  if (path === "/settings") return <Settings />;
  if (role === "athlete") {
    if (path === "/progress") return <Progress />;
    if (path === "/notes") return <AthleteNotes />;
    if (path !== "/today") navigate("/today");
    return <Today />;
  }
  const p = match("/players/:id", path);
  if (p) return <PlayerProfile id={p.id} />;
  if (path === "/players") return <Players />;
  if (path === "/squads") return <Squads />;
  if (path === "/staff" && role === "director") return <Staff />;
  if (path !== "/overview" && isStaff(role)) navigate("/overview");
  return <Overview />;
}
