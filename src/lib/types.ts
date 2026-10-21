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

export type SessionType = "pitch" | "match" | "gym" | "recovery";

export interface TrainingSession {
  id: string;
  club_id: string;
  squad_id: string | null;
  session_date: string;
  type: SessionType;
  title: string | null;
  duration_min: number;
  notes: string | null;
  created_by: string | null;
  workout_id?: string | null;
  player_id?: string | null;
  workout_snapshot?: { title: string; focus: string | null; content: import("./workout").WorkoutContent } | null;
}

export interface SessionRpe {
  id: string;
  session_id: string;
  player_id: string;
  club_id: string;
  session_date: string;
  rpe: number;
  minutes: number;
  load: number;
}

export interface TestDef {
  id: string;
  club_id: string | null;
  key: string | null;
  name_en: string;
  name_he: string;
  unit: string;
  higher_is_better: boolean;
  decimals: number;
  sort: number;
  archived_at: string | null;
}

export interface TestResult {
  id: string;
  club_id: string;
  player_id: string;
  test_id: string;
  tested_on: string;
  value: number;
  notes: string | null;
}

export type Severity = "minor" | "moderate" | "severe";

export interface Injury {
  id: string;
  club_id: string;
  player_id: string;
  reported_on: string;
  body_area: string;
  side: "left" | "right" | "both" | null;
  kind: string | null;
  mechanism: string | null;
  severity: Severity;
  /** 0 rest · 1 rehab · 2 running · 3 modified training · 4 full training · 5 cleared */
  stage: number;
  expected_return: string | null;
  diagnosis: string | null;
  notes: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InjuryUpdate {
  id: string;
  injury_id: string;
  stage: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  club_id: string;
  player_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  club_id: string | null;
  kind: string;
  data: Record<string, string | number | null>;
  link: string | null;
  read_at: string | null;
  created_at: string;
}
