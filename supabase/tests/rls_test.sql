-- Permissions test. Run in the Supabase SQL editor (or psql) as the postgres role.
-- Creates throwaway users/data, checks every access rule, then raises an exception
-- so EVERYTHING is rolled back. The exception message is the report; look for "FAIL".
do $t$
declare
  D uuid := gen_random_uuid(); C uuid := gen_random_uuid(); A uuid := gen_random_uuid(); X uuid := gen_random_uuid(); D2 uuid := gen_random_uuid();
  club1 uuid; club2 uuid; s1 uuid; s2 uuid; p1 uuid; p2 uuid; tc text; ta text; n int; v_ready int; r text[] := '{}';
begin
  insert into auth.users(id, email, raw_user_meta_data, aud, role) values
    (D,'d@t.io','{"full_name":"Dir"}','authenticated','authenticated'),(C,'c@t.io','{"full_name":"Coach"}','authenticated','authenticated'),
    (A,'a@t.io','{"full_name":"Ath","locale":"en"}','authenticated','authenticated'),(X,'x@t.io','{}','authenticated','authenticated'),
    (D2,'d2@t.io','{}','authenticated','authenticated');
  r := r || ('profile trigger: ' || (select count(*) from public.profiles where id in (D,C,A,X,D2)) || '/5, A locale=' || (select locale from public.profiles where id=A));

  -- director D builds a club
  perform set_config('request.jwt.claims', json_build_object('sub',D,'role','authenticated')::text, true); set local role authenticated;
  club1 := public.create_club('Test FC');
  insert into public.squads(club_id,name) values (club1,'U19') returning id into s1;
  insert into public.squads(club_id,name) values (club1,'U17') returning id into s2;
  insert into public.players(club_id,squad_id,full_name) values (club1,s1,'P One') returning id into p1;
  insert into public.players(club_id,squad_id,full_name) values (club1,s2,'P Two') returning id into p2;
  insert into public.invites(club_id,role,squad_id) values (club1,'coach',s1) returning token into tc;
  insert into public.invites(club_id,role,player_id) values (club1,'athlete',p1) returning token into ta;
  insert into public.player_notes(player_id,body,shared_with_athlete) values (p1,'shared note',true),(p1,'private note',false);
  r := r || 'director setup OK'::text;
  reset role;

  -- coach C (assigned to U19 only)
  perform set_config('request.jwt.claims', json_build_object('sub',C,'role','authenticated')::text, true); set local role authenticated;
  perform public.accept_invite(tc);
  select count(*) into n from public.players; r := r || ('C sees players: '||n||' (expect 2)');
  update public.players set notes='x' where id=p1; get diagnostics n = row_count; r := r || ('C edits own-squad player: '||n||' (expect 1)');
  update public.players set notes='x' where id=p2; get diagnostics n = row_count; r := r || ('C edits other-squad player: '||n||' (expect 0)');
  begin insert into public.players(club_id,squad_id,full_name) values (club1,s2,'bad'); r := r || 'FAIL C inserted into other squad'::text; exception when others then r := r || 'C insert other squad blocked'::text; end;
  begin insert into public.players(club_id,squad_id,full_name) values (club1,s1,'P Three'); r := r || 'C insert own squad OK'::text; exception when others then r := r || ('FAIL C insert own squad: '||sqlerrm); end;
  begin insert into public.invites(club_id,role,player_id) values (club1,'athlete',p2); r := r || 'FAIL C invited other-squad athlete'::text; exception when others then r := r || 'C invite other-squad athlete blocked'::text; end;
  begin insert into public.invites(club_id,role) values (club1,'coach'); r := r || 'FAIL C created coach invite'::text; exception when others then r := r || 'C coach invite blocked'::text; end;
  begin insert into public.invites(club_id,role) values (club1,'director'); r := r || 'FAIL C created director invite'::text; exception when others then r := r || 'C director invite blocked'::text; end;
  begin update public.invites set token='hack'; r := r || 'FAIL C changed token'::text; exception when others then r := r || 'C token change blocked'::text; end;
  begin update public.players set user_id=C where id=p1; r := r || 'FAIL C hijacked player user_id'::text; exception when others then r := r || 'C user_id change blocked'::text; end;
  reset role;

  -- athlete A
  perform set_config('request.jwt.claims', json_build_object('sub',A,'role','authenticated')::text, true); set local role authenticated;
  perform public.accept_invite(ta);
  select count(*) into n from public.players; r := r || ('A sees players: '||n||' (expect 1)');
  insert into public.wellness_checkins(player_id,sleep,energy,freshness,calm,mood) values (p1,4,4,3,4,3) returning readiness into v_ready;
  r := r || ('A check-in OK, readiness='||v_ready||' (expect 65)');
  begin insert into public.wellness_checkins(player_id,sleep,energy,freshness,calm,mood) values (p2,4,4,4,4,4); r := r || 'FAIL A checked in for another player'::text; exception when others then r := r || 'A check-in for other player blocked'::text; end;
  begin insert into public.wellness_checkins(player_id,entry_date,sleep,energy,freshness,calm,mood) values (p1,current_date-5,4,4,4,4,4); r := r || 'FAIL A backdated check-in'::text; exception when others then r := r || 'A backdated check-in blocked'::text; end;
  begin insert into public.wellness_checkins(player_id,sleep,energy,freshness,calm,mood,club_id) values (p1,1,1,1,1,1,gen_random_uuid()) on conflict (player_id,entry_date) do update set sleep=excluded.sleep; r := r || 'A upsert (edit) OK'::text; exception when others then r := r || ('FAIL A upsert: '||sqlerrm); end;
  select count(*) into n from public.player_notes; r := r || ('A sees notes: '||n||' (expect 1 shared)');
  select count(*) into n from public.invites; r := r || ('A sees invites: '||n||' (expect 0)');
  update public.players set notes='me' where id=p1; get diagnostics n = row_count; r := r || ('A edits own player row: '||n||' (expect 0)');
  begin perform public.accept_invite(ta); r := r || 'FAIL reused invite'::text; exception when others then r := r || ('reused invite blocked: '||sqlerrm); end;
  reset role;

  -- ===== Stage 2: sessions, RPE, tests
  declare ses1 uuid; ses2 uuid; tdef uuid;
  begin
    select id into tdef from public.test_definitions where key = 'cmj' and club_id is null;
    perform set_config('request.jwt.claims', json_build_object('sub',D,'role','authenticated')::text, true); set local role authenticated;
    insert into public.training_sessions(club_id,squad_id,session_date,type,duration_min) values (club1,s1,current_date,'pitch',90) returning id into ses1;
    insert into public.training_sessions(club_id,squad_id,session_date,type,duration_min) values (club1,s2,current_date,'pitch',90) returning id into ses2;
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub',C,'role','authenticated')::text, true); set local role authenticated;
    begin insert into public.training_sessions(club_id,squad_id,session_date,duration_min) values (club1,s2,current_date,60); r := r || 'FAIL C planned other squad session'::text; exception when others then r := r || 'C session for other squad blocked'::text; end;
    begin insert into public.training_sessions(club_id,squad_id,session_date,duration_min) values (club1,null,current_date,60); r := r || 'FAIL C planned club-wide session'::text; exception when others then r := r || 'C club-wide session blocked'::text; end;
    begin insert into public.test_results(player_id,test_id,value) values (p1,tdef,40.5); r := r || 'C test result own squad OK'::text; exception when others then r := r || ('FAIL C test result: '||sqlerrm); end;
    begin insert into public.test_results(player_id,test_id,value) values (p2,tdef,40.5); r := r || 'FAIL C test result other squad'::text; exception when others then r := r || 'C test result other squad blocked'::text; end;
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub',A,'role','authenticated')::text, true); set local role authenticated;
    insert into public.session_rpe(session_id,player_id,rpe,minutes) values (ses1,p1,7,80) returning load into n;
    r := r || ('A rates own session, load='||n||' (expect 560)');
    begin insert into public.session_rpe(session_id,player_id,rpe,minutes) values (ses2,p1,7,80); r := r || 'FAIL A rated other squad session'::text; exception when others then r := r || 'A rating other squad session blocked'::text; end;
    begin insert into public.session_rpe(session_id,player_id,rpe,minutes) values (ses1,p2,7,80); r := r || 'FAIL A rated for another player'::text; exception when others then r := r || 'A rating for another player blocked'::text; end;
    select count(*) into n from public.test_results; r := r || ('A sees test results: '||n||' (expect 1, own)');
    begin insert into public.test_results(player_id,test_id,value) values (p1,tdef,99); r := r || 'FAIL A wrote own test result'::text; exception when others then r := r || 'A test result write blocked'::text; end;
    reset role;
  end;

  -- ===== Stage 3: workouts, individual sessions, logs, library
  declare wk uuid; ind1 uuid; ind2 uuid;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',C,'role','authenticated')::text, true); set local role authenticated;
    insert into public.workouts(club_id,title,content) values (club1,'W','{"sections":[]}') returning id into wk;
    insert into public.training_sessions(club_id,player_id,session_date,type,duration_min,workout_id,workout_snapshot)
      values (club1,p1,current_date,'gym',45,wk,'{"title":"W","content":{"sections":[]}}') returning id into ind1;
    r := r || 'C assigns workout to own-squad athlete OK'::text;
    begin insert into public.training_sessions(club_id,player_id,session_date,duration_min) values (club1,p2,current_date,45); r := r || 'FAIL C assigned other-squad athlete'::text; exception when others then r := r || 'C assign to other-squad athlete blocked'::text; end;
    begin insert into public.exercises(club_id,region,category,name_en) values (club1,'lower','squat','Club Squat'); r := r || 'C adds club exercise OK'::text; exception when others then r := r || ('FAIL C club exercise: '||sqlerrm); end;
    begin update public.exercises set name_en='hack' where club_id is null; get diagnostics n = row_count; r := r || ('C edits built-in exercises: '||n||' (expect 0)'); end;
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub',D,'role','authenticated')::text, true); set local role authenticated;
    insert into public.training_sessions(club_id,player_id,session_date,duration_min) values (club1,p2,current_date,30) returning id into ind2;
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub',A,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.workouts; r := r || ('A sees club workout library: '||n||' (expect 0)');
    select count(*) into n from public.training_sessions where id in (ind1, ind2); r := r || ('A sees individual sessions: '||n||' (expect 1, own)');
    select count(*) into n from public.exercises; r := r || ('A sees exercises: '||n||' (expect built-in + 1 club)');
    begin insert into public.workout_logs(session_id,player_id,log,completed_at) values (ind1,p1,'{}',now()); r := r || 'A logs own workout OK'::text; exception when others then r := r || ('FAIL A log: '||sqlerrm); end;
    begin insert into public.workout_logs(session_id,player_id,log) values (ind2,p1,'{}'); r := r || 'FAIL A logged another athlete session'::text; exception when others then r := r || 'A log on other athlete session blocked'::text; end;
    begin insert into public.ai_usage(club_id,kind) values (club1,'create'); r := r || 'FAIL athlete wrote ai_usage'::text; exception when others then r := r || 'athlete ai_usage blocked'::text; end;
    reset role;
  end;

  -- ===== Stage 4: injuries, messages, notifications
  declare inj uuid; st text;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub',C,'role','authenticated')::text, true); set local role authenticated;
    insert into public.injuries(player_id,body_area,severity,stage) values (p1,'hamstring','moderate',0) returning id into inj;
    select status into st from public.players where id=p1; r := r || ('C logs injury own squad OK, player status='||st||' (expect injured)');
    begin insert into public.injuries(player_id,body_area) values (p2,'ankle'); r := r || 'FAIL C logged injury other squad'::text; exception when others then r := r || 'C injury other squad blocked'::text; end;
    update public.injuries set stage=2 where id=inj;
    select status into st from public.players where id=p1; r := r || ('C moves to running, status='||st||' (expect rehab)');
    select count(*) into n from public.injury_updates where injury_id=inj; r := r || ('injury timeline rows: '||n||' (expect 2)');
    begin insert into public.messages(player_id,body) values (p2,'hi'); r := r || 'FAIL C messaged other-squad athlete'::text; exception when others then r := r || 'C message other squad blocked'::text; end;
    insert into public.messages(player_id,body) values (p1,'Well done today');
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub',A,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.injuries; r := r || ('A sees own injuries: '||n||' (expect 1)');
    begin insert into public.injuries(player_id,body_area) values (p1,'knee'); r := r || 'FAIL A logged own injury'::text; exception when others then r := r || 'A injury insert blocked'::text; end;
    select count(*) into n from public.notifications where kind in ('injury_stage','message_from_staff'); r := r || ('A notifications (stage + message): '||n||' (expect 2)');
    insert into public.messages(player_id,body) values (p1,'Thanks coach');
    begin insert into public.messages(player_id,body) values (p2,'spam'); r := r || 'FAIL A messaged as another athlete'::text; exception when others then r := r || 'A message to other thread blocked'::text; end;
    begin insert into public.notifications(user_id,kind) values (C,'fake'); r := r || 'FAIL A forged a notification'::text; exception when others then r := r || 'A notification insert blocked'::text; end;
    update public.notifications set read_at=now(); get diagnostics n = row_count; r := r || ('A marks own notifications read: '||n||' (expect 3: workout, stage, message)');
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub',C,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.notifications where kind='message_from_athlete'; r := r || ('C notified of athlete message: '||n||' (expect 1)');
    update public.notifications set read_at=now() where user_id=A; get diagnostics n = row_count; r := r || ('C edits athlete notifications: '||n||' (expect 0)');
    reset role;
  end;

  -- outsider X and another club's director D2
  perform set_config('request.jwt.claims', json_build_object('sub',X,'role','authenticated')::text, true); set local role authenticated;
  select (select count(*) from public.players)+(select count(*) from public.clubs)+(select count(*) from public.wellness_checkins)+(select count(*) from public.player_notes)+(select count(*) from public.profiles where id<>X) into n;
  r := r || ('outsider sees rows: '||n||' (expect 0)');
  begin insert into public.squads(club_id,name) values (club1,'evil'); r := r || 'FAIL outsider created squad'::text; exception when others then r := r || 'outsider squad insert blocked'::text; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',D2,'role','authenticated')::text, true); set local role authenticated;
  club2 := public.create_club('Other FC');
  select count(*) into n from public.players where club_id=club1; r := r || ('other-club director sees club1 players: '||n||' (expect 0)');
  begin insert into public.players(club_id,squad_id,full_name) values (club2,s1,'cross'); r := r || 'FAIL cross-club squad'::text; exception when others then r := r || 'cross-club squad blocked'::text; end;
  reset role;

  -- director removes the coach; coach loses all rights
  perform set_config('request.jwt.claims', json_build_object('sub',D,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.wellness_checkins; r := r || ('D sees check-ins: '||n||' (expect 1)');
  delete from public.club_members where club_id=club1 and user_id=D; get diagnostics n = row_count; r := r || ('D removes self: '||n||' (expect 0)');
  delete from public.club_members where club_id=club1 and user_id=C; get diagnostics n = row_count; r := r || ('D removes coach: '||n||' (expect 1)');
  reset role;
  r := r || ('C squad_staff rows after removal: '||(select count(*) from public.squad_staff where user_id=C)||' (expect 0)');
  perform set_config('request.jwt.claims', json_build_object('sub',C,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into n from public.players; r := r || ('removed coach sees players: '||n||' (expect 0)');
  update public.players set notes='y' where id=p1; get diagnostics n = row_count; r := r || ('removed coach edits: '||n||' (expect 0)');
  reset role;

  raise exception E'RESULTS (rolled back)\n%', array_to_string(r, E'\n');
end $t$;
