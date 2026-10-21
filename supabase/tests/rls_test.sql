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
