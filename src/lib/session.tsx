import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, must } from "./supabase";
import type { Club, Membership, Player, Profile, Role } from "./types";

interface SessionState {
  ready: boolean;
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  memberships: Membership[];
  clubs: Club[];
  club: Club | null;
  role: Role | null;
  /** The athlete's own player record in the active club (athletes only). */
  myPlayer: Player | null;
  setClub: (id: string) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);
const CLUB_KEY = "p360.club";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState<string | null>(() => {
    try { return localStorage.getItem(CLUB_KEY); } catch { return null; }
  });
  const [allMine, setAllMine] = useState<Player[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null); setMemberships([]); setClubs([]); setAllMine([]); setLoaded(true);
      return;
    }
    const [p, m] = await Promise.all([
      supabase.from("profiles").select("id, full_name, locale").eq("id", userId).maybeSingle(),
      supabase.from("club_members").select("club_id, user_id, role, created_at").eq("user_id", userId),
    ]);
    const mem = must(m) as Membership[];
    setProfile((must(p) as Profile | null) ?? null);
    setMemberships(mem);
    if (mem.length) {
      const c = must(await supabase.from("clubs").select("id, name").in("id", mem.map((x) => x.club_id))) as Club[];
      setClubs(c);
      const pl = must(await supabase.from("players").select("*").eq("user_id", userId).is("archived_at", null)) as Player[];
      setAllMine(pl);
    } else {
      setClubs([]);
      setAllMine([]);
    }
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    if (authReady) { setLoaded(false); refresh().catch(() => setLoaded(true)); }
  }, [authReady, refresh]);

  // Resolve the active club: stored choice if still valid, else the first membership.
  const activeClubId = memberships.some((m) => m.club_id === clubId) ? clubId : memberships[0]?.club_id ?? null;
  const club = clubs.find((c) => c.id === activeClubId) ?? null;
  const role = memberships.find((m) => m.club_id === activeClubId)?.role ?? null;

  const myPlayer = useMemo(() => allMine.find((p) => p.club_id === activeClubId) ?? null, [allMine, activeClubId]);

  const setClub = useCallback((id: string) => {
    setClubId(id);
    try { localStorage.setItem(CLUB_KEY, id); } catch { /* ignore */ }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // the next person to sign in on this device starts from their home screen
    if (window.location.hash && window.location.hash !== "#/") window.location.hash = "#/";
  }, []);

  const value = useMemo<SessionState>(() => ({
    ready: authReady && loaded,
    session, userId, profile, memberships, clubs, club, role, myPlayer,
    setClub, refresh, signOut,
  }), [authReady, loaded, session, userId, profile, memberships, clubs, club, role, myPlayer, setClub, refresh, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside provider");
  return v;
}

export const isStaff = (r: Role | null) => r === "director" || r === "coach";

/** Invite token remembered across the sign-in round trip. */
export const pendingInvite = {
  get(): string | null { try { return localStorage.getItem("p360.invite"); } catch { return null; } },
  set(tk: string) { try { localStorage.setItem("p360.invite", tk); } catch { /* ignore */ } },
  clear() { try { localStorage.removeItem("p360.invite"); } catch { /* ignore */ } },
};
