-- Training planner operations that touch many rows. They are SECURITY INVOKER,
-- so row level security applies exactly as for direct queries, and each runs
-- in a single transaction (all-or-nothing).

create or replace function public.copy_session(p_session uuid, p_week int, p_day int)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_new uuid;
begin
  insert into public.training_sessions (program_id, week_number, day_number, title, notes, planned_duration_min)
  select program_id, p_week, p_day, title, notes, planned_duration_min
  from public.training_sessions where id = p_session
  returning id into v_new;
  if v_new is null then raise exception 'session not found' using errcode = '42501'; end if;

  insert into public.session_exercises (session_id, exercise_id, exercise_name, section, position, sets, reps,
    duration_s, distance_m, load_kg, percent_1rm, tempo, rest_s, intensity_target, rpe, rir, cues, modifications, notes)
  select v_new, exercise_id, exercise_name, section, position, sets, reps,
    duration_s, distance_m, load_kg, percent_1rm, tempo, rest_s, intensity_target, rpe, rir, cues, modifications, notes
  from public.session_exercises where session_id = p_session;
  return v_new;
end $$;

create or replace function public.duplicate_week(p_program uuid, p_from int, p_to int)
returns int language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  s record;
  n int := 0;
begin
  if not public.owns_program(p_program) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_to > (select num_weeks from public.training_programs where id = p_program) then
    update public.training_programs set num_weeks = p_to where id = p_program;
  end if;
  for s in select id, day_number from public.training_sessions
           where program_id = p_program and week_number = p_from order by day_number, created_at loop
    perform public.copy_session(s.id, p_to, s.day_number);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Copies a program (phases, sessions, exercises). Assignments and logs are not copied.
create or replace function public.duplicate_program(p_program uuid, p_as_template boolean, p_title text default null)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_new uuid;
  s record;
begin
  if not public.is_professional() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.training_programs (coach_id, title, description, program_type, sport, goal, num_weeks, is_template, status, ai_generated)
  select auth.uid(), coalesce(nullif(trim(p_title), ''), title || ' (copy)'), description, program_type, sport, goal, num_weeks,
         p_as_template, 'draft', ai_generated
  from public.training_programs where id = p_program
  returning id into v_new;
  if v_new is null then raise exception 'program not found' using errcode = '42501'; end if;

  insert into public.program_phases (program_id, name, cycle_level, start_week, end_week, objective)
  select v_new, name, cycle_level, start_week, end_week, objective from public.program_phases where program_id = p_program;

  for s in select id from public.training_sessions where program_id = p_program loop
    perform public.copy_session_to_program(s.id, v_new);
  end loop;
  return v_new;
end $$;

create or replace function public.copy_session_to_program(p_session uuid, p_program uuid)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_new uuid;
begin
  insert into public.training_sessions (program_id, week_number, day_number, title, notes, planned_duration_min)
  select p_program, week_number, day_number, title, notes, planned_duration_min
  from public.training_sessions where id = p_session
  returning id into v_new;
  insert into public.session_exercises (session_id, exercise_id, exercise_name, section, position, sets, reps,
    duration_s, distance_m, load_kg, percent_1rm, tempo, rest_s, intensity_target, rpe, rir, cues, modifications, notes)
  select v_new, exercise_id, exercise_name, section, position, sets, reps,
    duration_s, distance_m, load_kg, percent_1rm, tempo, rest_s, intensity_target, rpe, rir, cues, modifications, notes
  from public.session_exercises where session_id = p_session;
  return v_new;
end $$;

-- Saves the current program structure as an immutable version snapshot.
create or replace function public.save_program_version(p_program uuid, p_note text default null)
returns int language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_version int;
  v_snapshot jsonb;
begin
  if not public.owns_program(p_program) then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(max(version), 0) + 1 into v_version from public.program_versions where program_id = p_program;
  select jsonb_build_object(
    'program', to_jsonb(p.*),
    'phases', coalesce((select jsonb_agg(to_jsonb(ph.*) order by ph.start_week) from public.program_phases ph where ph.program_id = p.id), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(to_jsonb(s.*) || jsonb_build_object('exercises',
        coalesce((select jsonb_agg(to_jsonb(se.*) order by se.position) from public.session_exercises se where se.session_id = s.id), '[]'::jsonb))
        order by s.week_number, s.day_number)
      from public.training_sessions s where s.program_id = p.id), '[]'::jsonb)
  ) into v_snapshot
  from public.training_programs p where p.id = p_program;

  insert into public.program_versions (program_id, version, snapshot, note) values (p_program, v_version, v_snapshot, p_note);
  update public.training_programs set version = v_version + 1 where id = p_program;
  return v_version;
end $$;

-- Swap an exercise with its neighbour within a session (for up/down ordering).
create or replace function public.move_session_exercise(p_id uuid, p_direction int)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_session uuid;
  v_ids uuid[];
  v_idx int;
  v_swap int;
begin
  select session_id into v_session from public.session_exercises where id = p_id;
  if v_session is null then return; end if;
  select array_agg(id order by position, id) into v_ids from public.session_exercises where session_id = v_session;
  v_idx := array_position(v_ids, p_id);
  v_swap := v_idx + sign(p_direction)::int;
  if v_swap < 1 or v_swap > array_length(v_ids, 1) then return; end if;
  v_ids[v_idx] := v_ids[v_swap];
  v_ids[v_swap] := p_id;
  update public.session_exercises se set position = x.ord - 1
  from unnest(v_ids) with ordinality as x(id, ord)
  where se.id = x.id;
end $$;

grant execute on function
  public.copy_session(uuid, int, int),
  public.copy_session_to_program(uuid, uuid),
  public.duplicate_week(uuid, int, int),
  public.duplicate_program(uuid, boolean, text),
  public.save_program_version(uuid, text),
  public.move_session_exercise(uuid, int)
to authenticated;
