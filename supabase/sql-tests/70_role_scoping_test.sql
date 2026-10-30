-- Role scoping: the owner coach, a coach and the physiotherapist all use the library and build programs.

\set dir    '''77770000-0000-0000-0000-000000000001'''
\set hop    '''77770000-0000-0000-0000-000000000002'''
\set physio '''77770000-0000-0000-0000-000000000003'''
\set pt     '''77770000-0000-0000-0000-000000000004'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:dir, 'dir@scope.test', '{}'), (:hop, 'hop@scope.test', '{}'), (:physio, 'physio@scope.test', '{}'), (:pt, 'pt@scope.test', '{}');

set role authenticated;
set request.jwt.claim.sub = :dir;
select public.create_organization('Scope FC', null, 'Dir Scope');
select public.create_staff_invite('head_coach') as i1 \gset
select public.create_staff_invite('physiotherapist') as i2 \gset
set request.jwt.claim.sub = :hop;
select public.join_organization(:'i1', 'Hop Scope');
set request.jwt.claim.sub = :physio;
select public.join_organization(:'i2', 'Physio Scope');
set request.jwt.claim.sub = :pt;
select public.complete_onboarding('personal_trainer', 'Paul Scope');

set request.jwt.claim.sub = :dir;
select tests.check((select count(*) from public.exercises) > 300, 'the owner coach reads the exercise library');

set request.jwt.claim.sub = :hop;
select tests.check((select count(*) from public.exercises) > 300, 'a coach reads the library');
insert into public.training_programs (coach_id, title) values (:hop, 'HoP program');
select tests.check((select count(*) from public.training_programs where title = 'HoP program') = 1, 'a coach can write programs');

set request.jwt.claim.sub = :physio;
select tests.check((select count(*) from public.exercises) > 300, 'physiotherapist reads the library (rehab)');
insert into public.training_programs (coach_id, title) values (:physio, 'Rehab program');
select tests.check((select count(*) from public.training_programs where title = 'Rehab program') = 1, 'physiotherapist builds rehab programs');
insert into public.exercises (owner_id, name, category) values (:physio, 'Physio move', 'rehab');
select tests.check((select count(*) from public.exercises where name = 'Physio move') = 1, 'physiotherapist can add a rehab exercise');
set request.jwt.claim.sub = :dir;
insert into public.training_programs (coach_id, title) values (:dir, 'Owner program');
select tests.check((select count(*) from public.training_programs where title = 'Owner program') = 1, 'the owner coach writes programs');
set request.jwt.claim.sub = :physio;

set request.jwt.claim.sub = :pt;
insert into public.training_programs (coach_id, title) values (:pt, 'PT program');
select tests.check((select count(*) from public.training_programs where title = 'PT program') = 1, 'independent personal trainer writes programs');
