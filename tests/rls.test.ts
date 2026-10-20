// Static checks on entity security rules (base44/entities/*.jsonc). These
// prove the rules are written as intended; they cannot prove how the Base44
// platform evaluates them — that needs the manual checks in docs/TESTING.md.
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.join(import.meta.dir, '..', 'base44', 'entities');
const E: Record<string, any> = {};
for (const f of readdirSync(dir)) if (f.endsWith('.jsonc')) E[f.replace('.jsonc', '')] = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
const ADMIN_ONLY = { user_condition: { role: 'admin' } };

const branches = (rule: any): any[] => (rule && rule.$or ? rule.$or : [rule]);

describe('entity rules', () => {
  test('every entity except User declares rules for all four operations', () => {
    for (const [name, e] of Object.entries(E)) {
      if (name === 'User') continue;
      for (const op of ['read', 'create', 'update', 'delete']) expect(e.rls?.[op], `${name}.${op}`).toBeDefined();
    }
  });

  test('cross-user records are written only by backend functions (service role)', () => {
    const serverOnly: Record<string, string[]> = {
      Assignment: ['create', 'update', 'delete'],
      CollaborationMessage: ['create', 'update', 'delete'],
      WorkoutAssignment: ['create', 'update'],
      TeamMember: ['create', 'update'],
      PerformanceMetric: ['create', 'update', 'delete'],
      ReadinessEntry: ['create', 'update', 'delete'],
      ClearanceMilestone: ['create', 'update', 'delete'],
      ExerciseBlock: ['create', 'update', 'delete'],
      MovementAnalysis: ['create', 'update', 'delete'],
      Subscription: ['create', 'update', 'delete'],
    };
    for (const [name, ops] of Object.entries(serverOnly)) {
      for (const op of ops) expect(E[name].rls[op], `${name}.${op}`).toEqual(ADMIN_ONLY);
    }
  });

  test('athlete-owned health and performance records are not readable via a stored coach_id', () => {
    for (const name of ['PerformanceMetric', 'ReadinessEntry', 'ClearanceMilestone', 'ExerciseBlock', 'MovementAnalysis']) {
      const keys = JSON.stringify(E[name].rls.read);
      expect(keys, name).not.toContain('coach_id');
      expect(keys, name).toContain('data.user_id');
    }
  });

  test('no create rule relies on created_by_id alone (it is always the caller on create)', () => {
    for (const [name, e] of Object.entries(E)) {
      if (!e.rls?.create) continue;
      const hasRefs = ['user_id', 'athlete_id', 'coach_id'].some((f) => f in (e.properties || {}));
      if (!hasRefs) continue;
      for (const b of branches(e.rls.create)) {
        const onlyCreator = b && Object.keys(b).length === 1 && 'created_by_id' in b;
        expect(onlyCreator, `${name}.create has a created_by_id-only branch`).toBe(false);
      }
    }
  });

  test('workouts can only be created for oneself', () => {
    expect(E.Workout.rls.create).toEqual({ $or: [{ 'data.user_id': '{{user.id}}' }, ADMIN_ONLY] });
  });

  test('athletes cannot edit coach-prescribed copies and coaches cannot edit athletes\' copies', () => {
    const rule = JSON.stringify(E.Workout.rls.update);
    expect(rule).not.toContain('data.coach_id');
    expect(rule).toContain('created_by_id');
  });

  test('privileged User fields are admin-only for both field-level keys', () => {
    for (const f of ['role', 'coach_id', 'onboarded']) {
      expect(E.User.properties[f].rls.write, f).toEqual(ADMIN_ONLY);
      expect(E.User.properties[f].rls.update, f).toEqual(ADMIN_ONLY);
    }
  });

  test('knowledge articles saved by coaches are private', () => {
    const create = JSON.stringify(E.KnowledgeArticle.rls.create);
    expect(create).toContain('"data.visibility":"private"');
  });
});
