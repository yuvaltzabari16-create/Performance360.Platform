export type Role = "director" | "coach" | "athlete";
export type PlayerStatus = "available" | "injured" | "rehab" | "unavailable";
export type Position = "GK" | "DF" | "MF" | "FW";
export type Foot = "left" | "right" | "both";

export interface Profile {
  id: string;
  full_name: string | null;
  locale: "he" | "en";
}

export interface Club {
  id: string;
  name: string;
}

export interface Membership {
  club_id: string;
  user_id: string;
  role: Role;
  created_at?: string;
}

export interface Squad {
  id: string;
  club_id: string;
  name: string;
  age_group: string | null;
  season: string | null;
  archived_at: string | null;
}

export interface SquadStaff {
  squad_id: string;
  user_id: string;
}

export interface Player {
  id: string;
  club_id: string;
  squad_id: string | null;
  user_id: string | null;
  full_name: string;
  date_of_birth: string | null;
  position: Position | null;
  shirt_number: number | null;
  dominant_foot: Foot | null;
  height_cm: number | null;
  weight_kg: number | null;
  status: PlayerStatus;
  notes: string | null;
  archived_at: string | null;
}

export interface Invite {
  id: string;
  club_id: string;
  role: Role;
  player_id: string | null;
  squad_id: string | null;
  email: string | null;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

export interface Checkin {
  id: string;
  player_id: string;
  club_id: string;
  entry_date: string;
  sleep_hours: number | null;
  sleep: number;
  energy: number;
  freshness: number;
  calm: number;
  mood: number;
  readiness: number;
  pain: boolean;
  pain_area: string | null;
  notes: string | null;
}

export interface PlayerNote {
  id: string;
  player_id: string;
  author_id: string;
  body: string;
  shared_with_athlete: boolean;
  created_at: string;
}

export const WELLNESS_KEYS = ["sleep", "energy", "freshness", "calm", "mood"] as const;
export type WellnessKey = (typeof WELLNESS_KEYS)[number];
