-- Hardening from the Supabase security advisor.

-- Pin search_path on the remaining functions.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.athletes_guard_update() set search_path = public, pg_temp;
alter function public.generate_code_string() set search_path = public, pg_temp;

-- Trigger functions are never called directly.
revoke execute on function public.athletes_after_insert() from public, anon, authenticated;
revoke execute on function public.assignments_after_insert() from public, anon, authenticated;

-- Signed-out visitors need none of the SECURITY DEFINER functions. The access
-- helpers stay executable by `authenticated` because RLS policies call them.
revoke execute on function
  public.is_platform_admin(),
  public.is_professional(uuid),
  public.can_access_athlete(uuid),
  public.is_athlete_professional(uuid),
  public.is_primary_coach(uuid),
  public.is_own_athlete_record(uuid),
  public.owns_team(uuid),
  public.owns_program(uuid),
  public.can_view_program(uuid),
  public.can_view_program_for_athlete(uuid, uuid),
  public.session_program(uuid),
  public.completion_athlete(uuid),
  public.regenerate_coach_code(),
  public.revoke_coach_code(),
  public.preview_coach_code(text),
  public.connect_with_coach_code(text, boolean),
  public.end_relationship(uuid),
  public.complete_onboarding(public.user_role, text),
  public.deactivate_my_account(),
  public.ensure_my_athlete_record()
from public, anon;

grant execute on function
  public.is_platform_admin(),
  public.is_professional(uuid),
  public.can_access_athlete(uuid),
  public.is_athlete_professional(uuid),
  public.is_primary_coach(uuid),
  public.is_own_athlete_record(uuid),
  public.owns_team(uuid),
  public.owns_program(uuid),
  public.can_view_program(uuid),
  public.can_view_program_for_athlete(uuid, uuid),
  public.session_program(uuid),
  public.completion_athlete(uuid)
to authenticated;
