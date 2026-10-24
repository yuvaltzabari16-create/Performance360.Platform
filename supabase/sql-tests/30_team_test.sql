-- Team (organization) accounts: roles, invites, roster consent and access boundaries.
-- Runs after 10_/20_ tests (reuses the `tests` helper schema).

\set dir   '''11110000-0000-0000-0000-000000000001'''
\set head  '''11110000-0000-0000-0000-000000000002'''
\set physio '''11110000-0000-0000-0000-000000000003'''
\set hop   '''11110000-0000-0000-0000-000000000004'''
\set pt    '''11110000-0000-0000-0000-000000000005'''
\set ath   '''11110000-0000-0000-0000-000000000006'''
\set ath2  '''11110000-0000-0000-0000-000000000007'''
\set dir2  '''11110000-0000-0000-0000-000000000008'''
\set head2 '''11110000-0000-0000-0000-000000000009'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:dir, 'director@team.test', '{}'), (:head, 'head@team.test', '{}'), (:physio, 'physio@team.test', '{}'),
  (:hop, 'hop@team.test', '{}'), (:pt, 'pt@team.test', '{}'), (:ath, 'ath@team.test', '{}'),
  (:ath2, 'ath2@team.test', '{}'), (:dir2, 'dir2@team.test', '{}'), (:head2, 'head2@team.test', '{}');

set role authenticated;

-- ----- creating a team ---------------------------------------------------------
set request.jwt.claim.sub = :dir;
select public.create_organization('FC Test', 'football', 'Dana Director') as org \gset
select tests.check((select role from public.profiles where id = auth.uid()) = 'org_admin', 'director gets the org_admin profile role');
select tests.check((select org_role from public.organization_members where user_id = auth.uid()) = 'director', 'creator is the director');
select tests.check((select count(*) from public.organization_codes where kind = 'athlete' and code ~ '^TEAM-[A-Z0-9]{6}$' and status = 'active') = 1, 'team gets an athlete code');
select code as team_code from public.organization_codes where kind = 'athlete' and status = 'active' \gset
select tests.throws($$select public.create_organization('Second', null, 'Dana')$$) as twice \gset
select tests.check(:'twice'::boolean, 'an onboarded account cannot create another team');

-- ----- staff invites -----------------------------------------------------------
select public.create_staff_invite('head_coach') as inv_head \gset
select public.create_staff_invite('physiotherapist') as inv_physio \gset
select public.create_staff_invite('head_of_performance') as inv_hop \gset
select tests.check(:'inv_head' ~ '^STAFF-[A-Z0-9]{6}$', 'staff invite code format');
select tests.throws($$select public.create_staff_invite('goalkeeper')$$) as badrole \gset
select tests.check(:'badrole'::boolean, 'unknown roles are rejected');

set request.jwt.claim.sub = :head;
select tests.throws($$select public.create_staff_invite('head_coach')$$) as nonmember_invite \gset
select tests.check(:'nonmember_invite'::boolean, 'people outside the team cannot create invites');
select tests.check((select org_role from public.preview_staff_code(:'inv_head')) = 'head_coach', 'invite preview shows the role');
select tests.check((select org_name from public.preview_staff_code(lower(:'inv_head'))) = 'FC Test', 'invite preview shows the team (case-insensitive)');
select tests.check((select count(*) from public.preview_staff_code('STAFF-ZZZZZZ')) = 0, 'unknown invite previews nothing');
select tests.check(public.join_organization('STAFF-ZZZZZZ', 'Hanna') = 'invalid_code', 'unknown invite rejected');
select tests.check(public.join_organization(:'inv_head', 'Hanna Head') = 'joined', 'head coach joins with invite');
select tests.check((select role from public.profiles where id = auth.uid()) = 'performance_coach', 'head coach profile role is derived');
select tests.check((select full_name from public.profiles where id = auth.uid()) = 'Hanna Head', 'name set on joining');

set request.jwt.claim.sub = :head2;
select tests.check(public.join_organization(:'inv_head', 'Late Joiner') = 'invalid_code', 'invites are single-use');

set request.jwt.claim.sub = :physio;
select tests.check(public.join_organization(:'inv_physio', 'Pia Physio') = 'joined', 'physiotherapist joins');
select tests.check((select role from public.profiles where id = auth.uid()) = 'physiotherapist', 'physio profile role');
select tests.throws($$select public.create_staff_invite('head_coach')$$) as physio_invite \gset
select tests.check(:'physio_invite'::boolean, 'only the director can invite');
select tests.check((select count(*) from public.organization_codes) = 0, 'staff cannot read team codes');

set request.jwt.claim.sub = :hop;
select tests.check(public.join_organization(:'inv_hop', 'Hugo Performance') = 'joined', 'head of performance joins');
select tests.check(public.join_organization(:'inv_hop', 'Hugo') = 'invalid_code', 'a used code stays used');

-- members can see each other; strangers cannot
select tests.check((select count(*) from public.organization_members) = 4, 'members see the whole staff list');
select tests.check((select count(*) from public.profiles where id in (:dir, :head, :physio, :hop)) = 4, 'colleagues can read each other''s profiles');

set request.jwt.claim.sub = :pt;
select public.complete_onboarding('personal_trainer', 'Paul Trainer');
select tests.check((select count(*) from public.organization_members) = 0, 'outsiders see no staff');
select tests.check((select count(*) from public.profiles where id = :dir) = 0, 'outsiders cannot read team profiles');
select tests.check((select code from public.coach_codes where status = 'active') ~ '^P360-', 'independent personal trainer has a personal code');

-- athletes cannot use staff codes
set request.jwt.claim.sub = :ath;
select public.complete_onboarding('athlete', 'Alex Athlete');
select tests.check(public.join_organization(:'inv_head', 'Alex') = 'not_allowed', 'athletes cannot join a team as staff');
select tests.check(public.connect_with_org_code('TEAM-ZZZZZZ') = 'invalid_code', 'unknown team code rejected');
select tests.check((select org_name from public.preview_org_code(:'team_code')) = 'FC Test', 'athlete previews the team before consenting');
select tests.check((select count(*) from public.athletes) = 0, 'athlete record is created only on connecting');
select tests.check(public.connect_with_org_code(:'team_code') = 'connected', 'athlete joins the team roster with consent');
select tests.check(public.connect_with_org_code(:'team_code') = 'already_connected', 'duplicate join prevented');
select id as ath_rec from public.athletes where user_id = auth.uid() \gset
select tests.check((select consent_source from public.organization_athletes where athlete_id = :'ath_rec') = 'athlete', 'consent is recorded as given by the athlete');
select tests.check((select name from public.organizations) = 'FC Test', 'athlete can see their team');
select tests.check((select count(*) from public.organization_members) = 4, 'athlete can see which staff roles have access');
select tests.check((select count(*) from public.profiles where id in (:head, :physio, :hop)) = 3, 'athlete can read the profiles of team staff');
select tests.check((select count(*) from public.profiles where id = :dir) = 1, 'athlete can read the director profile');
select tests.throws($$select public.connect_with_org_code('TEAM-ZZZZZZ'), public.create_staff_invite('head_coach')$$) as ath_invite \gset
select tests.check(:'ath_invite'::boolean, 'athletes cannot create invites');

-- ----- staff access to roster athletes -------------------------------------------
set request.jwt.claim.sub = :head;
select tests.check((select count(*) from public.athletes) = 1, 'head coach sees the roster athlete');
select tests.check((select count(*) from public.profiles where id = :ath) = 1, 'head coach can read the athlete profile');
insert into public.athlete_notes (athlete_id, body) values (:'ath_rec', 'Head coach note');
insert into public.test_results (athlete_id, test_id, trials)
  select :'ath_rec', id, '{38.5,39.2}' from public.test_definitions where short_name = 'CMJ';
update public.athletes set sport = 'football' where id = :'ath_rec';
select tests.check((select sport from public.athletes where id = :'ath_rec') = 'football', 'head coach can edit the roster athlete');
select tests.check(public.is_primary_coach(:'ath_rec'), 'head coach counts as a lead for roster athletes');

set request.jwt.claim.sub = :physio;
select tests.check((select count(*) from public.athletes) = 1, 'physiotherapist sees the roster athlete');
select tests.check((select count(*) from public.athlete_notes) = 1, 'physiotherapist sees team notes');
insert into public.athlete_notes (athlete_id, body) values (:'ath_rec', 'Physio note');
insert into public.test_results (athlete_id, test_id, trials, side)
  select :'ath_rec', id, '{4.1}', 'left' from public.test_definitions where short_name = 'WBLT';
select tests.check(tests.affected(format($$update public.athletes set status = 'archived' where id = %L$$, :'ath_rec')) = 0, 'physiotherapist cannot archive the athlete');
select tests.check(not public.is_primary_coach(:'ath_rec'), 'physiotherapist is not a lead');
select tests.check(tests.affected(format('update public.athletes set sport = %L where id = %L', 'hacked', :'ath_rec')) = 0, 'physiotherapist cannot edit the athlete profile');

set request.jwt.claim.sub = :hop;
select tests.check((select count(*) from public.test_results) = 2, 'head of performance sees all roster test results');
select tests.check(public.is_primary_coach(:'ath_rec'), 'head of performance counts as a lead');

-- ----- the director sees aggregates only -------------------------------------------
set request.jwt.claim.sub = :dir;
select tests.check((select count(*) from public.athletes) = 1, 'director reads roster athletes (read-only)');
select tests.check(tests.affected(format('update public.athletes set sport = %L where id = %L', 'x', :'ath_rec')) = 0, 'director cannot edit athletes');
select tests.check((select count(*) from public.test_results) = 0, 'director cannot read test results');
select tests.check((select count(*) from public.athlete_notes) = 0, 'director cannot read notes');
select tests.check((select count(*) from public.profiles where id = :ath) = 0, 'director cannot read the athlete account profile');
select tests.check((select count(*) from public.org_roster()) = 1, 'director sees the roster list');
select tests.check((select full_name from public.org_roster()) = 'Alex Athlete', 'roster shows the athlete name');
select tests.check((select roster_count from public.org_summary()) = 1, 'summary counts roster athletes');
select tests.check((select staff_count from public.org_summary()) = 4, 'summary counts staff');
select tests.check((select tests_30d from public.org_summary()) = 2, 'summary counts tests');
select tests.check((select count(*) from public.organization_codes where status = 'active') >= 1, 'director can see team codes');

-- ----- outsiders and other teams ---------------------------------------------------
set request.jwt.claim.sub = :pt;
select tests.check((select count(*) from public.athletes) = 0, 'independent trainer cannot see roster athletes');
select tests.check((select count(*) from public.org_roster()) = 0, 'outsiders get an empty roster');
select tests.check((select roster_count from public.org_summary()) = 0, 'outsiders get empty summary');
select tests.check(tests.affected(format('update public.athletes set sport = %L where id = %L', 'x', :'ath_rec')) = 0, 'outsiders cannot edit athletes');
select tests.throws(format($$insert into public.athlete_notes (athlete_id, body) values (%L, 'x')$$, :'ath_rec')) as outsider_note \gset
select tests.check(:'outsider_note'::boolean, 'outsiders cannot add notes');

set request.jwt.claim.sub = :dir2;
select public.create_organization('Other FC', null, 'Dora Director') as org2 \gset
select code as team_code2 from public.organization_codes where kind = 'athlete' and status = 'active' \gset
select tests.check((select count(*) from public.organizations) = 1, 'a director only sees their own team');
select tests.check((select count(*) from public.org_roster()) = 0, 'another team has its own empty roster');
select public.create_staff_invite('head_coach') as inv_head2 \gset

set request.jwt.claim.sub = :head2;
select tests.check(public.join_organization(:'inv_head2', 'Hal Head') = 'joined', 'another team''s head coach joins their own team');
select tests.check((select count(*) from public.athletes) = 0, 'another team''s head coach cannot see our athletes');

-- direct writes to team tables are blocked
set request.jwt.claim.sub = :head;
select tests.throws($$insert into public.organization_members (org_id, user_id, org_role) select id, auth.uid(), 'director' from public.organizations$$) as direct_member \gset
select tests.check(:'direct_member'::boolean, 'members cannot be inserted directly');
select tests.throws($$update public.organization_members set org_role = 'director' where user_id = auth.uid()$$) as direct_role \gset
select tests.check(:'direct_role'::boolean, 'roles cannot be changed directly');
select tests.throws($$insert into public.organization_athletes (org_id, athlete_id, consent_source) select id, gen_random_uuid(), 'athlete' from public.organizations$$) as direct_roster \gset
select tests.check(:'direct_roster'::boolean, 'roster cannot be written directly');

-- ----- roster: accounts without consent, staff-added athletes -------------------------
insert into public.athletes (id, owner_coach_id, full_name, sport) values (gen_random_uuid(), auth.uid(), 'No Account', 'football');
select id as noacc from public.athletes where full_name = 'No Account' \gset
select tests.check(public.add_athlete_to_roster(:'noacc') = 'added', 'staff can add an athlete without an account');
select tests.check(public.add_athlete_to_roster(:'noacc') = 'already_on_roster', 'no duplicate roster entry');
select tests.check((select consent_source from public.organization_athletes where athlete_id = :'noacc') = 'staff_asserted', 'staff assertion is recorded');
select tests.check(public.add_athlete_to_roster(:'ath_rec') = 'not_allowed', 'staff cannot add athletes they do not personally work with');

set request.jwt.claim.sub = :physio;
select tests.check((select count(*) from public.athletes) = 2, 'colleagues see staff-added roster athletes');
select tests.check(public.add_athlete_to_roster(:'noacc') = 'not_allowed', 'physiotherapist cannot add to the roster');

set request.jwt.claim.sub = :ath2;
select public.complete_onboarding('athlete', 'Second Athlete');
set request.jwt.claim.sub = :head;
select public.regenerate_coach_code() as head_code \gset
set request.jwt.claim.sub = :ath2;
select tests.check(public.connect_with_coach_code(:'head_code') = 'connected', 'athlete connects to a head coach personally');
select id as ath2_rec from public.athletes where user_id = auth.uid() \gset
set request.jwt.claim.sub = :head;
select tests.check(public.add_athlete_to_roster(:'ath2_rec') = 'needs_athlete_consent', 'athletes with accounts must consent themselves');

-- ----- leaving, expiry, roles and removal ------------------------------------------------
set request.jwt.claim.sub = :ath;
select public.leave_org_as_athlete(:'org');
set request.jwt.claim.sub = :hop;
select tests.check((select count(*) from public.athletes where id = :'ath_rec') = 0, 'access ends when the athlete leaves the team');
set request.jwt.claim.sub = :ath;
select tests.check((select count(*) from public.test_results) = 2, 'the athlete keeps their own data after leaving');
select tests.check(public.connect_with_org_code(:'team_code') = 'connected', 'the athlete can rejoin');
set request.jwt.claim.sub = :hop;
select tests.check((select count(*) from public.athletes where id = :'ath_rec') = 1, 'access returns on rejoining');

reset role;
update public.organization_codes set expires_at = now() - interval '1 day' where code = :'inv_head2';
set role authenticated;
set request.jwt.claim.sub = :dir2;
select public.create_staff_invite('physiotherapist') as inv_exp \gset
reset role;
update public.organization_codes set expires_at = now() - interval '1 day' where code = :'inv_exp';
set role authenticated;
set request.jwt.claim.sub = :pt;
select tests.check(public.join_organization(:'inv_exp', 'Paul') = 'invalid_code', 'expired invites are rejected');

set request.jwt.claim.sub = :dir;
select tests.throws(format($$select public.set_org_member_role(%L, 'head_coach')$$, :dir)) as lastdir \gset
select tests.check(:'lastdir'::boolean, 'the last director cannot be demoted');
select tests.throws(format($$select public.remove_org_member(%L)$$, :dir)) as lastdir2 \gset
select tests.check(:'lastdir2'::boolean, 'the last director cannot be removed');
select public.set_org_member_role(:physio, 'sports_scientist');
select tests.check((select org_role from public.organization_members where user_id = :physio) = 'sports_scientist', 'director can change a member role');
select tests.check((select role from public.profiles where id = :physio) = 'sports_scientist', 'profile role follows the team role');
select tests.throws(format($$select public.set_org_member_role(%L, 'director')$$, :head2)) as crossteam \gset
select tests.check(:'crossteam'::boolean, 'a director cannot manage another team''s members');
set request.jwt.claim.sub = :head;
select tests.throws(format($$select public.set_org_member_role(%L, 'director')$$, :head)) as selfpromote \gset
select tests.check(:'selfpromote'::boolean, 'members cannot promote themselves');

set request.jwt.claim.sub = :dir;
select public.remove_org_member(:physio);
set request.jwt.claim.sub = :physio;
select tests.check((select count(*) from public.athletes) = 0, 'a removed member loses access immediately');
select tests.check((select count(*) from public.organization_members) = 0, 'a removed member sees nothing of the team');

-- athlete code regeneration keeps the roster but stops the old code
set request.jwt.claim.sub = :dir;
select public.regenerate_org_athlete_code() as newcode \gset
select tests.check(:'newcode' <> :'team_code', 'a new athlete code is issued');
select tests.check((select count(*) from public.org_roster()) = 2, 'regenerating the code keeps the roster');
set request.jwt.claim.sub = :ath2;
select tests.check(public.connect_with_org_code(:'team_code') = 'invalid_code', 'the old athlete code no longer works');

-- ----- anonymous --------------------------------------------------------------------------------
set role anon;
reset request.jwt.claim.sub;
select tests.check((select count(*) from public.organizations) = 0, 'anon sees no teams');
select tests.throws($$select public.org_roster()$$) as anon_fn \gset
select tests.check(:'anon_fn'::boolean, 'signed-out visitors cannot call team functions');
reset role;

select tests.check((select count(*) from public.audit_log where action = 'organization.staff_joined') = 4, 'staff joining is audit-logged');
select tests.check((select count(*) from public.audit_log where action = 'organization.athlete_joined') >= 2, 'athlete joining is audit-logged');
