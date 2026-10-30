-- Return-to-play injuries: who can report, move stages, record clearance, and who sees what.

\set dir    '''66660000-0000-0000-0000-000000000001'''
\set head   '''66660000-0000-0000-0000-000000000002'''
\set asst   '''66660000-0000-0000-0000-000000000003'''
\set physio '''66660000-0000-0000-0000-000000000004'''
\set ath    '''66660000-0000-0000-0000-000000000005'''
\set other  '''66660000-0000-0000-0000-000000000006'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:dir, 'dir@inj.test', '{}'), (:head, 'head@inj.test', '{}'), (:asst, 'asst@inj.test', '{}'),
  (:physio, 'physio@inj.test', '{}'), (:ath, 'ath@inj.test', '{}'), (:other, 'other@inj.test', '{}');

set role authenticated;
set request.jwt.claim.sub = :dir;
select public.create_organization('Injury FC', 'football', 'Dir Inj');
select public.create_staff_invite('head_coach') as i1 \gset
select public.create_staff_invite('head_coach') as i2 \gset
select public.create_staff_invite('physiotherapist') as i3 \gset
select code as team_code from public.organization_codes where kind = 'athlete' and status = 'active' \gset
set request.jwt.claim.sub = :head;
select public.join_organization(:'i1', 'Head Inj');
set request.jwt.claim.sub = :asst;
select public.join_organization(:'i2', 'Asst Inj');
set request.jwt.claim.sub = :physio;
select public.join_organization(:'i3', 'Physio Inj');
set request.jwt.claim.sub = :other;
select public.complete_onboarding('athlete', 'Other Athlete');
set request.jwt.claim.sub = :ath;
select public.complete_onboarding('athlete', 'Inj Athlete');
select public.connect_with_org_code(:'team_code');
select id as rec from public.athletes where user_id = auth.uid() \gset

-- ----- the athlete reports -----------------------------------------------------
select public.report_injury(:'rec', 'hamstring', 'left', 'muscle', 'non_contact', 'minor', current_date, 'self diagnosis', current_date + 5, 'Felt a pull') as inj \gset
select tests.check((select stage from public.injuries where id = :'inj') = 'rest', 'a new injury starts at rest');
select tests.check((select diagnosis from public.injuries where id = :'inj') is null, 'athlete cannot set a diagnosis');
select tests.check((select expected_return from public.injuries where id = :'inj') is null, 'athlete cannot set an expected return');
select tests.check((select count(*) from public.injury_events where injury_id = :'inj' and kind = 'reported') = 1, 'report creates a timeline entry');
select tests.throws(format($$select public.set_injury_stage(%L, 'rehab', null)$$, :'inj')) as ath_stage \gset
select tests.check(:'ath_stage'::boolean, 'athlete cannot change the stage');
select public.add_injury_note(:'inj', 'Feels better today');
select tests.check((select count(*) from public.injury_events where injury_id = :'inj') = 2, 'athlete can add a note');
select tests.throws($$insert into public.injuries (athlete_id, body_area) select id, 'knee' from public.athletes$$) as direct_ins \gset
select tests.check(:'direct_ins'::boolean, 'tables cannot be written to directly');

-- ----- another athlete cannot report on this record -------------------------------
set request.jwt.claim.sub = :other;
select tests.throws(format($$select public.report_injury(%L, 'knee', null, null, null, null, null, null, null, null)$$, :'rec')) as stranger_report \gset
select tests.check(:'stranger_report'::boolean, 'another athlete cannot report on this athlete');
select tests.check((select count(*) from public.injuries) = 0, 'a stranger sees no injuries');

-- ----- staff -----------------------------------------------------------------------
set request.jwt.claim.sub = :asst;
select tests.check((select count(*) from public.injuries) = 1, 'a second coach sees the injury');
select public.set_injury_stage(:'inj', 'rehab', 'Started physio');
select tests.check((select stage from public.injuries where id = :'inj') = 'rehab', 'a second coach can advance the stage');
select public.update_injury_details(:'inj', 'Grade 1 hamstring strain', current_date + 14, 'minor');
select tests.check((select diagnosis from public.injuries where id = :'inj') = 'Grade 1 hamstring strain', 'staff can record the diagnosis');

set request.jwt.claim.sub = :head;
select tests.throws(format($$select public.set_injury_stage(%L, 'cleared', '')$$, :'inj')) as no_note \gset
select tests.check(:'no_note'::boolean, 'clearance needs a written basis');
select public.set_injury_stage(:'inj', 'running', null);
select public.set_injury_stage(:'inj', 'cleared', 'Passed hop and strength tests');
select tests.check((select status from public.injuries where id = :'inj') = 'resolved', 'clearance resolves the injury');
select tests.check((select resolved_on from public.injuries where id = :'inj') = current_date, 'clearance date is stored');
select tests.check((select author_role from public.injury_events where kind = 'cleared') = 'head_coach', 'the clearing role is recorded');

-- reopening
select public.set_injury_stage(:'inj', 'modified', 'Tightness came back');
select tests.check((select status from public.injuries where id = :'inj') = 'open', 'moving back reopens the injury');
select tests.check((select count(*) from public.injury_events where kind = 'reopened') = 1, 'reopening is on the timeline');

set request.jwt.claim.sub = :physio;
select public.set_injury_stage(:'inj', 'cleared', 'Physio assessment complete');
select tests.check((select status from public.injuries where id = :'inj') = 'resolved', 'physiotherapist can record clearance');

-- ----- the academy owner is a coach ------------------------------------------------
set request.jwt.claim.sub = :dir;
select tests.check((select count(*) from public.injuries) = 1, 'the owner reads injuries');
select tests.check((select count(*) from public.injury_events) >= 1, 'the owner reads the timeline');

-- ----- notifications and audit -----------------------------------------------------
reset role;
select tests.check(exists (select 1 from public.notifications where user_id = :ath and kind = 'injury.update'), 'athlete is notified of stage changes');
select tests.check(exists (select 1 from public.audit_log where action = 'injury.cleared'), 'clearance is audited');

-- ----- anonymous --------------------------------------------------------------------
set role anon;
select tests.throws($$select public.report_injury(gen_random_uuid(), 'knee', null, null, null, null, null, null, null, null)$$) as anon_rep \gset
reset role;
select tests.check(:'anon_rep'::boolean, 'anonymous users cannot report injuries');
