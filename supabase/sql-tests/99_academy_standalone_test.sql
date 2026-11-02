-- Standalone academy with personal-code sign-in: roles, document rules, devices, codes, removal, trial lock.

\set d_own   '''a1c0de00-0000-4000-8000-000000000001'''
\set d_own2  '''a1c0de00-0000-4000-8000-000000000002'''
\set d_coach '''a1c0de00-0000-4000-8000-000000000003'''
\set d_phys  '''a1c0de00-0000-4000-8000-000000000004'''
\set d_ath   '''a1c0de00-0000-4000-8000-000000000005'''
\set d_ath2  '''a1c0de00-0000-4000-8000-000000000006'''
\set d_other '''a1c0de00-0000-4000-8000-000000000007'''
\set d_stray '''a1c0de00-0000-4000-8000-000000000008'''

-- each "device" is an anonymous Supabase sign-in
insert into auth.users (id) values (:d_own), (:d_own2), (:d_coach), (:d_phys), (:d_ath), (:d_ath2), (:d_other), (:d_stray);
set role authenticated;

-- owner opens an academy and gets a personal code
set request.jwt.claim.sub = :d_own;
select academy_id as aid, member_id as own, login_code as owncode from public.acad_create_academy('Green Arc Academy', 'Owner One', 'Football') \gset
select tests.check((select count(*) = 1 from public.acad_whoami() where role = 'owner' and active), 'the owner device is signed in, trial active');
select tests.check(:'owncode' ~ '^[A-Z2-9]{8}$', 'personal codes are 8 easy characters');
select tests.check((select count(*) = 3 from public.acad_codes_list(:'aid')), 'the owner sees three shared join codes');
select code as acode from public.acad_codes_list(:'aid') where role = 'athlete' \gset
select code as ccode from public.acad_codes_list(:'aid') where role = 'coach' \gset
select code as pcode from public.acad_codes_list(:'aid') where role = 'physio' \gset
select tests.check((select (data ->> 'owner')::boolean from public.acad_docs where path = 'staff/' || :'own'), 'the owner has a staff profile under their member id');
select tests.throws($$select * from public.acad_members$$) as t1 \gset
select tests.check(:'t1'::boolean, 'nobody reads the members table directly');
select tests.throws($$select * from public.acad_sessions$$) as t2 \gset
select tests.check(:'t2'::boolean, 'nobody reads the sessions table directly');

-- coach and physio join with shared codes and get personal codes
set request.jwt.claim.sub = :d_coach;
select tests.check((select count(*) = 0 from public.acad_enter('WRONGCDE')), 'a wrong code signs nobody in');
select tests.check((select kind = 'join' and role = 'coach' from public.acad_enter(lower(:'ccode'))), 'a shared coach code asks to join, typed in lower case');
select tests.check((select count(*) = 0 from public.acad_whoami()), 'entering a shared code alone does not sign in');
select member_id as coach, login_code as coachcode from public.acad_join(:'ccode', 'Coach Two') \gset
select tests.check((select role = 'coach' from public.acad_whoami()), 'joining signs the coach in');
select tests.check((select data ->> 'role' = 'coach' from public.acad_docs where path = 'staff/' || :'coach'), 'the server creates the coach''s staff profile');
select tests.check((select count(*) = 1 from public.acad_codes_list(:'aid')), 'a coach sees only the athlete join code');
set request.jwt.claim.sub = :d_phys;
select member_id as phys from public.acad_join(:'pcode', 'Physio Three') \gset
select tests.check((select role = 'physio' from public.acad_whoami()), 'the physio code makes a physiotherapist');

