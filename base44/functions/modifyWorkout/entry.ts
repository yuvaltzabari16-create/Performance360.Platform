import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const workout = body.workout;
    const preset = body.preset;
    if (!workout || !preset) return Response.json({ error: 'workout and preset required' }, { status: 400 });
    const slim = { title: workout.title, focus: workout.focus, estimated_duration: workout.estimated_duration, blocks: workout.blocks };
    if (JSON.stringify(slim).length > 50000) return Response.json({ error: 'Workout is too large to modify with AI' }, { status: 400 });

    const presets = {
      'progress': 'Progress this workout for next week: increase intensity or volume slightly while keeping the same exercise selection and structure.',
      'cut_volume_30': 'Reduce total training volume by approximately 30% (reduce sets) while preserving exercise selection and structure.',
      'match_day_minus_2': 'Make this workout match-day −2 friendly: lower volume and intensity, focus on activation and mobility, keep it short.',
      'fit_40_min': 'Restructure this workout to fit within 40 minutes total. Trim volume and rest periods as needed while keeping the core exercises.',
    };

    const instruction = presets[preset];
    if (!instruction) return Response.json({ error: 'unknown preset' }, { status: 400 });

    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        focus: { type: 'string' },
        estimated_duration: { type: 'number' },
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              type: { type: 'string', enum: ['straight_sets', 'superset', 'circuit'] },
              rounds: { type: 'number' },
              items: {
                type: 'array',
                items: {
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
                }
              }
            }
          }
        }
      },
      required: ['title', 'blocks']
    };

    const prompt = `You are an elite S&C coach. Here is a workout as JSON:\n${JSON.stringify(slim)}\n\n${instruction}\nReturn the modified workout with the same block structure (label, type, rounds, items with exercise_name, sets, reps, load, rest, note). Keep exercise_name values the same unless the preset requires a change. JSON only.`;

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
    if (!result || !result.blocks) return Response.json({ error: 'AI returned malformed workout data' }, { status: 502 });
    return Response.json({ workout: result });
  } catch (error) {
    console.error('[function error]', error?.message);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}