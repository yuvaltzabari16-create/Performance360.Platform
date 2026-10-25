-- Wearables: only the athlete connects and writes; staff read only what the athlete shares.

\set dir    '''dddd0000-0000-0000-0000-000000000001'''
\set hop    '''dddd0000-0000-0000-0000-000000000002'''
\set ath    '''dddd0000-0000-0000-0000-000000000003'''
\set ath2   '''dddd0000-0000-0000-0000-000000000004'''
\set out    '''dddd0000-0000-0000-0000-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:dir, 'dir@wear.test', '{}'), (:hop, 'hop@wear.test', '{}'), (:ath, 'ath@wear.test', '{}'), (:ath2, 'ath2@wear.test', '{}'), (:out, 'out@wear.test', '{}');

set role authenticated;
set request.jwt.claim.sub = :dir;
select public.create_organization('Wear FC', null, 'Dir Wear');
select public.create_staff_invite('head_of_performance') as i1 \gset
select code as team_code from public.organization_codes where kind = 'athlete' and status = 'active' \gset
set request.jwt.claim.sub = :hop;
select public.join_organization(:'i1', 'Hop Wear');
set request.jwt.claim.sub = :ath;
select public.complete_onboarding('athlete', 'Wear Athlete');
select public.connect_with_org_code(:'team_code');
select id as rec from public.athletes where user_id = auth.uid() \gset
set request.jwt.claim.sub = :ath2;
select public.complete_onboarding('athlete', 'Other Athlete');
select public.connect_with_org_code(:'team_code');
set request.jwt.claim.sub = :out;
select public.complete_onboarding('athlete', 'Out Wear');
select public.ensure_my_athlete_record();

-- ----- the athlete connects and syncs -------------------------------------------------------
set request.jwt.claim.sub = :ath;
select public.wearable_connect('whoop', 'api', 'cipher-access', 'cipher-refresh', now() + interval '1 hour', 'read:recovery read:sleep', 'u-1') as conn \gset
select tests.check((select status from public.wearable_connections where id = :'conn') = 'connected', 'the athlete connects a provider');
select tests.check((select share_with_staff from public.wearable_connections where id = :'conn') = false, 'sharing is off until the athlete turns it on');
select tests.check((select count(*) from public.wearable_tokens_get('whoop')) = 1, 'the athlete can fetch their own tokens through the function');
select tests.throws($$select * from public.wearable_tokens$$) as direct_tokens \gset
select tests.check(:'direct_tokens'::boolean, 'the token table cannot be read directly');
select public.wearable_save_days('whoop', '[{"day":"2026-10-20","recovery_score":71.5,"hrv_ms":64.2,"resting_hr":52,"sleep_hours":7.4,"strain":12.3},{"day":"2026-10-21","recovery_score":40,"hrv_ms":48}]'::jsonb) as saved \gset
select tests.check(:'saved' = 2, 'daily rows are saved');
select public.wearable_save_days('whoop', '[{"day":"2026-10-21","sleep_hours":6.1}]'::jsonb);
select tests.check((select recovery_score from public.wearable_daily where day = '2026-10-21') = 40 and (select sleep_hours from public.wearable_daily where day = '2026-10-21') = 6.1, 'a later import fills gaps without erasing existing values');
select tests.throws($$select public.wearable_save_days('whoop', '[{"day":"2026-10-22","recovery_score":250}]'::jsonb)$$) as range_check \gset
select tests.check(:'range_check'::boolean, 'impossible values are rejected');
select tests.throws($$select public.wearable_save_days('fitbit', '[{"day":"2026-10-22"}]'::jsonb)$$) as not_connected \gset
select tests.check(:'not_connected'::boolean, 'cannot write data for a provider that is not connected');

-- ----- staff see nothing until the athlete shares ---------------------------------------------
set request.jwt.claim.sub = :hop;
select tests.check((select count(*) from public.wearable_daily) = 0, 'staff see no wearable data before sharing');
select tests.check((select count(*) from public.wearable_connections) = 0, 'staff do not see the connection before sharing');
select tests.throws($$select public.wearable_set_sharing('whoop', true)$$) as staff_share \gset
select tests.check(:'staff_share'::boolean, 'staff cannot change the athlete''s sharing');
select tests.throws(format($$select public.wearable_connect('fitbit', 'file', null, null, null, null, null)$$)) as staff_conn \gset
select tests.check(:'staff_conn'::boolean, 'staff cannot connect a wearable for an athlete');

set request.jwt.claim.sub = :ath;
select public.wearable_set_sharing('whoop', true);

set request.jwt.claim.sub = :hop;
select tests.check((select count(*) from public.wearable_daily) = 2, 'staff read the data once the athlete shares');
select tests.check((select count(*) from public.wearable_tokens_get('whoop')) = 0, 'staff never get tokens');
set request.jwt.claim.sub = :dir;
select tests.check((select count(*) from public.wearable_daily) = 2, 'the director reads shared data (read-only)');
select tests.throws($$update public.wearable_daily set recovery_score = 1$$) as dir_upd \gset
select tests.check(:'dir_upd'::boolean, 'nobody but the functions can edit rows');
set request.jwt.claim.sub = :ath2;
select tests.check((select count(*) from public.wearable_daily) = 0, 'another athlete sees none of it');
set request.jwt.claim.sub = :out;
select tests.check((select count(*) from public.wearable_daily) = 0, 'outsiders see none of it');

-- ----- disconnecting ---------------------------------------------------------------------------
set request.jwt.claim.sub = :ath;
select public.wearable_disconnect('whoop');
select tests.check((select status from public.wearable_connections) = 'disconnected', 'the athlete disconnects');
select tests.check((select count(*) from public.wearable_tokens_get('whoop')) = 0, 'tokens are cleared on disconnect');
set request.jwt.claim.sub = :hop;
select tests.check((select count(*) from public.wearable_daily) = 0, 'sharing stops on disconnect');

set request.jwt.claim.sub = :ath;
select public.wearable_erase_data('whoop') as erased \gset
select tests.check(:'erased' = 2, 'the athlete erases their stored days');
select tests.check((select count(*) from public.wearable_daily) = 0, 'no days remain after erasing');
set request.jwt.claim.sub = :ath2;
select tests.check(public.wearable_erase_data('whoop') = 0, 'erasing touches only the caller''s own data');

set role anon;
select tests.throws($$select public.wearable_connect('whoop', 'api', 'a', 'b', now(), null, null)$$) as anon_conn \gset
reset role;
select tests.check(:'anon_conn'::boolean, 'anonymous users cannot connect');
