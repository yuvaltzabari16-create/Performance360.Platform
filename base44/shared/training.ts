// Validation for athlete-recorded training results and coach messages.
// Prescribed targets live in Workout.blocks and are written by coaches;
// athlete-recorded results live in Workout.athlete_result and are written
// only through completeWorkout. The two are never merged.

import { ValidationError, oneOf, optionalNumber, optionalText, requireText } from './validation.ts';
import { sessionLoad } from './policy.ts';

export interface ItemResult {
  block_id: string;
  item_index: number;
  sets_done?: number;
  reps_done?: string;
  load_used?: string;
  note?: string;
}

export interface CompletionPayload {
  status: 'completed' | 'skipped';
  session_rpe?: number;
  duration_min?: number;
  session_load?: number;
  notes?: string;
  item_results: ItemResult[];
}

const MAX_ITEMS = 200;

export function validateCompletion(body: Record<string, unknown>): CompletionPayload {
  const status = oneOf(body.status ?? 'completed', ['completed', 'skipped'] as const, 'status');
  const session_rpe = optionalNumber(body.session_rpe, 'Session RPE (0–10)', 0, 10);
  const duration_min = optionalNumber(body.duration_min, 'Duration (minutes)', 1, 600);
  const notes = optionalText(body.notes, 'Notes', 2000);

  const raw = body.item_results ?? [];
  if (!Array.isArray(raw)) throw new ValidationError('item_results must be a list');
  if (raw.length > MAX_ITEMS) throw new ValidationError(`At most ${MAX_ITEMS} exercise results per session`);
  const item_results: ItemResult[] = raw.map((r, i) => {
    if (!r || typeof r !== 'object') throw new ValidationError(`Result ${i + 1} is invalid`);
    const o = r as Record<string, unknown>;
    const idx = optionalNumber(o.item_index, 'item_index', 0, 100);
    if (idx === undefined || !Number.isInteger(idx)) throw new ValidationError(`Result ${i + 1} needs an item_index`);
    return {
      block_id: requireText(o.block_id, 'block_id', 64),
      item_index: idx,
      sets_done: optionalNumber(o.sets_done, 'Sets done', 0, 50),
      reps_done: optionalText(o.reps_done, 'Reps done', 40),
      load_used: optionalText(o.load_used, 'Load used', 40),
      note: optionalText(o.note, 'Exercise note', 500),
    };
  });

  if (status === 'skipped') {
    return { status, notes, item_results: [] };
  }
  return {
    status,
    session_rpe,
    duration_min,
    session_load: sessionLoad(session_rpe, duration_min),
    notes,
    item_results,
  };
}

export function validateMessage(content: unknown): string {
  return requireText(content, 'Message', 4000);
}

/** Validated rehab plan from a coach. Clearance is never part of a plan. */
export function validateRehabPlan(phases: unknown) {
  if (!Array.isArray(phases) || phases.length === 0) throw new ValidationError('Add at least one phase');
  if (phases.length > 12) throw new ValidationError('At most 12 phases');
  return phases.map((p, i) => {
    const o = (p || {}) as Record<string, unknown>;
    const tests = Array.isArray(o.required_tests) ? o.required_tests : [];
    if (tests.length > 10) throw new ValidationError(`Phase ${i + 1}: at most 10 criteria`);
    const exercises = Array.isArray(o.exercises) ? o.exercises : [];
    if (exercises.length > 20) throw new ValidationError(`Phase ${i + 1}: at most 20 exercises`);
    return {
      order: i + 1,
      title: requireText(o.title, `Phase ${i + 1} title`, 120),
      description: optionalText(o.description, `Phase ${i + 1} description`, 1000),
      required_tests: tests.map((t, j) => requireText(t, `Phase ${i + 1} criterion ${j + 1}`, 200)),
      exercises: exercises.map((e, j) => {
        const eo = (e || {}) as Record<string, unknown>;
        return {
          title: requireText(eo.title, `Phase ${i + 1} exercise ${j + 1}`, 120),
          instructions: optionalText(eo.instructions, 'Instructions', 1000),
        };
      }),
    };
  });
}
