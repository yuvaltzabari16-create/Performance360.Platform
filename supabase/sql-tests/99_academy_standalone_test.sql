-- Standalone academy: code sign-in roles, document rules, merge, codes, removal, subscription lock.

\set own    '''a1c0de00-0000-0000-0000-000000000001'''
\set coach  '''a1c0de00-0000-0000-0000-000000000002'''
\set phys   '''a1c0de00-0000-0000-0000-000000000003'''
\set ath    '''a1c0de00-0000-0000-0000-000000000004'''
\set ath2   '''a1c0de00-0000-0000-0000-000000000005'''
\set own2   '''a1c0de00-0000-0000-0000-000000000006'''
\set stray  '''a1c0de00-0000-0000-0000-000000000007'''

insert into auth.users (id, email) values (:own, 'own@a.test'), (:coach, 'coach@a.test'), (:phys, 'phys@a.test'),
  (:ath, 'ath@a.test'), (:ath2, 'ath2@a.test'), (:own2, 'own2@a.test'), (:stray, 'stray@a.test');

set role authenticated;

-- owner opens an academy
set request.jwt.claim.sub = :own;
select public.acad_create_academy('Green Arc Academy', 'Owner One', 'Football') as aid \gset
select tests.check((select count(*) = 1 from public.acad_my_academies() where role = 'owner' and active), 'the owner sees their academy, active on trial');
select tests.check((select count(*) = 3 from public.acad_codes_list(:'aid')), 'the owner sees three sign-in codes');
select code as acode from public.acad_codes_list(:'aid') where role = 'athlete' \gset
select code as ccode from public.acad_codes_list(:'aid') where role = 'coach' \gset
select code as pcode from public.acad_codes_list(:'aid') where role = 'physio' \gset
select tests.check((select data ->> 'name' = 'Green Arc Academy' from public.acad_docs where academy_id = :'aid' and path = 'academy/settings'), 'settings are created');
select tests.check((select (data ->> 'owner')::boolean from public.acad_docs where path = 'staff/' || :own), 'the owner has a staff profile');
select tests.throws($$select public.acad_create_academy('x', 'y')$$) as shortname \gset
select tests.check(:'shortname'::boolean, 'academy names need 2 or more characters');

-- direct table access is closed
select tests.throws($$select * from public.acad_codes$$) as codes_tbl \gset
select tests.check(:'codes_tbl'::boolean, 'nobody reads the codes table directly');
select tests.throws($$select * from public.acad_members$$) as mem_tbl \gset
select tests.check(:'mem_tbl'::boolean, 'nobody reads the members table directly');

-- staff join with their codes; the code decides the role
set request.jwt.claim.sub = :coach;
select tests.check((select count(*) = 0 from public.acad_join('WRONGCODE1', 'Coach')), 'a wrong code is refused');
select role as crole from public.acad_join(lower(:'ccode'), 'Coach Two') \gset
select tests.check(:'crole' = 'coach', 'the coach code makes a coach, typed in lower case');
select tests.check((select data ->> 'role' = 'coach' from public.acad_docs where path = 'staff/' || :coach), 'the coach gets a staff profile from the server');
select tests.check((select count(*) = 1 from public.acad_codes_list(:'aid')), 'a coach sees only the athlete code');
select tests.throws(format($$select * from public.acad_join(%L, 'Coach')$$, :'acode')) as twice \gset
select tests.check(:'twice'::boolean, 'a coach cannot also join the same academy as athlete');
set request.jwt.claim.sub = :phys;
select role as prole from public.acad_join(:'pcode', 'Physio Three') \gset
select tests.check(:'prole' = 'physio', 'the physio code makes a physiotherapist');

