-- Messages and return-to-play. Runs after 10_access_control_test.sql and reuses
-- its users. State at this point: the athlete is connected to Coach B (primary)
-- and the physio (collaborator); Coach A's relationship ended in the transfer.

\set coach_a '''aaaaaaaa-0000-0000-0000-000000000001'''
\set coach_b '''bbbbbbbb-0000-0000-0000-000000000002'''
\set athlete '''cccccccc-0000-0000-0000-000000000003'''
\set physio  '''dddddddd-0000-0000-0000-000000000004'''

reset role;
select id as athlete_rec from public.athletes where user_id = :athlete \gset
set role authenticated;

-- ----- messages ---------------------------------------------------------------
set request.jwt.claim.sub = :coach_b;
insert into public.messages (athlete_id, coach_id, body) values (:'athlete_rec', auth.uid(), 'Session moved to 17:00');
select tests.check((select count(*) from public.messages) = 1, 'coach B sees their thread');
select tests.throws(format($$insert into public.messages (athlete_id, coach_id, sender_id, body) values (%L, auth.uid(), %L, 'spoof')$$, :'athlete_rec', :athlete)) as spoof_sender \gset
select tests.check(:'spoof_sender'::boolean, 'coach cannot send as the athlete');
select tests.throws(format($$insert into public.messages (athlete_id, coach_id, body) values (%L, auth.uid(), '   ')$$, :'athlete_rec')) as blank_blocked \gset
select tests.check(:'blank_blocked'::boolean, 'blank messages are rejected');

set request.jwt.claim.sub = :athlete;
select tests.check((select count(*) from public.notifications where kind = 'message.new') = 1, 'athlete notified of new message');
select tests.check((select count(*) from public.messages where read_at is null) = 1, 'message unread before opening');
insert into public.messages (athlete_id, coach_id, body) values (:'athlete_rec', :coach_b, 'OK, see you then');
select tests.check(public.mark_thread_read(:'athlete_rec', :coach_b) = 1, 'athlete marks only the coach message as read');
select tests.check((select count(*) from public.messages where sender_id = auth.uid() and read_at is not null) = 0, 'own message stays unread for the coach');
select tests.check(tests.affected(format($$update public.messages set body = 'edited' where athlete_id = %L$$, :'athlete_rec')) = 0
  or tests.throws(format($$update public.messages set body = 'edited' where athlete_id = %L$$, :'athlete_rec')), 'messages cannot be edited');
select tests.check(tests.affected(format($$delete from public.messages where athlete_id = %L$$, :'athlete_rec')) = 0, 'messages cannot be deleted');
select tests.throws(format($$insert into public.messages (athlete_id, coach_id, body) values (%L, %L, 'hi coach A')$$, :'athlete_rec', :coach_a)) as ended_pair_blocked \gset
select tests.check(:'ended_pair_blocked'::boolean, 'no messages to a coach whose relationship ended');

set request.jwt.claim.sub = :coach_a;
select tests.check((select count(*) from public.messages) = 0, 'ended coach cannot read messages');
select tests.throws(format($$insert into public.messages (athlete_id, coach_id, body) values (%L, auth.uid(), 'still here?')$$, :'athlete_rec')) as ended_coach_blocked \gset
select tests.check(:'ended_coach_blocked'::boolean, 'ended coach cannot write');
select tests.throws(format($$select public.mark_thread_read(%L, %L)$$, :'athlete_rec', :coach_b)) as other_thread_read_blocked \gset
select tests.check(:'other_thread_read_blocked'::boolean, 'cannot mark another coach thread as read');

set request.jwt.claim.sub = :physio;
select tests.check((select count(*) from public.messages) = 0, 'physio does not see coach B thread');
insert into public.messages (athlete_id, coach_id, body) values (:'athlete_rec', auth.uid(), 'How is the hamstring today?');
select tests.check((select count(*) from public.messages) = 1, 'physio has their own thread with the athlete');

set request.jwt.claim.sub = :coach_b;
select tests.check(public.mark_thread_read(:'athlete_rec', auth.uid()) = 1, 'coach reads athlete reply');
select tests.check((select count(*) from public.messages) = 2, 'coach B does not see physio thread');

-- ----- return-to-play ---------------------------------------------------------
set request.jwt.claim.sub = :physio;
insert into public.rtp_plans (athlete_id, title, context) values (:'athlete_rec', 'Hamstring return to play', 'Grade 1 strain, right side');
select id as plan_id from public.rtp_plans where athlete_id = :'athlete_rec' \gset
insert into public.rtp_phases (plan_id, position, title, criteria) values
  (:'plan_id', 1, 'Protection', '{"Pain-free walking"}'),
  (:'plan_id', 2, 'Loading', '{"Isometric strength within 10% of left"}');
