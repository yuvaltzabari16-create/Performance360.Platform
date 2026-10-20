import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const prompt = body?.prompt;
    const useWeb = body?.use_web === true;
    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: 'prompt is required' }, { status: 400 });
    }
    if (prompt.length > 4000) {
      return Response.json({ error: 'Please keep questions under 4000 characters' }, { status: 400 });
    }

    const systemPrefix =
      'You are an elite Strength & Conditioning and sports science assistant embedded in the Performance360 platform. ' +
      'Give concise, evidence-based, practical guidance on S&C, programming, rehabilitation, return-to-play, ' +
      'periodization, testing, recovery and general professional coaching questions. Use clear structure. ' +
      'If asked for a program or plan, format with clear blocks and sets/reps. ' +
      'Do not diagnose injuries, prescribe medical treatment, or state that an athlete is cleared to return to sport; ' +
      'refer those decisions to a qualified medical professional.';

    let res;
    try {
      res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: systemPrefix + '\n\nUser question:\n' + prompt,
        add_context_from_internet: useWeb,
      });
    } catch (llmErr) {
      const msg = String(llmErr?.message || llmErr);
      if (msg.includes('rate') || msg.includes('429')) return Response.json({ error: 'AI service rate limit reached. Please try again shortly.' }, { status: 429 });
      if (msg.includes('timeout') || msg.includes('Timeout')) return Response.json({ error: 'AI request timed out. Please try again.' }, { status: 504 });
      console.error('[llm error]', msg);
      return Response.json({ error: 'The AI service returned an invalid response. Please try again.' }, { status: 502 });
    }

    return Response.json({ answer: typeof res === 'string' ? res : res?.answer || JSON.stringify(res) });
  } catch (error) {
    console.error('[function error]', error?.message);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}