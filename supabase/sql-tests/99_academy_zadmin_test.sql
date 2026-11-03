-- Management page: activity visibility and platform admin.
\set z_own '''d4c0de00-0000-4000-8000-000000000001'''
\set z_ath '''d4c0de00-0000-4000-8000-000000000002'''
\set z_oth '''d4c0de00-0000-4000-8000-000000000003'''
insert into auth.users (id) values (:z_own), (:z_ath), (:z_oth);
set role authenticated;
set request.jwt.claim.sub = :z_own;
select academy_id as zaid, member_id as zown from public.acad_create_academy('Admin Club', 'Owner') \gset
select login_code as zath from public.acad_add_member(:'zaid', 'athlete', 'Athlete One') \gset
select public.acad_touch(:'zaid');
select tests.check((select count(*) = 2 from public.acad_activity(:'zaid')), 'the owner sees everyone''s activity');
select tests.check((select last_seen is not null from public.acad_activity(:'zaid') where role = 'owner'), 'opening the app records last seen');
select tests.throws($$select * from public.acad_platform_overview()$$) as z1 \gset
select tests.check(:'z1'::boolean, 'an academy owner is not a platform admin');
set request.jwt.claim.sub = :z_ath;
select public.acad_enter(:'zath');
select tests.check((select count(*) = 1 from public.acad_activity(:'zaid')), 'an athlete sees only their own activity');
select tests.throws(format($$select public.acad_platform_set_plan(%L, 'active')$$, :'zaid')) as z2 \gset
select tests.check(:'z2'::boolean, 'athletes cannot change plans');
reset role;
insert into public.acad_platform_admins (member_id) values (:'zown');
set role authenticated;
set request.jwt.claim.sub = :z_own;
select tests.check((select count(*) >= 1 from public.acad_platform_overview() where name = 'Admin Club' and members = 2), 'the platform admin sees academies and member counts');
select public.acad_platform_set_plan(:'zaid', 'active');
select tests.check((select plan = 'active' and paid_until is null from public.acad_platform_overview() where id = :'zaid'), 'the platform admin activates an academy with no end date');
select public.acad_platform_set_plan(:'zaid', 'trial', null, 14);
select tests.check((select plan = 'trial' and trial_ends_at > now() + interval '40 days' from public.acad_platform_overview() where id = :'zaid'), 'extending a trial adds days');
reset role;
