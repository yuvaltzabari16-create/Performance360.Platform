export type UserRole =
  | "performance_coach"
  | "sc_coach"
  | "personal_trainer"
  | "physiotherapist"
  | "sports_scientist"
  | "athlete"
  | "org_admin";

export const PROFESSIONAL_ROLES: UserRole[] = [
  "performance_coach",
  "sc_coach",
  "personal_trainer",
  "physiotherapist",
  "sports_scientist",
  "org_admin",
];
export const ONBOARDING_ROLES: UserRole[] = [
  "performance_coach",
  "sc_coach",
  "personal_trainer",
  "physiotherapist",
  "sports_scientist",
  "athlete",
  "org_admin",
];

export type OrgRole =
  | "director"
  | "head_coach"
  | "head_of_performance"
  | "assistant_coach"
  | "physiotherapist"
  | "sports_scientist"
  | "other_staff";

export const ORG_ROLES: OrgRole[] = [
  "director",
  "head_coach",
  "head_of_performance",
  "assistant_coach",
  "physiotherapist",
  "sports_scientist",
  "other_staff",
];

/** Independent practitioners (Personal Trainer account type) choose a profession. */
export const INDEPENDENT_ROLES: UserRole[] = [
  "personal_trainer",
  "sc_coach",
  "performance_coach",
  "physiotherapist",
  "sports_scientist",
];

export interface OrgMembership {
  org_id: string;
  org_name: string;
  org_role: OrgRole;
}

export type Locale = "en" | "he";
export type Units = "metric" | "imperial";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole | null;
  avatar_url: string | null;
  locale: Locale;
  units: Units;
  notification_prefs: { in_app: boolean; email: boolean; muted?: string[] };
  preferences?: Record<string, unknown> | null;
  terms_version?: string | null;
  terms_accepted_at?: string | null;
  is_platform_admin: boolean;
  onboarded_at: string | null;
  deactivated_at: string | null;
}

export interface Athlete {
  id: string;
  user_id: string | null;
  owner_coach_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  preferred_language: Locale | null;
  emergency_contact: string | null;
  sport: string | null;
  team_name: string | null;
  club: string | null;
  position: string | null;
  competitive_level: string | null;
  training_age_years: number | null;
  current_season: string | null;
  dominant_side: "left" | "right" | "both" | null;
  short_term_goals: string | null;
  long_term_goals: string | null;
  height_cm: number | null;
  body_mass_kg: number | null;
  training_availability: string | null;
  equipment_availability: string | null;
  injury_history: string | null;
  limitations: string | null;
  rehab_status: string | null;
  training_modifications: string | null;
  guardian_name: string | null;
  guardian_contact: string | null;
  guardian_consent_at: string | null;
  guardian_consent_source: "staff_recorded" | "athlete_declared" | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: string;
  owner_id: string | null;
  name: string;
  description: string | null;
  category: string;
  primary_objective: string | null;
  movement_pattern: string | null;
  primary_muscles: string[];
  equipment: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  coaching_cues: string[];
  common_errors: string[];
  regressions: string | null;
  progressions: string | null;
  modification_notes: string | null;
  suggested_prescription: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  tags: string[];
  source: string | null;
}

export interface TrainingProgram {
  id: string;
  coach_id: string;
  title: string;
  description: string | null;
  program_type: string;
  sport: string | null;
  goal: string | null;
  num_weeks: number;
  is_template: boolean;
  status: "draft" | "active" | "archived";
  ai_generated: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingSession {
  id: string;
  program_id: string;
  week_number: number;
  day_number: number;
  title: string;
  notes: string | null;
  planned_duration_min: number | null;
}

export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name: string;
  section: string;
  position: number;
  sets: number | null;
  reps: string | null;
  duration_s: number | null;
  distance_m: number | null;
  load_kg: number | null;
  percent_1rm: number | null;
  tempo: string | null;
  rest_s: number | null;
  intensity_target: string | null;
  rpe: number | null;
  rir: number | null;
  cues: string | null;
  modifications: string | null;
  notes: string | null;
}

export interface TestDefinition {
  id: string;
  owner_id: string | null;
  name: string;
  short_name: string | null;
  category: string;
  unit: string;
  higher_is_better: boolean;
  bilateral: boolean;
  protocol: string | null;
  default_trials: number;
}

export interface TestResult {
  id: string;
  athlete_id: string;
  test_id: string;
  tested_on: string;
  side: "both" | "left" | "right";
  trials: number[];
  method: string | null;
  conditions: string | null;
  data_quality: "good" | "questionable" | "poor";
  is_baseline: boolean;
  notes: string | null;
  tester_id: string | null;
  created_at: string;
}

export interface ReadinessEntry {
  id: string;
  athlete_id: string;
  entry_date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  fatigue: number | null;
  soreness: number | null;
  stress: number | null;
  mood: number | null;
  motivation: number | null;
  pain_reported: boolean;
  pain_notes: string | null;
  notes: string | null;
}
