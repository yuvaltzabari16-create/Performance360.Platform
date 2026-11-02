-- Academy updates feed and AI allowance.
\set u_own '''b2c0de00-0000-4000-8000-000000000001'''
\set u_ath '''b2c0de00-0000-4000-8000-000000000002'''
\set u_co  '''b2c0de00-0000-4000-8000-000000000003'''
insert into auth.users (id) values (:u_own), (:u_ath), (:u_co);
set role authenticated;
set request.jwt.claim.sub = :u_own;
select academy_id as aid from public.acad_create_academy('Updates Club', 'Owner') \gset
select login_code as athcode from public.acad_add_member(:'aid', 'athlete', 'Ath') \gset
select login_code as cocode from public.acad_add_member(:'aid', 'coach', 'Co') \gset
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'updates/u1', '{"title":"Practice moved"}');
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'staffupdates/s1', '{"title":"Staff meeting"}');
select tests.check(public.acad_ai_allow(:'aid'), 'the owner may use the AI');
set request.jwt.claim.sub = :u_ath;
select public.acad_enter(:'athcode');
select tests.check((select count(*) = 1 from public.acad_docs where path like 'updates/%'), 'athletes read updates');
select tests.check((select count(*) = 0 from public.acad_docs where path like 'staffupdates/%'), 'athletes cannot read staff updates');
select tests.throws(format($$insert into public.acad_docs (academy_id, path, data) values (%L, 'updates/x', '{}')$$, :'aid')) as t1 \gset
select tests.check(:'t1'::boolean, 'athletes cannot post updates');
select tests.check(not public.acad_ai_allow(:'aid'), 'athletes cannot use the AI provider');
set request.jwt.claim.sub = :u_co;
select public.acad_enter(:'cocode');
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'updates/u2', '{"title":"Bring water"}');
select tests.check((select count(*) = 3 from public.acad_docs where path like 'updates/%' or path like 'staffupdates/%'), 'coaches post and read all updates');
select tests.throws($$select * from public.acad_ai_usage$$) as t2 \gset
select tests.check(:'t2'::boolean, 'nobody reads AI usage directly');
reset role;
