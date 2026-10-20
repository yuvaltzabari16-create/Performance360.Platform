import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { errorResponse, json, llmError, readJson, relationToAthlete } from '../../shared/coachAuth.ts';
import { ValidationError, optionalText, requireId } from '../../shared/validation.ts';

// AI-assisted movement review of an uploaded video. The record is created and
// updated here (not by the browser), so the stored feedback always comes from
// this function. If the model cannot read the video the analysis fails; it
// never falls back to feedback produced without seeing the video.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    const videoUrl = optionalText(body.video_url, 'video_url', 2048);
    if (!videoUrl || !/^https:\/\//i.test(videoUrl)) throw new ValidationError('A video upload (https URL) is required');
    // file_uri is the private storage reference that is kept; video_url is a
    // short-lived signed URL used only to let the model read the video now.
    const fileUri = optionalText(body.file_uri, 'file_uri', 2048);
    if (!fileUri) throw new ValidationError('file_uri is required');
    const movementType = optionalText(body.movement_type, 'Movement type', 80) || 'general athletic movement';
    const athleteId = body.athlete_id === undefined ? user.id : requireId(body.athlete_id, 'athlete_id');

    const relation = await relationToAthlete(base44, user, athleteId);
    if (!relation) return json({ error: 'You do not have access to this athlete' }, 403);

    const db = base44.asServiceRole.entities;
    const record = await db.MovementAnalysis.create({
      user_id: athleteId,
      coach_id: relation === 'coach' ? user.id : undefined,
      video_url: fileUri,
      movement_type: movementType,
      status: 'processing',
    });

    const schema = {
      type: 'object',
      properties: {
        ai_feedback: { type: 'string' },
        discrepancies: { type: 'array', items: { type: 'string' } },
      },
      required: ['ai_feedback', 'discrepancies'],
    };
    const prompt =
      `You are assisting a strength and conditioning coach reviewing a video of an athlete performing: ${movementType}. ` +
      'Describe only what is visible in the video: technique, positions, tempo and left/right symmetry. ' +
      'Do not diagnose injuries or give medical advice. If the video is unclear or does not show the movement, say so. ' +
      'Return ai_feedback (3–4 sentences) and discrepancies (short phrases). JSON only.';

    let result;
    try {
      result = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, file_urls: [videoUrl], response_json_schema: schema });
    } catch (err) {
      await db.MovementAnalysis.update(record.id, { status: 'failed' });
      const e = llmError(err);
      return json({ error: e.error, analysis_id: record.id }, e.status);
    }
    if (!result || typeof result.ai_feedback !== 'string') {
      await db.MovementAnalysis.update(record.id, { status: 'failed' });
      return json({ error: 'The AI service could not analyze this video', analysis_id: record.id }, 502);
    }
    const updated = await db.MovementAnalysis.update(record.id, {
      status: 'completed',
      ai_feedback: result.ai_feedback,
      discrepancies: Array.isArray(result.discrepancies) ? result.discrepancies.slice(0, 20) : [],
    });
    return json({ analysis: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