select id as phase1 from public.rtp_phases where plan_id = :'plan_id' and position = 1 \gset
insert into public.rtp_phase_exercises (phase_id, name, prescription) values (:'phase1', 'Isometric bridge', '5 x 10 s');
select id as ex1 from public.rtp_phase_exercises where phase_id = :'phase1' \gset
select tests.throws(format($$insert into public.rtp_phases (plan_id, position, title, status) values (%L, 3, 'Skip', 'cleared')$$, :'plan_id')) as insert_cleared_blocked \gset
select tests.check(:'insert_cleared_blocked'::boolean, 'a phase cannot be created already cleared');
select tests.throws(format($$update public.rtp_phases set status = 'cleared' where id = %L$$, :'phase1')) as direct_status_blocked \gset
select tests.check(:'direct_status_blocked'::boolean, 'phase status cannot be written directly');

set request.jwt.claim.sub = :athlete;
select tests.check((select count(*) from public.rtp_phases) = 2, 'athlete sees their plan');
select tests.throws(format($$select public.log_rtp_exercise(%L)$$, :'ex1')) as log_locked_blocked \gset
select tests.check(:'log_locked_blocked'::boolean, 'athlete cannot log exercises in a phase that has not started');
select tests.throws(format($$select public.set_rtp_phase_status(%L, 'in_progress')$$, :'phase1')) as athlete_start_blocked \gset
select tests.check(:'athlete_start_blocked'::boolean, 'athlete cannot start phases');
select tests.throws(format($$insert into public.rtp_plans (athlete_id, title) values (%L, 'Self plan')$$, :'athlete_rec')) as athlete_plan_blocked \gset
select tests.check(:'athlete_plan_blocked'::boolean, 'athlete cannot create plans');

set request.jwt.claim.sub = :coach_a;
select tests.check((select count(*) from public.rtp_plans) = 0, 'ended coach cannot see the rehab plan');
select tests.throws(format($$select public.set_rtp_phase_status(%L, 'in_progress')$$, :'phase1')) as ended_coach_status_blocked \gset
select tests.check(:'ended_coach_status_blocked'::boolean, 'ended coach cannot change phases');

set request.jwt.claim.sub = :physio;
select tests.throws(format($$select public.set_rtp_phase_status(%L, 'cleared', 'Dana')$$, :'phase1')) as skip_blocked \gset
select tests.check(:'skip_blocked'::boolean, 'a locked phase cannot be cleared without starting it');
select public.set_rtp_phase_status(:'phase1', 'in_progress');
select tests.throws(format($$select public.set_rtp_phase_status(%L, 'cleared')$$, :'phase1')) as unnamed_blocked \gset
select tests.check(:'unnamed_blocked'::boolean, 'clearing requires the name of the professional');

set request.jwt.claim.sub = :athlete;
select public.log_rtp_exercise(:'ex1');
select tests.check((select times_done from public.rtp_phase_exercises where id = :'ex1') = 1, 'athlete logs exercise in a started phase');

set request.jwt.claim.sub = :physio;
select public.set_rtp_phase_status(:'phase1', 'cleared', 'Dana Levi', 'Physiotherapist', 'Pain-free walking confirmed');
select tests.check((select status = 'cleared' and cleared_by_name = 'Dana Levi' and recorded_by = auth.uid() from public.rtp_phases where id = :'phase1'), 'clearance records name and recorder');

set request.jwt.claim.sub = :coach_b;
select tests.check((select count(*) from public.rtp_phases where status = 'cleared') = 1, 'primary coach sees the recorded clearance');
select public.set_rtp_phase_status(:'phase1', 'in_progress');
select tests.check((select cleared_by_name is null and cleared_at is null from public.rtp_phases where id = :'phase1'), 'reopening withdraws the clearance');

-- ----- ending a relationship revokes access to existing threads and plans ---
set request.jwt.claim.sub = :physio;
select tests.check((select count(*) from public.messages) > 0 and (select count(*) from public.rtp_plans) = 1, 'physio has data before the relationship ends');
set request.jwt.claim.sub = :athlete;
select r.id as physio_rel from public.coach_athlete_relationships r where r.coach_id = :physio and r.status = 'active' \gset
select public.end_relationship(:'physio_rel');
set request.jwt.claim.sub = :physio;
select tests.check((select count(*) from public.messages) = 0, 'ended professional loses access to the existing thread');
select tests.check((select count(*) from public.rtp_plans) = 0, 'ended professional loses access to the rehab plan');
select tests.throws(format($$select public.set_rtp_phase_status(%L, 'locked')$$, :'phase1')) as ended_physio_blocked \gset
select tests.check(:'ended_physio_blocked'::boolean, 'ended professional cannot change phases');
set request.jwt.claim.sub = :athlete;
select tests.check((select count(*) from public.messages where coach_id = :physio) > 0, 'athlete keeps their thread history');

set role anon;
reset request.jwt.claim.sub;
select tests.check((select count(*) from public.rtp_plans) = 0, 'anon sees no rehab plans');
select tests.check((select count(*) from public.messages) = 0, 'anon sees no messages');
reset role;

select tests.check((select count(*) from public.audit_log where action = 'rtp.phase_cleared') = 1, 'clearance is audit-logged');
select tests.check((select count(*) from public.audit_log where action = 'rtp.phase_reopened') = 1, 'reopening is audit-logged');