-- athletes join
set request.jwt.claim.sub = :ath;
select role as arole from public.acad_join(:'acode', 'Athlete Four') \gset
select tests.check(:'arole' = 'athlete', 'the athlete code makes an athlete');
select tests.check((select count(*) = 0 from public.acad_codes_list(:'aid')), 'athletes see no codes');
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'athletes/' || :ath, '{"name":"Athlete Four"}');
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'logs/' || :ath, '{"workouts":{}}');
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'meals/' || :ath || '/items/m1', '{"date":"2026-11-01","kcal":500}');
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'data/users/' || :ath || '/prefs', '{"theme":"dark"}');
select tests.check((select count(*) = 4 from public.acad_docs where path like '%' || :ath || '%'), 'the athlete writes and reads their own records');
select tests.throws(format($$insert into public.acad_docs (academy_id, path, data) values (%L, 'plan/%s', '{}')$$, :'aid', :ath)) as ownplan \gset
select tests.check(:'ownplan'::boolean, 'an athlete cannot write their own training plan');
select tests.throws(format($$insert into public.acad_docs (academy_id, path, data) values (%L, 'staff/%s', '{"role":"coach"}')$$, :'aid', :ath)) as fakestaff \gset
select tests.check(:'fakestaff'::boolean, 'an athlete cannot create a staff profile');
select tests.throws(format($$insert into public.acad_docs (academy_id, path, data) values (%L, 'library/x', '{}')$$, :'aid')) as lib \gset
select tests.check(:'lib'::boolean, 'an athlete cannot change the exercise library');

set request.jwt.claim.sub = :ath2;
select public.acad_join(:'acode', 'Athlete Five');
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'athletes/' || :ath2, '{"name":"Athlete Five"}');
select tests.check((select count(*) = 0 from public.acad_docs where path like '%' || :ath || '%'), 'an athlete sees nothing of another athlete');
select tests.check((select count(*) = 0 from public.acad_docs where path like 'staffnotes/%' or path like 'payments/%'), 'athletes see no staff notes or payments');
select tests.check((select count(*) = 1 from public.acad_docs where path = 'academy/settings'), 'athletes read the academy settings');
select tests.check((select count(*) = 4 and count(*) filter (where role = 'athlete') = 1 from public.acad_member_names(:'aid')), 'athletes see staff names and themself, not other athletes');
select tests.throws(format($$select public.acad_merge(%L, 'logs/%s', '{"x":1}')$$, :'aid', :ath)) as xmerge \gset
select tests.check(:'xmerge'::boolean, 'an athlete cannot merge into another athlete''s log');

-- staff
set request.jwt.claim.sub = :coach;
select tests.check((select count(*) = 1 from public.acad_docs where path = 'meals/' || :ath || '/items/m1'), 'a coach reads athletes'' meals');
select tests.check((select count(*) = 0 from public.acad_docs where path like 'data/users/%'), 'private preferences stay private from staff');
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'plan/' || :ath, '{"sessions":{"s1":{"title":"Speed","date":"2026-11-02"}}}');
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'staffnotes/' || :ath, '{"notes":{}}');
select public.acad_merge(:'aid', 'plan/' || :ath, '{"sessions":{"s2":{"title":"Strength"}}}');
select tests.check((select data -> 'sessions' ? 's1' and data -> 'sessions' ? 's2' from public.acad_docs where path = 'plan/' || :ath), 'partial updates merge nested objects');
select public.acad_merge(:'aid', 'plan/' || :ath, '{"sessions":{"s1":null}}');
select tests.check((select not (data -> 'sessions' ? 's1') from public.acad_docs where path = 'plan/' || :ath), 'a null value removes a key');
select tests.throws(format($$select public.acad_merge(%L, 'plan/nobody', '{}')$$, :'aid')) as missing \gset
select tests.check(:'missing'::boolean, 'merging into a missing document fails');
select tests.throws(format($$insert into public.acad_docs (academy_id, path, data) values (%L, 'payments/%s', '{}')$$, :'aid', :ath)) as cpay \gset
select tests.check(:'cpay'::boolean, 'coaches cannot write payments');
select tests.throws(format($$select public.acad_rotate_code(%L, 'coach')$$, :'aid')) as crot \gset
select tests.check(:'crot'::boolean, 'coaches cannot change codes');
select tests.throws(format($$select public.acad_set_member_role(%L, %L, 'coach')$$, :'aid', :phys)) as crole2 \gset
select tests.check(:'crole2'::boolean, 'coaches cannot change roles');
select tests.throws(format($$update public.acad_docs set data = '{"role":"owner"}' where path = 'staff/%s'$$, :phys)) as other_staff \gset
select tests.check(:'other_staff'::boolean or (select data ->> 'role' = 'physio' from public.acad_docs where path = 'staff/' || :phys), 'a coach cannot edit another staff profile');

set request.jwt.claim.sub = :ath;
select tests.check((select count(*) = 1 from public.acad_docs where path = 'plan/' || :ath), 'the athlete reads their plan');
select tests.check((select count(*) = 0 from public.acad_docs where path like 'staffnotes/%'), 'but not staff-only notes about them');

