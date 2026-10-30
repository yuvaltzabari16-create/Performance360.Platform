-- The academy owner's access and in-app messages.

\set dir    '''99990000-0000-0000-0000-000000000001'''
\set hop    '''99990000-0000-0000-0000-000000000002'''
\set ath    '''99990000-0000-0000-0000-000000000003'''
\set out    '''99990000-0000-0000-0000-000000000004'''
\set pt     '''99990000-0000-0000-0000-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:dir, 'dir@dm.test', '{}'), (:hop, 'hop@dm.test', '{}'), (:ath, 'ath@dm.test', '{}'), (:out, 'out@dm.test', '{}'), (:pt, 'pt@dm.test', '{}');

set role authenticated;
set request.jwt.claim.sub = :dir;
select public.create_organization('DM FC', null, 'Dir Dm');
select public.create_staff_invite('head_coach') as i1 \gset
select code as team_code from public.organization_codes where kind = 'athlete' and status = 'active' \gset
set request.jwt.claim.sub = :hop;
select public.join_organization(:'i1', 'Hop Dm');
set request.jwt.claim.sub = :ath;
select public.complete_onboarding('athlete', 'Dm Athlete');
select public.connect_with_org_code(:'team_code');
select id as rec from public.athletes where user_id = auth.uid() \gset
select public.report_injury(:'rec', 'knee', null, null, null, null, null, null, null, 'Sore') as inj \gset
set request.jwt.claim.sub = :out;
select public.complete_onboarding('athlete', 'Outside Athlete');
select public.ensure_my_athlete_record();
set request.jwt.claim.sub = :pt;
select public.complete_onboarding('personal_trainer', 'Paul Dm');

-- a program for the roster athlete
set request.jwt.claim.sub = :hop;
insert into public.training_programs (coach_id, title) values (:hop, 'Pre-season') returning id as prog \gset
insert into public.training_sessions (program_id, week_number, day_number, title) values (:'prog', 1, 1, 'Day one') returning id as sess \gset
insert into public.program_assignments (program_id, athlete_id, assigned_by, start_date) values (:'prog', :'rec', :hop, current_date);
insert into public.athlete_notes (athlete_id, body) values (:'rec', 'Private coach note');
insert into public.session_exercises (session_id, exercise_id, exercise_name, position)
  select :'sess', id, name, 1 from public.exercises limit 1;

-- ----- the owner coach reads and works with the roster -----------------------------------
set request.jwt.claim.sub = :dir;
select tests.check((select count(*) from public.athletes) = 1, 'the owner reads roster athletes');
select tests.check((select count(*) from public.athletes where full_name = 'Outside Athlete') = 0, 'the owner does not read athletes outside the academy');
select tests.check((select count(*) from public.injuries) = 1, 'the owner reads injuries');
select tests.check((select count(*) from public.program_assignments) = 1, 'the owner sees the schedule');
select tests.check((select count(*) from public.training_programs) = 1, 'the owner sees a colleague''s program assigned in the academy');
select tests.check((select count(*) from public.session_exercises) = 1, 'the owner sees its session contents');
select tests.check((select count(*) from public.athlete_notes) = 1, 'the owner reads coach notes');
select tests.check((select count(*) from public.test_results) = 0, 'no test results recorded yet');
select tests.check((select count(*) from public.exercises) > 300, 'the owner uses the exercise library');
select tests.check(tests.affected(format($$update public.training_programs set title = 'x' where id = %L$$, :'prog')) = 0, 'the owner cannot edit a colleague''s program');
set request.jwt.claim.sub = :hop;
select tests.check((select count(*) from public.training_programs) = 1, 'a coach who is not an owner sees only their own programs');
set request.jwt.claim.sub = :dir;
select tests.check(tests.affected(format($$update public.athletes set sport = 'x' where id = %L$$, :'rec')) = 1, 'the owner edits roster athletes as a lead coach');

-- ----- messages -----------------------------------------------------------------------
select tests.check((select count(*) from public.message_contacts()) = 2, 'the owner can message staff and roster athletes');
select public.send_message(:ath, 'Welcome to the club') as m1 \gset
select tests.throws(format($$select public.send_message(%L, 'hi')$$, :'out')) as to_outsider \gset
select tests.check(:'to_outsider'::boolean, 'cannot message someone outside the team');
select tests.throws($$select public.send_message(gen_random_uuid(), 'hi')$$) as to_nobody \gset
select tests.check(:'to_nobody'::boolean, 'cannot message an unknown user');
select tests.throws(format($$select public.send_message(%L, '   ')$$, :'ath')) as empty_msg \gset
select tests.check(:'empty_msg'::boolean, 'empty messages are rejected');

set request.jwt.claim.sub = :ath;
select tests.check((select count(*) from public.direct_messages) = 1, 'athlete receives the message');
select tests.check((select count(*) from public.notifications where kind = 'message') = 1, 'recipient is notified');
select public.mark_messages_read(:dir);
select tests.check((select read_at is not null from public.direct_messages), 'messages can be marked read');
select public.send_message(:dir, 'Thanks');
select tests.check((select count(*) from public.message_contacts()) = 2, 'athlete can message the staff of their team');

set request.jwt.claim.sub = :out;
select tests.check((select count(*) from public.direct_messages) = 0, 'outsiders read none of it');
select tests.throws(format($$insert into public.direct_messages (sender_id, recipient_id, body) values (%L, %L, 'x')$$, :'out', :'ath')) as direct_ins \gset
select tests.check(:'direct_ins'::boolean, 'messages cannot be written directly');

set request.jwt.claim.sub = :hop;
select tests.check((select count(*) from public.direct_messages) = 0, 'a third team member does not read others messages');

-- a personal trainer and their connected athlete can talk
set request.jwt.claim.sub = :pt;
select tests.check((select count(*) from public.message_contacts()) = 0, 'a trainer with no athletes has no contacts');

set role anon;
select tests.throws($$select public.send_message(gen_random_uuid(), 'x')$$) as anon_send \gset
reset role;
select tests.check(:'anon_send'::boolean, 'anonymous cannot send messages');
