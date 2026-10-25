-- Squads: a head coach sees only the athletes of the squads assigned to them.

\set dir  '''97970000-0000-0000-0000-000000000001'''
\set c1   '''97970000-0000-0000-0000-000000000002'''
\set c2   '''97970000-0000-0000-0000-000000000003'''
\set hop  '''97970000-0000-0000-0000-000000000004'''
\set a1   '''97970000-0000-0000-0000-000000000005'''
\set a2   '''97970000-0000-0000-0000-000000000006'''
\set a3   '''97970000-0000-0000-0000-000000000007'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:dir, 'dir@squad.test', '{}'), (:c1, 'c1@squad.test', '{}'), (:c2, 'c2@squad.test', '{}'), (:hop, 'hop@squad.test', '{}'),
  (:a1, 'a1@squad.test', '{}'), (:a2, 'a2@squad.test', '{}'), (:a3, 'a3@squad.test', '{}');

set role authenticated;
set request.jwt.claim.sub = :dir;
select public.create_organization('Squad FC', null, 'Dir Squad');
select public.create_staff_invite('head_coach') as i1 \gset
select public.create_staff_invite('head_coach') as i2 \gset
select public.create_staff_invite('head_of_performance') as i3 \gset
select code as team_code from public.organization_codes where kind = 'athlete' and status = 'active' \gset
set request.jwt.claim.sub = :c1; select public.join_organization(:'i1', 'Coach One');
set request.jwt.claim.sub = :c2; select public.join_organization(:'i2', 'Coach Two');
set request.jwt.claim.sub = :hop; select public.join_organization(:'i3', 'Hop Squad');
set request.jwt.claim.sub = :a1; select public.complete_onboarding('athlete', 'Ann One');
select public.connect_with_org_code(:'team_code');
set request.jwt.claim.sub = :a2; select public.complete_onboarding('athlete', 'Ben Two');
select public.connect_with_org_code(:'team_code');
set request.jwt.claim.sub = :a3; select public.complete_onboarding('athlete', 'Cy Three');
select public.connect_with_org_code(:'team_code');

-- No squads yet: everyone sees the whole roster, as before.
set request.jwt.claim.sub = :c1;
select tests.check((select count(*) from public.athletes) = 3, 'without squads a head coach sees the whole roster');

-- Only director / head of performance organise squads.
select tests.throws($$select public.create_squad('Rogue')$$) as rogue \gset
select tests.check(:'rogue'::boolean, 'a head coach cannot create squads');

set request.jwt.claim.sub = :dir;
select public.create_squad('U19') as s1 \gset
select public.create_squad('Seniors') as s2 \gset
select tests.throws($$select public.create_squad('u19')$$) as dup \gset
select tests.check(:'dup'::boolean, 'squad names are unique');
select public.set_squad_coach(:'s1', :c1, true);
select public.set_squad_coach(:'s2', :c2, true);
select tests.throws(format($$select public.set_squad_coach(%L, %L, true)$$, :'s1', :'hop')) as notcoach \gset
select tests.check(:'notcoach'::boolean, 'only coaches can be assigned to squads');

set request.jwt.claim.sub = :hop;
select public.set_athlete_squad(a.id, :'s1') from public.athletes a where a.full_name = 'Ann One';
select public.set_athlete_squad(a.id, :'s2') from public.athletes a where a.full_name = 'Ben Two';

set request.jwt.claim.sub = :c1;
select tests.check((select count(*) from public.athletes) = 1 and (select full_name from public.athletes) = 'Ann One', 'coach one sees only the U19 athlete');
set request.jwt.claim.sub = :c2;
select tests.check((select count(*) from public.athletes) = 1 and (select full_name from public.athletes) = 'Ben Two', 'coach two sees only the Seniors athlete');
select tests.check((select count(*) from public.org_roster()) = 1, 'the roster list follows the squad scope');
select tests.check((select count(*) from public.my_squads()) = 1, 'my_squads lists the coach''s own squads');
set request.jwt.claim.sub = :hop;
select tests.check((select count(*) from public.athletes) = 3, 'head of performance still sees everyone');

-- An athlete with no squad is invisible to squad coaches while squads exist.
set request.jwt.claim.sub = :c1;
select tests.check((select count(*) from public.athletes where full_name = 'Cy Three') = 0, 'unassigned athletes are not visible to squad coaches');

-- Moving an athlete moves the access; switching a coach off removes it.
set request.jwt.claim.sub = :dir;
select public.set_athlete_squad(a.id, :'s2') from public.athletes a where a.full_name = 'Ann One';
select tests.check((select count(*) from public.organization_athletes where squad_id = :'s2') = 2, 'director can move athletes between squads');
set request.jwt.claim.sub = :c1;
select tests.check((select count(*) from public.athletes) = 0, 'coach one loses the athlete moved to another squad');
set request.jwt.claim.sub = :dir;
select public.set_squad_coach(:'s2', :c1, true);
set request.jwt.claim.sub = :c1;
select tests.check((select count(*) from public.athletes) = 2, 'assigning a second squad widens access');
set request.jwt.claim.sub = :dir;
select public.set_squad_coach(:'s2', :c1, false);
set request.jwt.claim.sub = :c1;
select tests.check((select count(*) from public.athletes) = 0, 'switching a coach off removes access');

-- Archiving a squad clears its athletes; with no active squad left everyone sees the roster again.
set request.jwt.claim.sub = :dir;
select public.archive_squad(:'s1');
select public.archive_squad(:'s2');
set request.jwt.claim.sub = :c1;
select tests.check((select count(*) from public.athletes) = 3, 'with no active squads the roster is open to coaches again');

-- Notification categories: a muted category is not delivered, others still are.
set request.jwt.claim.sub = :c1;
update public.profiles set notification_prefs = '{"in_app": true, "muted": ["injury"]}'::jsonb where id = :c1;
reset role;
select public.notify(:c1, 'injury.update', 'Muted', 'x', null);
select public.notify(:c1, 'program.assigned', 'Kept', 'x', null);
select tests.check((select count(*) from public.notifications where user_id = :c1 and title = 'Muted') = 0, 'a muted category is not delivered');
select tests.check((select count(*) from public.notifications where user_id = :c1 and title = 'Kept') = 1, 'other categories still arrive');

-- Email copies: only people who opted in, only unsent, service role only.
reset role;
select public.notify(:hop, 'program.assigned', 'Email me', 'x', '/dashboard');
update public.profiles set notification_prefs = '{"in_app": true, "email": true}'::jsonb where id = :hop;
select tests.check((select count(*) from public.notification_email_due(50) where title = 'Email me') = 1, 'opted-in people have emails due');
select tests.check((select count(*) from public.notification_email_due(50) where title = 'Kept') = 0, 'people who did not opt in get no email');
select public.notification_mark_emailed(array(select id from public.notifications where title = 'Email me'));
select tests.check((select count(*) from public.notification_email_due(50) where title = 'Email me') = 0, 'a sent notification is not sent twice');
select tests.throws($$set role authenticated; select * from public.notification_email_due(5)$$) as mail_user \gset
select tests.check(:'mail_user'::boolean, 'app users cannot read the email queue');
