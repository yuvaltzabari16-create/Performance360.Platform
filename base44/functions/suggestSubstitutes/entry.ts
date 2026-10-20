import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const exerciseName = body.exercise_name;
    const library = body.library;
    if (!exerciseName || !library || !Array.isArray(library)) {
      return Response.json({ error: 'exercise_name and library array required' }, { status: 400 });
    }

    if (typeof exerciseName !== 'string' || exerciseName.length > 120 || library.length > 1000) {
      return Response.json({ error: 'Request too large' }, { status: 400 });
    }
    const names = library.map((e) => typeof e?.name === 'string' ? e.name.slice(0, 120) : '').filter(Boolean).join(', ');
    const schema = {
      type: 'object',
      properties: {
        substitutes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              exercise_name: { type: 'string' },
              reason: { type: 'string' }
            }
          }
        }
      },
      required: ['substitutes']
    };

    const prompt = `You are an elite S&C coach. An athlete is performing "${exerciseName}". From this exercise library, suggest exactly 3 alternative exercises that target the same movement pattern or muscle group: ${names}. Return each with a one-line reason why it's a good substitute. JSON only.`;

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
    if (!result || !Array.isArray(result.substitutes)) return Response.json({ error: 'AI returned malformed substitute data' }, { status: 502 });
    return Response.json({ substitutes: result.substitutes });
  } catch (error) {
    console.error('[function error]', error?.message);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}