-- owner powers
set request.jwt.claim.sub = :own;
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'payments/' || :ath, '{"charges":{"c1":{"amount":350}}}');
select tests.check((select count(*) = 1 from public.acad_docs where path like 'payments/%'), 'the owner records payments');
select public.acad_set_member_role(:'aid', :phys, 'coach');
select tests.check((select role = 'coach' from public.acad_member_names(:'aid') where user_id = :phys), 'the owner changes a role');
select public.acad_rotate_code(:'aid', 'athlete') as newcode \gset
select tests.check(:'newcode' <> :'acode', 'a new code replaces the old one');
set request.jwt.claim.sub = :coach;
select tests.check((select count(*) = 0 from public.acad_docs where path like 'payments/%'), 'coaches cannot read payments');

set request.jwt.claim.sub = :stray;
select tests.check((select count(*) = 0 from public.acad_join(:'acode', 'Late')), 'the old athlete code no longer works');
select tests.check((select count(*) = 0 from public.acad_docs), 'a non-member reads nothing');

-- another academy is isolated
set request.jwt.claim.sub = :own2;
select public.acad_create_academy('Other Club', 'Owner Two') as aid2 \gset
select tests.check((select count(*) = 0 from public.acad_docs where academy_id = :'aid'), 'another academy''s owner sees nothing of the first');
select tests.throws(format($$insert into public.acad_docs (academy_id, path, data) values (%L, 'library/x', '{}')$$, :'aid')) as cross \gset
select tests.check(:'cross'::boolean, 'and cannot write into it');

-- removal revokes access at once
set request.jwt.claim.sub = :coach;
select public.acad_remove_member(:'aid', :ath2);
set request.jwt.claim.sub = :ath2;
select tests.check((select count(*) = 0 from public.acad_docs), 'a removed athlete loses access immediately');
set request.jwt.claim.sub = :coach;
select tests.throws(format($$select public.acad_remove_member(%L, %L)$$, :'aid', :phys)) as rmstaff \gset
select tests.check(:'rmstaff'::boolean, 'coaches cannot remove staff');

-- subscription lock: reading still works, writing stops
reset role;
update public.acad_academies set trial_ends_at = now() - interval '1 day' where id = :'aid';
set role authenticated;
set request.jwt.claim.sub = :ath;
select tests.check((select count(*) > 0 from public.acad_docs), 'records stay readable after the trial ends');
select tests.throws(format($$insert into public.acad_docs (academy_id, path, data) values (%L, 'inbox/%s', '{}')$$, :'aid', :ath)) as locked \gset
select tests.check(:'locked'::boolean, 'nothing can be changed until the subscription is active');
set request.jwt.claim.sub = :stray;
select tests.throws(format($$select * from public.acad_join(%L, 'Late')$$, :'newcode')) as inactive_join \gset
select tests.check(:'inactive_join'::boolean, 'nobody joins an inactive academy');
reset role;
update public.acad_academies set plan = 'active', paid_until = now() + interval '30 days' where id = :'aid';
set role authenticated;
set request.jwt.claim.sub = :ath;
insert into public.acad_docs (academy_id, path, data) values (:'aid', 'inbox/' || :ath, '{}');
select tests.check(true, 'an active subscription unlocks changes');

-- rate limit on code guesses
set request.jwt.claim.sub = :stray;
do $$ begin for i in 1..8 loop begin perform public.acad_join('ZZZZZZZZZZ', 'x'); exception when others then null; end; end loop; end $$;
select tests.throws(format($$select * from public.acad_join(%L, 'Late')$$, :'newcode')) as limited \gset
select tests.check(:'limited'::boolean, 'too many wrong codes lock code entry for a while');
reset role;
select tests.check((select count(*) = 0 from public.acad_members where user_id = :stray), 'even the right code is refused while locked');
set role authenticated;

-- delete account
set request.jwt.claim.sub = :ath;
select public.acad_delete_my_account();
reset role;
select tests.check((select count(*) = 0 from public.acad_docs where path like '%' || :ath || '%' and path not like 'plan/%' and path not like 'staffnotes/%' and path not like 'payments/%'), 'deleting an account removes the athlete''s own records');
select tests.check((select count(*) = 0 from auth.users where id = :ath), 'and the sign-in');
set request.jwt.claim.sub = :own2;
set role authenticated;
select public.acad_delete_my_account();
reset role;
select tests.check((select count(*) = 0 from public.acad_academies where name = 'Other Club'), 'an owner deleting their account removes their academy');
