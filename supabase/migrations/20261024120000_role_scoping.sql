-- Role scoping inside a team.
--   * The director runs the club but does not see performance content: the exercise library and
--     training programs are out of reach, the same way athlete records already are.
--   * The physiotherapist handles the medical side and does not write training programs or
--     create library exercises.
-- Applied to existing policies in place (alter policy), so nothing else about them changes.

alter policy exercises_select on public.exercises
  using ((owner_id is null or owner_id = auth.uid() or public.is_platform_admin())
         and coalesce(public.my_org_role(), '') <> 'director');

alter policy exercises_insert on public.exercises
  with check (owner_id = auth.uid() and public.is_professional()
              and coalesce(public.my_org_role(), '') not in ('director', 'physiotherapist'));

alter policy programs_insert on public.training_programs
  with check (coach_id = auth.uid() and public.is_professional()
              and coalesce(public.my_org_role(), '') not in ('director', 'physiotherapist'));

notify pgrst, 'reload schema';
