import { beforeEach, describe, expect, test } from 'bun:test';
import { reset, setLlm } from './fake-sdk.ts';
import { call, users } from './helpers.ts';
import generateWorkout from '../base44/functions/generateWorkout/entry.ts';
import generateProgram from '../base44/functions/generateProgram/entry.ts';
import aiAssistant from '../base44/functions/aiAssistant/entry.ts';
import modifyWorkout from '../base44/functions/modifyWorkout/entry.ts';

let U: ReturnType<typeof users>;
beforeEach(() => { reset(); U = users(); });

describe('AI functions', () => {
  test('missing readiness values are sent as "not reported", never as invented defaults', async () => {
    let prompt = '';
    setLlm((a) => { prompt = a.prompt; return { title: 'S', blocks: [] }; });
    const r = await call(generateWorkout, U.ath1, { readiness: { sleep_hours: 6 } });
    expect(r.status).toBe(200);
    expect(prompt).toContain('sleep: 6h');
    expect(prompt).toContain('soreness: not reported');
  });
  test('oversized prompts are rejected before reaching the model', async () => {
    setLlm(() => { throw new Error('should not be called'); });
    expect((await call(aiAssistant, U.ath1, { prompt: 'x'.repeat(4001) })).status).toBe(400);
    expect((await call(generateProgram, U.coachA, { mode: 'workout', prompt: 'x'.repeat(2001) })).status).toBe(400);
  });
  test('model errors return a generic message without internal details', async () => {
    setLlm(() => { throw new Error('upstream secret detail'); });
    const r = await call(generateProgram, U.coachA, { mode: 'workout', prompt: 'speed' });
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.body)).not.toContain('secret');
  });
  test('modifyWorkout sends only workout content to the model', async () => {
    let prompt = '';
    setLlm((a) => { prompt = a.prompt; return { title: 'T', blocks: [] }; });
    await call(modifyWorkout, U.coachA, { preset: 'progress', workout: { title: 'T', blocks: [], user_id: 'ath1', athlete_result: { notes: 'private' } } });
    expect(prompt).not.toContain('ath1');
    expect(prompt).not.toContain('private');
  });
});
