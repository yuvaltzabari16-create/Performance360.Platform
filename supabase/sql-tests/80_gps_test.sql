-- GPS data: who can import, who can read.

\set dir    '''88880000-0000-0000-0000-000000000001'''
\set hop    '''88880000-0000-0000-0000-000000000002'''
\set physio '''88880000-0000-0000-0000-000000000003'''
\set ath    '''88880000-0000-0000-0000-000000000004'''
\set ath2   '''88880000-0000-0000-0000-000000000005'''
\set pt     '''88880000-0000-0000-0000-000000000006'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:dir, 'dir@gps.test', '{}'), (:hop, 'hop@gps.test', '{}'), (:physio, 'physio@gps.test', '{}'),
  (:ath, 'ath@gps.test', '{}'), (:ath2, 'ath2@gps.test', '{}'), (:pt, 'pt@gps.test', '{}');

set role authenticated;
set request.jwt.claim.sub = :dir;
select public.create_organization('GPS FC', null, 'Dir Gps');
select public.create_staff_invite('head_of_performance') as i1 \gset
select public.create_staff_invite('physiotherapist') as i2 \gset
select code as team_code from public.organization_codes where kind = 'athlete' and status = 'active' \gset
set request.jwt.claim.sub = :hop;
select public.join_organization(:'i1', 'Hop Gps');
set request.jwt.claim.sub = :physio;
select public.join_organization(:'i2', 'Physio Gps');
set request.jwt.claim.sub = :ath;
select public.complete_onboarding('athlete', 'Gps Athlete');
select public.connect_with_org_code(:'team_code');
select id as rec from public.athletes where user_id = auth.uid() \gset
set request.jwt.claim.sub = :ath2;
select public.complete_onboarding('athlete', 'Other Athlete');
select public.ensure_my_athlete_record() as rec2 \gset
set request.jwt.claim.sub = :pt;
select public.complete_onboarding('personal_trainer', 'Paul Gps');

-- ----- import -----------------------------------------------------------------------
set request.jwt.claim.sub = :hop;
select public.import_gps_session('Match vs Rivals', 'match', current_date, 105, 68, 'statsports', false,
  format('[{"athlete_id":"%s","minutes":90,"total_distance_m":10400,"hsr_distance_m":900,"sprint_distance_m":210,"sprint_count":14,"max_speed_kmh":32.1,"accel_count":40,"decel_count":38,"player_load":512.3,"avg_hr":158,"max_hr":191,"zones":[3000,4500,2000,700,200],"heat":{"cols":2,"rows":1,"cells":[1,2]}}]', :'rec')::jsonb) as sess \gset
select tests.check((select count(*) from public.gps_session_metrics where session_id = :'sess') = 1, 'head of performance imports a session');
select tests.throws(format($$select public.import_gps_session('Bad', 'training', current_date, 105, 68, 'other', false, '[{"athlete_id":"%s","total_distance_m":1000}]'::jsonb)$$, :'rec2')) as foreign_ath \gset
select tests.check(:'foreign_ath'::boolean, 'cannot import for an athlete the caller does not work with');
select tests.throws($$select public.import_gps_session('Huge', 'training', current_date, 105, 68, 'other', false, '[]'::jsonb)$$) as empty_rows \gset
select tests.check(:'empty_rows'::boolean, 'empty imports are rejected');

set request.jwt.claim.sub = :physio;
select tests.throws(format($$select public.import_gps_session('Physio', 'training', current_date, 105, 68, 'other', false, '[{"athlete_id":"%s"}]'::jsonb)$$, :'rec')) as physio_imp \gset
select tests.check(:'physio_imp'::boolean, 'physiotherapist cannot import');
select tests.check((select count(*) from public.gps_session_metrics) = 1, 'physiotherapist can read GPS data');
select tests.check((select count(*) from public.gps_sessions) = 1, 'physiotherapist sees the session');

-- a summary import carries no heat map (JSON null)
set request.jwt.claim.sub = :hop;
select public.import_gps_session('Summary', 'training', current_date, 105, 68, 'other', false,
  format('[{"athlete_id":"%s","total_distance_m":5000,"heat":null,"avg_hr":null,"zones":[]}]', :'rec')::jsonb) as sess_sum \gset
select tests.check((select heat is null from public.gps_session_metrics where session_id = :'sess_sum'), 'a summary import stores no heat map');
select public.delete_gps_session(:'sess_sum');

-- ----- reading --------------------------------------------------------------------
set request.jwt.claim.sub = :ath;
select tests.check((select count(*) from public.gps_session_metrics) = 1, 'athlete sees their own metrics');
select tests.check((select total_distance_m from public.gps_session_metrics) = 10400, 'metrics are stored');
select tests.throws($$update public.gps_session_metrics set total_distance_m = 1$$) as upd \gset
select tests.check(:'upd'::boolean, 'athletes cannot edit metrics');

set request.jwt.claim.sub = :ath2;
select tests.check((select count(*) from public.gps_session_metrics) = 0, 'another athlete sees nothing');
select tests.check((select count(*) from public.gps_sessions) = 0, 'another athlete sees no session');

set request.jwt.claim.sub = :dir;
select tests.check((select count(*) from public.gps_session_metrics) = 0, 'director sees no GPS data');
select tests.check((select count(*) from public.gps_sessions) = 0, 'director sees no sessions');

set request.jwt.claim.sub = :pt;
select tests.check((select count(*) from public.gps_sessions) = 0, 'an independent trainer sees nothing of the team');

-- ----- delete ------------------------------------------------------------------------
set request.jwt.claim.sub = :physio;
select tests.throws(format($$select public.delete_gps_session(%L)$$, :'sess')) as del_other \gset
select tests.check(:'del_other'::boolean, 'only the importer can delete');
set request.jwt.claim.sub = :hop;
select public.delete_gps_session(:'sess');
select tests.check((select count(*) from public.gps_session_metrics) = 0, 'deleting a session removes its metrics');
