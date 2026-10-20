import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const r = body.readiness || {};
    const sport = body.sport || 'general';
    const focus = body.focus || 'strength';

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

    const prompt = `You are an elite strength & conditioning coach. Generate ONE training session for a ${sport} athlete with a focus on ${focus}.
Today's readiness — sleep: ${r.sleep_hours ?? 7}h, soreness: ${r.soreness ?? 3}/10, mood: ${r.mood ?? 6}/10, yesterday RPE: ${r.rpe ?? 5}/10.
Adapt volume and intensity to the readiness profile. Return a session title, focus, estimated duration in minutes, and 2-4 blocks (labelled A, B, C). Use block type "straight_sets" for single exercises, "superset" for paired exercises, or "circuit" for circuits with rounds. Each item needs exercise_name, sets, reps, load, rest and a brief note. JSON only.`;

    let result;
    try {
      result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt, response_json_schema: schema
      });
    } catch (llmErr) {
      const msg = String(llmErr?.message || llmErr);
      if (msg.includes('rate') || msg.includes('429')) return Response.json({ error: 'AI service rate limit reached. Please try again shortly.' }, { status: 429 });
      if (msg.includes('timeout') || msg.includes('Timeout')) return Response.json({ error: 'AI request timed out. Please try again.' }, { status: 504 });
      return Response.json({ error: 'AI returned an invalid response: ' + msg }, { status: 502 });
    }
    if (!result || !result.blocks) return Response.json({ error: 'AI returned malformed workout data' }, { status: 502 });
    return Response.json({ workout: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}