-- a coach adds an athlete by name; the athlete signs in with only their personal code
set request.jwt.claim.sub = :d_coach;
select member_id as ath, login_code as athcode from public.acad_add_member(:'aid', 'athlete', 'Noa Athlete') \gset
select tests.check((select data ->> 'name' = 'Noa Athlete' from public.acad_docs where path = 'athletes/' || :'ath'), 'adding an athlete creates their profile');
select tests.throws(format($$select * from public.acad_add_member(%L, 'coach', 'Nope')$$, :'aid')) as t3 \gset
select tests.check(:'t3'::boolean, 'a coach cannot add staff');
select tests.check((select count(*) = 2 from public.acad_people(:'aid')), 'a coach sees athletes'' codes and their own');
set request.jwt.claim.sub = :d_ath;
select tests.check((select kind = 'member' and role = 'athlete' and member_id = :'ath' from public.acad_enter(:'athcode')), 'the athlete signs in with their personal code');
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'logs/' || :'ath', '{"workouts":{}}');
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'meals/' || :'ath' || '/items/m1', '{"date":"2026-11-02","kcal":500}');
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'data/users/' || :'ath' || '/prefs', '{"theme":"dark"}');
select tests.check((select count(*) = 4 from public.acad_docs where path like '%' || :'ath' || '%'), 'the athlete writes and reads their own records');
select tests.throws(format($$insert into public.acad_docs (academy_id, path, data) values (%L, 'plan/%s', '{}')$$, :'aid', :'ath')) as t4 \gset
select tests.check(:'t4'::boolean, 'an athlete cannot write their own plan');
select tests.check((select count(*) = 1 from public.acad_people(:'aid')), 'an athlete sees only their own code');

-- the same athlete on a second phone sees the same records
set request.jwt.claim.sub = :d_other;
select public.acad_enter(:'athcode');
select tests.check((select count(*) = 4 from public.acad_docs where path like '%' || :'ath' || '%'), 'a second phone with the same code sees the same records');

-- another athlete joins with the shared code
set request.jwt.claim.sub = :d_ath2;
select member_id as ath2 from public.acad_join(:'acode', 'Second Athlete') \gset
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'athletes/' || :'ath2', '{"name":"Second Athlete"}');
select tests.check((select count(*) = 0 from public.acad_docs where path like '%' || :'ath' || '%'), 'an athlete sees nothing of another athlete');
select tests.check((select count(*) = 1 from public.acad_docs where path = 'academy/settings'), 'athletes read the academy settings');
select tests.check((select count(*) filter (where role = 'athlete') = 1 from public.acad_member_names(:'aid')), 'athletes see staff names and themself only');
select tests.throws(format($$select public.acad_merge(%L, 'logs/%s', '{"x":1}')$$, :'aid', :'ath')) as t5 \gset
select tests.check(:'t5'::boolean, 'an athlete cannot change another athlete''s log');
select tests.throws(format($$select public.acad_reset_code(%L, %L)$$, :'aid', :'ath')) as t6 \gset
select tests.check(:'t6'::boolean, 'an athlete cannot reset another person''s code');

-- staff powers
set request.jwt.claim.sub = :d_coach;
select tests.check((select count(*) = 1 from public.acad_docs where path like 'meals/%'), 'a coach reads athletes'' meals');
select tests.check((select count(*) = 0 from public.acad_docs where path like 'data/users/%'), 'private preferences stay private from staff');
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'plan/' || :'ath', '{"sessions":{"s1":{"title":"Speed"}}}');
select public.acad_merge(:'aid', 'plan/' || :'ath', '{"sessions":{"s2":{"title":"Strength"},"s1":null}}');
select tests.check((select (data -> 'sessions' ? 's2') and not (data -> 'sessions' ? 's1') from public.acad_docs where path = 'plan/' || :'ath'), 'partial updates merge and null removes');
select tests.throws(format($$insert into public.acad_docs (academy_id, path, data) values (%L, 'payments/%s', '{}')$$, :'aid', :'ath')) as t7 \gset
select tests.check(:'t7'::boolean, 'coaches cannot write payments');
select tests.throws(format($$select public.acad_rotate_code(%L, 'coach')$$, :'aid')) as t8 \gset
select tests.check(:'t8'::boolean, 'coaches cannot change join codes');

