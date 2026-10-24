-- Team role scoping: director sees no library, physiotherapist writes no programs, head of performance does.

\set dir    '''77770000-0000-0000-0000-000000000001'''
\set hop    '''77770000-0000-0000-0000-000000000002'''
\set physio '''77770000-0000-0000-0000-000000000003'''
\set pt     '''77770000-0000-0000-0000-000000000004'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:dir, 'dir@scope.test', '{}'), (:hop, 'hop@scope.test', '{}'), (:physio, 'physio@scope.test', '{}'), (:pt, 'pt@scope.test', '{}');

set role authenticated;
set request.jwt.claim.sub = :dir;
select public.create_organization('Scope FC', null, 'Dir Scope');
select public.create_staff_invite('head_of_performance') as i1 \gset
select public.create_staff_invite('physiotherapist') as i2 \gset
set request.jwt.claim.sub = :hop;
select public.join_organization(:'i1', 'Hop Scope');
set request.jwt.claim.sub = :physio;
select public.join_organization(:'i2', 'Physio Scope');
set request.jwt.claim.sub = :pt;
select public.complete_onboarding('personal_trainer', 'Paul Scope');

set request.jwt.claim.sub = :dir;
select tests.check((select count(*) from public.exercises) = 0, 'director cannot read the exercise library');

set request.jwt.claim.sub = :hop;
select tests.check((select count(*) from public.exercises) > 300, 'head of performance reads the library');
insert into public.training_programs (coach_id, title) values (:hop, 'HoP program');
select tests.check((select count(*) from public.training_programs where title = 'HoP program') = 1, 'head of performance can write programs');

set request.jwt.claim.sub = :physio;
select tests.check((select count(*) from public.exercises) > 300, 'physiotherapist reads the library (rehab)');
select tests.throws(format($$insert into public.training_programs (coach_id, title) values (%L, 'Physio program')$$, :'physio')) as physio_prog \gset
select tests.check(:'physio_prog'::boolean, 'physiotherapist cannot write training programs');
select tests.throws(format($$insert into public.exercises (owner_id, name, category) values (%L, 'Physio move', 'rehab')$$, :'physio')) as physio_ex \gset
select tests.check(:'physio_ex'::boolean, 'physiotherapist cannot create library exercises');

set request.jwt.claim.sub = :pt;
insert into public.training_programs (coach_id, title) values (:pt, 'PT program');
select tests.check((select count(*) from public.training_programs where title = 'PT program') = 1, 'independent personal trainer writes programs');
