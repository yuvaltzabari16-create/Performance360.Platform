-- Row level security and invitation-flow tests. Run via scripts/test-db.sh.
-- Each step impersonates a user the same way PostgREST does: role `authenticated`
-- plus the JWT subject in request.jwt.claim.sub.

create schema tests;
grant usage on schema tests to authenticated, anon;

create function tests.check(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAILED: %', msg; end if;
end $$;

create function tests.throws(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  return true;
end $$;

-- returns affected row count of a dml statement (0 when RLS silently filters)
create function tests.affected(stmt text) returns int language plpgsql as $$
declare n int;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

\set coach_a '''aaaaaaaa-0000-0000-0000-000000000001'''
\set coach_b '''bbbbbbbb-0000-0000-0000-000000000002'''
\set athlete '''cccccccc-0000-0000-0000-000000000003'''
\set physio  '''dddddddd-0000-0000-0000-000000000004'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:coach_a, 'coach.a@example.com', '{"full_name":"Coach A"}'),
  (:coach_b, 'coach.b@example.com', '{"full_name":"Coach B"}'),
  (:athlete, 'athlete.x@example.com', '{"full_name":"Athlete X","locale":"he"}'),
  (:physio,  'physio.p@example.com', '{}');

select tests.check((select count(*) from public.profiles) = 4, 'profile created for every auth user');
select tests.check((select locale from public.profiles where id = :athlete) = 'he', 'locale copied from signup metadata');

-- ----- onboarding ----------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = :coach_a;
select public.complete_onboarding('sc_coach', 'Coach A');
select tests.check((select code from public.coach_codes where status = 'active') ~ '^P360-[A-Z0-9]{6}$', 'coach A got a code');
select tests.throws($$select public.complete_onboarding('athlete', 'Coach A')$$) as role_change_blocked \gset
select tests.check(:'role_change_blocked'::boolean, 'role cannot be switched after onboarding');
select tests.throws($$update public.profiles set is_platform_admin = true where id = auth.uid()$$) as admin_blocked \gset
select tests.check(:'admin_blocked'::boolean, 'users cannot make themselves platform admin');
select tests.throws($$update public.profiles set role = 'athlete' where id = auth.uid()$$) as role_col_blocked \gset
select tests.check(:'role_col_blocked'::boolean, 'role column is not directly writable');
update public.profiles set units = 'imperial' where id = auth.uid();
select tests.check((select units from public.profiles where id = auth.uid()) = 'imperial', 'allowed profile fields are writable');
select code as coach_a_code from public.coach_codes where status = 'active' \gset

set request.jwt.claim.sub = :coach_b;
select public.complete_onboarding('performance_coach', 'Coach B');
select code as coach_b_code from public.coach_codes where status = 'active' \gset
select tests.check((select count(*) from public.coach_codes) = 1, 'coaches only see their own codes');

set request.jwt.claim.sub = :physio;
select public.complete_onboarding('physiotherapist', 'Physio P');
select code as physio_code from public.coach_codes where status = 'active' \gset

set request.jwt.claim.sub = :athlete;
select public.complete_onboarding('athlete', 'Athlete X');
select tests.check((select count(*) from public.coach_codes) = 0, 'athletes have no code');
select tests.throws($$select public.regenerate_coach_code()$$) as athlete_code_blocked \gset
select tests.check(:'athlete_code_blocked'::boolean, 'athletes cannot generate a code');
select tests.check((select count(*) from public.athletes) = 0, 'athlete sees no records before connecting');
select tests.throws($$insert into public.athletes (owner_coach_id, full_name) values (auth.uid(), 'Fake')$$) as athlete_insert_blocked \gset
select tests.check(:'athlete_insert_blocked'::boolean, 'athletes cannot create athlete records');

-- ----- coach-created athletes are private -----------------------------------
set request.jwt.claim.sub = :coach_a;
insert into public.athletes (owner_coach_id, full_name, email, sport) values (auth.uid(), 'Roster Only', 'roster@example.com', 'football');
select tests.check((select count(*) from public.athletes) = 1, 'coach A sees their created athlete');
select tests.check((select count(*) from public.coach_athlete_relationships where kind = 'primary') = 1, 'creating an athlete makes coach A primary');
select id as roster_id from public.athletes where full_name = 'Roster Only' \gset

set request.jwt.claim.sub = :coach_b;
select tests.check((select count(*) from public.athletes) = 0, 'coach B cannot see coach A athletes');
select tests.check(tests.affected(format('update public.athletes set sport = %L where id = %L', 'hacked', :'roster_id')) = 0, 'coach B cannot update coach A athlete');
select tests.throws(format($$insert into public.athletes (owner_coach_id, full_name) values (%L, 'Spoof')$$, :coach_a)) as spoof_blocked \gset
select tests.check(:'spoof_blocked'::boolean, 'coach B cannot create athletes on behalf of coach A');
select tests.throws(format($$insert into public.coach_athlete_relationships (coach_id, athlete_id) values (auth.uid(), %L)$$, :'roster_id')) as rel_insert_blocked \gset
select tests.check(:'rel_insert_blocked'::boolean, 'relationships cannot be inserted directly');
select tests.throws(format($$insert into public.test_results (athlete_id, test_id, trials) select %L, id, '{40}' from public.test_definitions limit 1$$, :'roster_id')) as test_spoof_blocked \gset
select tests.check(:'test_spoof_blocked'::boolean, 'coach B cannot record tests for coach A athlete');

-- ----- invitation code flow --------------------------------------------------
set request.jwt.claim.sub = :athlete;
select tests.check((select coach_name from public.preview_coach_code(lower(:'coach_a_code'))) = 'Coach A', 'preview shows coach public name (case-insensitive)');
select tests.check((select count(*) from public.preview_coach_code('P360-ZZZZZZ')) = 0, 'unknown code previews nothing');
select tests.check(public.connect_with_coach_code('P360-ZZZZZZ') = 'invalid_code', 'unknown code is rejected');
select tests.check(public.connect_with_coach_code(:'coach_a_code') = 'connected', 'athlete connects to coach A');
select tests.check(public.connect_with_coach_code(:'coach_a_code') = 'already_connected', 'duplicate connection prevented');
select tests.check((select count(*) from public.athletes where user_id = auth.uid()) = 1, 'athlete record created once');
select id as athlete_rec from public.athletes where user_id = auth.uid() \gset
select tests.throws(format($$update public.athletes set user_id = null where id = %L$$, :'athlete_rec')) as unlink_blocked \gset
select tests.check(:'unlink_blocked'::boolean, 'athlete cannot change account link directly');
select tests.throws(format($$update public.athletes set status = 'archived' where id = %L$$, :'athlete_rec')) as self_archive_blocked \gset
select tests.check(:'self_archive_blocked'::boolean, 'athlete cannot archive their own record');
update public.athletes set short_term_goals = 'Run faster' where id = :'athlete_rec';

set request.jwt.claim.sub = :coach_a;
select tests.check((select count(*) from public.athletes) = 2, 'coach A now sees connected athlete');
select tests.check((select count(*) from public.notifications where kind = 'connection.new') = 1, 'coach A notified of new connection');
select tests.check((select count(*) from public.profiles where id = :athlete) = 1, 'coach A can read connected athlete profile');
select tests.check((select count(*) from public.profiles where id = :coach_b) = 0, 'coach A cannot read unrelated profiles');

-- regenerating a code keeps relationships
select public.regenerate_coach_code() as new_a_code \gset
select tests.check((select count(*) from public.athletes) = 2, 'regenerating code keeps existing athletes');

set request.jwt.claim.sub = :athlete;
select tests.check(public.connect_with_coach_code(:'coach_a_code') = 'invalid_code', 'revoked code no longer works');

-- ----- program assignment & athlete logging ---------------------------------
set request.jwt.claim.sub = :coach_a;
insert into public.training_programs (title, num_weeks) values ('Speed Block', 4);
select id as program_id from public.training_programs where title = 'Speed Block' \gset
insert into public.training_sessions (program_id, title, week_number, day_number) values (:'program_id', 'Accel day', 1, 1);
select id as session_id from public.training_sessions where program_id = :'program_id' \gset
insert into public.session_exercises (session_id, exercise_name, sets, reps) values (:'session_id', '10 m Acceleration Sprint', 6, '1');
insert into public.program_assignments (program_id, athlete_id, start_date) values (:'program_id', :'athlete_rec', current_date);
insert into public.test_results (athlete_id, test_id, trials)
  select :'athlete_rec', id, '{38.1,39.4,38.9}' from public.test_definitions where short_name = 'CMJ';

set request.jwt.claim.sub = :coach_b;
select tests.check((select count(*) from public.training_programs) = 0, 'coach B cannot see coach A programs');
select tests.check((select count(*) from public.training_sessions) = 0, 'coach B cannot see coach A sessions');
select tests.check(tests.affected(format('delete from public.training_sessions where id = %L', :'session_id')) = 0, 'coach B cannot delete coach A sessions');
insert into public.training_programs (title) values ('B program');
select id as b_program from public.training_programs where title = 'B program' \gset
insert into public.training_sessions (program_id, title) values (:'b_program', 'B session');
select id as b_session from public.training_sessions where program_id = :'b_program' \gset
select tests.throws(format($$insert into public.program_assignments (program_id, athlete_id, start_date) values (%L, %L, current_date)$$, :'b_program', :'athlete_rec')) as assign_blocked \gset
select tests.check(:'assign_blocked'::boolean, 'coach B cannot assign to an athlete they do not work with');

set request.jwt.claim.sub = :athlete;
select tests.check((select count(*) from public.training_programs) = 1, 'athlete sees assigned program');
select tests.check((select count(*) from public.session_exercises) = 1, 'athlete sees assigned exercises');
select tests.check((select count(*) from public.test_results) = 1, 'athlete sees own test results');
select tests.check((select count(*) from public.notifications where kind = 'program.assigned') = 1, 'athlete notified of assignment');
insert into public.workout_completions (session_id, athlete_id, session_rpe, duration_min) values (:'session_id', :'athlete_rec', 7, 45);
select tests.throws(format($$insert into public.workout_completions (session_id, athlete_id) values (%L, %L)$$, :'b_session', :'athlete_rec')) as unassigned_log_blocked \gset
select tests.check(:'unassigned_log_blocked'::boolean, 'athlete cannot log sessions from unassigned programs');
select tests.check(tests.affected(format($$update public.training_sessions set title = 'x' where id = %L$$, :'session_id')) = 0, 'athlete cannot edit the program');
select tests.throws(format($$insert into public.test_results (athlete_id, test_id, trials) select %L, id, '{60}' from public.test_definitions limit 1$$, :'athlete_rec')) as athlete_test_blocked \gset
select tests.check(:'athlete_test_blocked'::boolean, 'athlete cannot self-record official test results');
insert into public.readiness_entries (athlete_id, sleep_hours, fatigue, soreness) values (:'athlete_rec', 7.5, 2, 3);

set request.jwt.claim.sub = :coach_a;
select tests.check((select count(*) from public.workout_completions) = 1, 'coach sees athlete completion');
select tests.check((select count(*) from public.readiness_entries) = 1, 'coach sees athlete readiness');
select tests.throws(format($$insert into public.readiness_entries (athlete_id, entry_date) values (%L, current_date - 1)$$, :'athlete_rec')) as coach_readiness_blocked \gset
select tests.check(:'coach_readiness_blocked'::boolean, 'readiness is athlete-reported only');

-- ----- collaborator (physio) access ------------------------------------------
set request.jwt.claim.sub = :athlete;
select tests.check(public.connect_with_coach_code(:'physio_code') = 'connected', 'athlete connects physio as collaborator');

set request.jwt.claim.sub = :physio;
select tests.check((select count(*) from public.athletes) = 1, 'physio sees only the athlete who shared access');
insert into public.athlete_notes (athlete_id, body) values (:'athlete_rec', 'Hamstring loading progressing');
select tests.throws(format($$update public.athletes set status = 'archived' where id = %L$$, :'athlete_rec')) as physio_archive_blocked \gset
select tests.check(:'physio_archive_blocked'::boolean or (select status from public.athletes where id = :'athlete_rec') = 'active', 'collaborator cannot archive athlete');

set request.jwt.claim.sub = :athlete;
select tests.check((select count(*) from public.athlete_notes) = 0, 'private professional notes are hidden from athlete');

-- ----- transfer between coaches ---------------------------------------------
select tests.check(public.connect_with_coach_code(:'coach_b_code') = 'needs_transfer_confirmation', 'transfer needs explicit confirmation');
set request.jwt.claim.sub = :coach_b;
select tests.check((select count(*) from public.athletes) = 0, 'no access before transfer is confirmed');
set request.jwt.claim.sub = :athlete;
select tests.check(public.connect_with_coach_code(:'coach_b_code', true) = 'connected', 'transfer confirmed');

set request.jwt.claim.sub = :coach_b;
select tests.check((select count(*) from public.athletes) = 1, 'coach B sees athlete after transfer');
set request.jwt.claim.sub = :coach_a;
select tests.check((select count(*) from public.athletes) = 1, 'coach A loses access after transfer (keeps own roster athlete)');
select tests.check((select count(*) from public.coach_athlete_relationships where status = 'ended') = 1, 'ended relationship is kept as history');
set request.jwt.claim.sub = :physio;
select tests.check((select count(*) from public.athletes) = 1, 'collaborator unaffected by primary transfer');

-- ----- archive keeps history -------------------------------------------------
set request.jwt.claim.sub = :coach_a;
update public.athletes set status = 'archived' where id = :'roster_id';
select tests.check((select archived_at is not null from public.athletes where id = :'roster_id'), 'archiving stamps archived_at');
select tests.check(tests.affected(format('delete from public.athletes where id = %L', :'roster_id')) = 0, 'athletes cannot be hard-deleted');

-- ----- linking an existing coach-created record by email --------------------
reset role;
insert into auth.users (id, email) values ('eeeeeeee-0000-0000-0000-000000000005', 'roster2@example.com');
set role authenticated;
set request.jwt.claim.sub = :coach_a;
insert into public.athletes (owner_coach_id, full_name, email) values (auth.uid(), 'Roster Two', 'Roster2@example.com');
set request.jwt.claim.sub = 'eeeeeeee-0000-0000-0000-000000000005';
select public.complete_onboarding('athlete', 'Roster Two');
select tests.check(public.connect_with_coach_code(:'new_a_code') = 'already_connected', 'existing coach-created record is linked, not duplicated');
select tests.check((select count(*) from public.athletes where user_id = auth.uid()) = 1, 'linked record visible to athlete');
reset role;
select tests.check((select count(*) from public.athletes where lower(email) = 'roster2@example.com') = 1, 'no duplicate athlete created');

-- ----- anonymous users see nothing -------------------------------------------
set role anon;
reset request.jwt.claim.sub;
select tests.check((select count(*) from public.athletes) = 0, 'anon sees no athletes');
select tests.check((select count(*) from public.exercises) = 0, 'anon sees no exercises');
reset role;

select tests.check((select count(*) from public.audit_log where action = 'connection.created') = 3, 'connections are audit-logged');
select tests.check((select count(*) from public.audit_log where action = 'athlete.account_linked') = 1, 'account links are audit-logged');
