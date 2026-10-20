export async function verifyCoachAthleteLink(base44, coachId, athleteId) {
  const res = await base44.asServiceRole.entities.Assignment.filter({
    coach_id: coachId,
    athlete_id: athleteId,
    status: 'active'
  }, { limit: 1 });
  return (res.items || []).length > 0;
}

export async function verifyCoachAthleteByEmail(base44, coachId, athleteEmail) {
  const res = await base44.asServiceRole.entities.Assignment.filter({
    coach_id: coachId,
    athlete_email: athleteEmail,
    status: 'active'
  }, { limit: 1 });
  return (res.items || []).length > 0;
}

export function llmError(err) {
  const msg = String(err?.message || err);
  if (msg.includes('rate') || msg.includes('429')) {
    return { error: 'AI service rate limit reached. Please try again shortly.', status: 429 };
  }
  if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('timed out')) {
    return { error: 'AI request timed out. Please try again.', status: 504 };
  }
  return { error: 'AI returned an invalid or malformed response: ' + msg, status: 502 };
}