-- a lost athlete code is reset: old code stops working, other phones are signed out
select public.acad_reset_code(:'aid', :'ath') as athcode2 \gset
set request.jwt.claim.sub = :d_other;
select tests.check((select count(*) = 0 from public.acad_whoami()), 'resetting a code signs that person out of other phones');
select tests.check((select count(*) = 0 from public.acad_enter(:'athcode')), 'the old personal code no longer works');
select tests.check((select count(*) = 1 from public.acad_enter(:'athcode2')), 'the new personal code works');

-- owner powers
set request.jwt.claim.sub = :d_own;
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'payments/' || :'ath', '{"charges":{"c1":{"amount":350}}}');
select tests.check((select count(*) = 5 from public.acad_people(:'aid')), 'the owner sees everyone''s code');
select public.acad_set_member_role(:'aid', :'phys', 'coach');
select tests.check((select role = 'coach' from public.acad_member_names(:'aid') where member_id = :'phys'), 'the owner changes a staff role');
set request.jwt.claim.sub = :d_coach;
select tests.check((select count(*) = 0 from public.acad_docs where path like 'payments/%'), 'coaches cannot read payments');

-- other academies are isolated
set request.jwt.claim.sub = :d_own2;
select academy_id as aid2 from public.acad_create_academy('Other Club', 'Owner Two') \gset
select tests.check((select count(*) = 0 from public.acad_docs where academy_id = :'aid'), 'another academy sees nothing of the first');

-- removal ends access at once
set request.jwt.claim.sub = :d_coach;
select public.acad_remove_member(:'aid', :'ath2');
set request.jwt.claim.sub = :d_ath2;
select tests.check((select count(*) = 0 from public.acad_docs), 'a removed athlete loses access immediately');
set request.jwt.claim.sub = :d_coach;
select tests.throws(format($$select public.acad_remove_member(%L, %L)$$, :'aid', :'phys')) as t9 \gset
select tests.check(:'t9'::boolean, 'coaches cannot remove staff');

-- trial lock
reset role;
update public.acad_academies set trial_ends_at = now() - interval '1 day' where id = :'aid';
set role authenticated;
set request.jwt.claim.sub = :d_other;
select tests.check((select count(*) > 0 from public.acad_docs), 'records stay readable after the trial ends');
select tests.throws(format($$insert into public.acad_docs (academy_id, path, data) values (%L, 'inbox/%s', '{}')$$, :'aid', :'ath')) as t10 \gset
select tests.check(:'t10'::boolean, 'nothing changes until the subscription is active');
set request.jwt.claim.sub = :d_stray;
select tests.throws(format($$select * from public.acad_enter(%L)$$, :'acode')) as t11 \gset
select tests.check(:'t11'::boolean, 'nobody joins an inactive academy');
reset role;
update public.acad_academies set plan = 'active', paid_until = now() + interval '30 days' where id = :'aid';
set role authenticated;

-- guessing is limited
set request.jwt.claim.sub = :d_stray;
do $$ begin for i in 1..8 loop perform public.acad_enter('ZZZZZZZZ'); end loop; end $$;
select tests.throws(format($$select * from public.acad_enter(%L)$$, :'athcode2')) as t12 \gset
select tests.check(:'t12'::boolean, 'too many wrong codes lock code entry for 15 minutes');

-- sign out and delete
set request.jwt.claim.sub = :d_other;
select public.acad_sign_out();
select tests.check((select count(*) = 0 from public.acad_docs), 'signing out ends access on this phone');
select public.acad_enter(:'athcode2');
select public.acad_delete_me(:'aid');
reset role;
select tests.check((select count(*) = 0 from public.acad_docs where path in ('logs/' || :'ath', 'meals/' || :'ath' || '/items/m1', 'athletes/' || :'ath')), 'deleting removes the athlete''s own records');
set role authenticated;
set request.jwt.claim.sub = :d_own2;
select public.acad_delete_me(:'aid2');
reset role;
select tests.check((select count(*) = 0 from public.acad_academies where id = :'aid2'), 'an owner deleting themself deletes their academy');
