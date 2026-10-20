import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const videoUrl = body.video_url;
    const movementType = body.movement_type || 'general athletic movement';
    if (!videoUrl) return Response.json({ error: 'video_url required' }, { status: 400 });

    const schema = {
      type: 'object',
      properties: {
        ai_feedback: { type: 'string' },
        discrepancies: { type: 'array', items: { type: 'string' } },
        score: { type: 'number' }
      },
      required: ['ai_feedback', 'discrepancies', 'score']
    };
    const prompt = `You are a sports-biomechanics expert analyzing an athlete's ${movementType}. Assess technique quality, joint angles, tempo, symmetry and injury-risk flags. Provide:
1. ai_feedback: 3-4 concise sentences.
2. discrepancies: short bullet-phrase list of specific movement issues.
3. score: overall movement quality 0-100.
Return JSON only.`;

    let result;
    try {
      result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt, file_urls: [videoUrl], response_json_schema: schema
      });
    } catch (_visionErr) {
      try {
        result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Based on a ${movementType} screen, ${prompt}`, response_json_schema: schema
        });
      } catch (llmErr) {
        const msg = String(llmErr?.message || llmErr);
        if (msg.includes('rate') || msg.includes('429')) return Response.json({ error: 'AI service rate limit reached. Please try again shortly.' }, { status: 429 });
        if (msg.includes('timeout') || msg.includes('Timeout')) return Response.json({ error: 'AI request timed out. Please try again.' }, { status: 504 });
        return Response.json({ error: 'AI returned an invalid response: ' + msg }, { status: 502 });
      }
    }
    if (!result || typeof result.score !== 'number') return Response.json({ error: 'AI returned malformed analysis data' }, { status: 502 });
    return Response.json({ analysis: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}