import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const blockItemSchema = {
  type: 'object',
  properties: {
    exercise_id: { type: 'string' },
    exercise_name: { type: 'string' },
    label: { type: 'string' },
    sets: { type: 'number' },
    reps: { type: 'string' },
    load: { type: 'string' },
    rpe: { type: 'string' },
    rir: { type: 'string' },
    tempo: { type: 'string' },
    rest: { type: 'string' },
    time: { type: 'string' },
    distance: { type: 'string' },
    note: { type: 'string' }
  }
};

const blockSchema = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    type: { type: 'string', enum: ['straight_sets', 'superset', 'circuit'] },
    rounds: { type: 'number' },
    items: { type: 'array', items: blockItemSchema }
  }
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const mode = body.mode === 'workout' ? 'workout' : 'program';
    for (const k of ['prompt', 'sport', 'goal', 'focus', 'level']) {
      const max = k === 'prompt' ? 2000 : 80;
      if (body[k] !== undefined && (typeof body[k] !== 'string' || body[k].length > max)) {
        return Response.json({ error: `${k} must be text up to ${max} characters` }, { status: 400 });
      }
    }

    if (mode === 'workout') {
      const sport = (body.sport || 'general').toLowerCase();
      const focus = (body.focus || 'strength').toLowerCase();
      const prompt = body.prompt ? body.prompt + '\n\n' : '';
      const fullPrompt = `${prompt}You are an elite S&C coach. Generate ONE training session for a ${sport} athlete, focus: ${focus}. Return a title, focus, estimated_duration in minutes, and 2-4 blocks labelled A, B, C. Use "straight_sets", "superset" or "circuit". Each item: exercise_name, sets, reps, load, rest, note. JSON only.`;

      const schema = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          focus: { type: 'string' },
          estimated_duration: { type: 'number' },
          blocks: { type: 'array', items: blockSchema }
        },
        required: ['title', 'blocks']
      };

      let result;
      try {
        result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: fullPrompt, response_json_schema: schema
        });
      } catch (llmErr) {
        const msg = String(llmErr?.message || llmErr);
        if (msg.includes('rate') || msg.includes('429')) return Response.json({ error: 'AI service rate limit reached. Please try again shortly.' }, { status: 429 });
        if (msg.includes('timeout') || msg.includes('Timeout')) return Response.json({ error: 'AI request timed out. Please try again.' }, { status: 504 });
        console.error('[llm error]', msg);
        return Response.json({ error: 'The AI service returned an invalid response. Please try again.' }, { status: 502 });
      }
      if (!result || !Array.isArray(result.blocks)) return Response.json({ error: 'AI returned malformed workout data' }, { status: 502 });
      return Response.json({ workout: result });
    }

    // Program mode
    const weeks = Math.min(Math.max(Number(body.weeks) || 4, 1), 4);
    const sport = (body.sport || 'general').toLowerCase();
    const goal = (body.goal || 'strength').toLowerCase();
    const level = (body.level || 'intermediate').toLowerCase();
    const sessionsPerWeek = Math.min(Math.max(Number(body.sessions_per_week) || 3, 1), 3);
    const customPrompt = body.prompt ? `\nAdditional instruction: ${body.prompt}` : '';

    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        num_weeks: { type: 'number' },
        workouts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              week_number: { type: 'number' },
              day_number: { type: 'number' },
              title: { type: 'string' },
              focus: { type: 'string' },
              estimated_duration: { type: 'number' },
              blocks: { type: 'array', items: blockSchema }
            },
            required: ['title', 'blocks']
          }
        }
      },
      required: ['name', 'workouts']
    };

    const prompt = `You are an elite S&C coach designing a ${weeks}-week periodized program for a ${level} ${sport} athlete, goal: ${goal}.
Generate exactly ${sessionsPerWeek} sessions per week (${weeks * sessionsPerWeek} total). Apply progressive overload with a deload in the final week.
Return a program name, description, num_weeks, and a workouts array. Each workout has week_number, day_number, title, focus, estimated_duration, and 2-4 blocks labelled A/B/C using straight_sets/superset/circuit. Each item: exercise_name, sets, reps, load, rest, note. JSON only.${customPrompt}`;

    let result;
    try {
      result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt, response_json_schema: schema
      });
    } catch (llmErr) {
      const msg = String(llmErr?.message || llmErr);
      if (msg.includes('rate') || msg.includes('429')) return Response.json({ error: 'AI service rate limit reached. Please try again shortly.' }, { status: 429 });
      if (msg.includes('timeout') || msg.includes('Timeout')) return Response.json({ error: 'AI request timed out. Please try again.' }, { status: 504 });
      console.error('[llm error]', msg);
      return Response.json({ error: 'The AI service returned an invalid response. Please try again.' }, { status: 502 });
    }
    if (!result || !result.workouts) return Response.json({ error: 'AI returned malformed program data' }, { status: 502 });
    return Response.json({ program: result });
  } catch (error) {
    console.error('[function error]', error?.message);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}