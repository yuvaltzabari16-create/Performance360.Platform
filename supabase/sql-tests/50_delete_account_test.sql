-- Permanent account deletion: what is removed, what is kept, and the last-director guard.

\set solo   '''55550000-0000-0000-0000-000000000001'''
\set coach  '''55550000-0000-0000-0000-000000000002'''
\set dir    '''55550000-0000-0000-0000-000000000003'''
\set staff  '''55550000-0000-0000-0000-000000000004'''
\set lone   '''55550000-0000-0000-0000-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:solo, 'solo@del.test', '{}'), (:coach, 'coach@del.test', '{}'), (:dir, 'dir@del.test', '{}'),
  (:staff, 'staff@del.test', '{}'), (:lone, 'lone@del.test', '{}');

set role authenticated;

-- ----- an athlete with a self-created record -----------------------------------
set request.jwt.claim.sub = :solo;
select public.complete_onboarding('athlete', 'Solo Athlete');
select public.ensure_my_athlete_record();
select public.delete_my_account();
reset role;
select tests.check(not exists (select 1 from auth.users where id = :solo), 'the sign-in account is gone');
select tests.check(not exists (select 1 from public.profiles where id = :solo), 'the profile is gone');
select tests.check(not exists (select 1 from public.athletes where full_name = 'Solo Athlete'), 'a self-created athlete record is erased');
select tests.check(exists (select 1 from public.audit_log where action = 'account.deleted' and entity_id = :solo::text), 'deletion is audited');

-- ----- a coach: their athletes stay (unlinked from the coach), their own data goes -----
set role authenticated;
set request.jwt.claim.sub = :coach;
select public.complete_onboarding('performance_coach', 'Coach Gone');
insert into public.athletes (id, owner_coach_id, full_name) values ('55550000-0000-0000-0000-0000000000a1', :coach, 'Kept Athlete');
insert into public.training_programs (coach_id, title) values (:coach, 'Gone Program');
select public.delete_my_account();
reset role;
select tests.check(not exists (select 1 from auth.users where id = :coach), 'coach account deleted');
select tests.check(not exists (select 1 from public.training_programs where title = 'Gone Program'), 'coach programs are removed with the account');
select tests.check(exists (select 1 from public.athletes where full_name = 'Kept Athlete' and owner_coach_id is null), 'a coach-created athlete record is kept, unlinked');

-- ----- the last director cannot leave staff behind -----------------------------
set role authenticated;
set request.jwt.claim.sub = :dir;
select public.create_organization('Del FC', null, 'Dir Gone');
select public.create_staff_invite('head_coach') as inv \gset
set request.jwt.claim.sub = :staff;
select public.join_organization(:'inv', 'Staff Stays');
set request.jwt.claim.sub = :dir;
select tests.throws($$select public.delete_my_account()$$) as blocked \gset
select tests.check(:'blocked'::boolean, 'the last director cannot delete while staff remain');
set request.jwt.claim.sub = :staff;
select public.delete_my_account();  -- staff leave freely
set request.jwt.claim.sub = :dir;
select public.delete_my_account();  -- now alone: the team dissolves with the account
reset role;
select tests.check(not exists (select 1 from public.organizations where name = 'Del FC'), 'a sole-member team is dissolved');
select tests.check(not exists (select 1 from auth.users where id in (:dir, :staff)), 'both accounts are gone');

-- ----- anonymous callers cannot delete anything ---------------------------------
set role anon;
select tests.throws($$select public.delete_my_account()$$) as anon_blocked \gset
reset role;
select tests.check(:'anon_blocked'::boolean, 'anonymous users cannot call delete_my_account');
