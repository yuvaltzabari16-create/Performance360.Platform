import type { InjuryEventKind, InjuryStage } from "@/lib/injury";

export interface InjuryRow {
  id: string;
  athlete_id: string;
  body_area: string;
  side: string | null;
  kind: string;
  mechanism: string | null;
  severity: string | null;
  injury_date: string;
  diagnosis: string | null;
  expected_return: string | null;
  stage: InjuryStage;
  status: "open" | "resolved";
  resolved_on: string | null;
}

export interface InjuryEventRow {
  id: string;
  injury_id: string;
  kind: InjuryEventKind;
  stage: InjuryStage | null;
  note: string | null;
  author_name: string | null;
  author_role: string | null;
  created_at: string;
}
