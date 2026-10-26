-- Role access, second pass.
--   * Director: reads everything about the roster athletes (tests, wellness, coach notes on top of
--     profile, schedule, injuries, GPS). Still no planner contents, no exercise library, no writing.
--   * Physiotherapist: may build rehab and injury-prevention programs and create library exercises
--     (the planner is part of the medical side); GPS import stays with the performance side.

create policy results_select_director on public.test_results for select to authenticated using (public.director_sees_athlete(athlete_id));
create policy readiness_select_director on public.readiness_entries for select to authenticated using (public.director_sees_athlete(athlete_id));
create policy notes_select_director on public.athlete_notes for select to authenticated using (public.director_sees_athlete(athlete_id));

alter policy exercises_insert on public.exercises
  with check (owner_id = auth.uid() and public.is_professional() and coalesce(public.my_org_role(), '') <> 'director');

alter policy programs_insert on public.training_programs
  with check (coach_id = auth.uid() and public.is_professional() and coalesce(public.my_org_role(), '') <> 'director');

notify pgrst, 'reload schema';
