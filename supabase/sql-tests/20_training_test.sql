-- Training planner functions respect ownership. Runs after 10_access_control_test.sql
-- (reuses its users and the tests schema).

\set coach_a '''aaaaaaaa-0000-0000-0000-000000000001'''
\set coach_b '''bbbbbbbb-0000-0000-0000-000000000002'''

set role authenticated;
set request.jwt.claim.sub = :coach_a;
insert into public.training_programs (title, num_weeks) values ('Copy Source', 2);
select id as src from public.training_programs where title = 'Copy Source' \gset
insert into public.program_phases (program_id, name, start_week, end_week) values (:'src', 'Accumulation', 1, 2);
insert into public.training_sessions (program_id, title, week_number, day_number) values (:'src', 'Lower', 1, 1), (:'src', 'Upper', 1, 3);
select id as lower_s from public.training_sessions where program_id = :'src' and title = 'Lower' \gset
insert into public.session_exercises (session_id, exercise_name, position) values (:'lower_s', 'A', 0), (:'lower_s', 'B', 1), (:'lower_s', 'C', 2);

-- reorder
select id as ex_c from public.session_exercises where session_id = :'lower_s' and exercise_name = 'C' \gset
select public.move_session_exercise(:'ex_c', -1);
select tests.check((select string_agg(exercise_name, '' order by position) from public.session_exercises where session_id = :'lower_s') = 'ACB', 'move up swaps neighbours');
select public.move_session_exercise((select id from public.session_exercises where session_id = :'lower_s' and exercise_name = 'A'), -1);
select tests.check((select string_agg(exercise_name, '' order by position) from public.session_exercises where session_id = :'lower_s') = 'ACB', 'moving first item up is a no-op');

-- copy session / duplicate week
select public.copy_session(:'lower_s', 1, 5);
select tests.check((select count(*) from public.training_sessions where program_id = :'src' and week_number = 1) = 3, 'session copied');
select tests.check(public.duplicate_week(:'src', 1, 3) = 3, 'week duplicated');
select tests.check((select num_weeks from public.training_programs where id = :'src') = 3, 'program extended to fit duplicated week');
select tests.check((select count(*) from public.session_exercises se join public.training_sessions s on s.id = se.session_id where s.program_id = :'src' and s.week_number = 3) = 6, 'exercises copied with week');

-- versions
select tests.check(public.save_program_version(:'src', 'before edits') = 1, 'first version saved');
select tests.check((select jsonb_array_length(snapshot -> 'sessions') from public.program_versions where program_id = :'src') = 6, 'snapshot holds sessions');
select tests.check((select version from public.training_programs where id = :'src') = 2, 'program version incremented');

-- template copy is independent
select public.duplicate_program(:'src', true, 'Template') as tpl \gset
update public.training_sessions set title = 'Changed' where program_id = :'tpl';
select tests.check((select count(*) from public.training_sessions where program_id = :'src' and title = 'Changed') = 0, 'editing a copy leaves original untouched');
select tests.check((select is_template from public.training_programs where id = :'tpl'), 'copy saved as template');
select tests.check((select count(*) from public.program_phases where program_id = :'tpl') = 1, 'phases copied');

-- another coach cannot use these functions on coach A's program
set request.jwt.claim.sub = :coach_b;
select tests.throws(format($$select public.duplicate_program(%L, false)$$, :'src')) as b_dup \gset
select tests.check(:'b_dup'::boolean, 'coach B cannot duplicate coach A program');
select tests.throws(format($$select public.duplicate_week(%L, 1, 4)$$, :'src')) as b_week \gset
select tests.check(:'b_week'::boolean, 'coach B cannot duplicate coach A week');
select tests.throws(format($$select public.copy_session(%L, 1, 1)$$, :'lower_s')) as b_copy \gset
select tests.check(:'b_copy'::boolean, 'coach B cannot copy coach A session');
select tests.throws(format($$select public.save_program_version(%L)$$, :'src')) as b_ver \gset
select tests.check(:'b_ver'::boolean, 'coach B cannot version coach A program');
select public.move_session_exercise(:'ex_c', 1);
reset role;
select tests.check((select string_agg(exercise_name, '' order by position) from public.session_exercises where session_id = :'lower_s') = 'ACB', 'coach B cannot reorder coach A exercises');
