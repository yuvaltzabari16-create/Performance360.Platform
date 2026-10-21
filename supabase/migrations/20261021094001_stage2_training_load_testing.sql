-- Stage 2: training sessions, session RPE (load), physical testing.
create type public.session_type as enum ('pitch','match','gym','recovery');

-- TRAINING SESSIONS (squad_id null = whole club)
create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  squad_id uuid references public.squads(id) on delete cascade,
  session_date date not null,
  type public.session_type not null default 'pitch',
  title text check (length(title) <= 120),
  duration_min int not null check (duration_min between 5 and 300),
  notes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.training_sessions(club_id, session_date);
create index on public.training_sessions(squad_id);
create index on public.training_sessions(created_by);

create or replace function public.check_session_squad() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.squad_id is not null and not exists(select 1 from public.squads where id = new.squad_id and club_id = new.club_id) then
    raise exception 'squad does not belong to this club';
  end if;
  return new;
end $$;
create trigger sessions_squad_check before insert or update of squad_id, club_id on public.training_sessions
  for each row execute function public.check_session_squad();

-- Who may plan a session: director, or coach of that squad (club-wide sessions: director only)
create or replace function public.can_manage_session(p_club uuid, p_squad uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_director(p_club) or (p_squad is not null and public.coaches_squad(p_squad))
$$;

-- SESSION RPE (load = RPE x minutes, Foster sRPE)
create table public.session_rpe (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  session_date date not null,
  rpe smallint not null check (rpe between 0 and 10),
  minutes int not null check (minutes between 0 and 300),
  load int generated always as (rpe * minutes) stored,
  recorded_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, player_id)
);
create index on public.session_rpe(club_id, session_date);
create index on public.session_rpe(player_id, session_date);
create index on public.session_rpe(recorded_by);
create trigger session_rpe_updated before update on public.session_rpe for each row execute function public.set_updated_at();

-- club_id + date come from the session; the player must be in that club and (if set) that squad
create or replace function public.prepare_session_rpe() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.training_sessions; p public.players;
begin
  select * into s from public.training_sessions where id = new.session_id;
  select * into p from public.players where id = new.player_id;
  if s.id is null or p.id is null or s.club_id <> p.club_id then raise exception 'session/player mismatch'; end if;
  if s.squad_id is not null and p.squad_id is distinct from s.squad_id then raise exception 'player not in this squad'; end if;
  new.club_id := s.club_id;
  new.session_date := s.session_date;
  return new;
end $$;
create trigger session_rpe_prepare before insert or update of session_id, player_id on public.session_rpe
  for each row execute function public.prepare_session_rpe();

-- TEST DEFINITIONS (club_id null = built-in, visible to everyone)
create table public.test_definitions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs(id) on delete cascade,
  key text,
  name_en text not null,
  name_he text not null,
  unit text not null,
  higher_is_better boolean not null default true,
  decimals smallint not null default 2 check (decimals between 0 and 3),
  sort int not null default 100,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.test_definitions(club_id);
insert into public.test_definitions(club_id,key,name_en,name_he,unit,higher_is_better,decimals,sort) values
  (null,'s10','10 m sprint','ספרינט 10 מ''','s',false,2,10),
  (null,'s30','30 m sprint','ספרינט 30 מ''','s',false,2,20),
  (null,'cmj','Countermovement jump','קפיצה (CMJ)','cm',true,1,30),
  (null,'505','5-0-5 agility','זריזות 5-0-5','s',false,2,40),
  (null,'yoyo','Yo-Yo IR1','Yo-Yo IR1','m',true,0,50),
  (null,'mas','Max aerobic speed','מהירות אירובית מקסימלית','km/h',true,1,60);

-- TEST RESULTS
create table public.test_results (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  test_id uuid not null references public.test_definitions(id) on delete cascade,
  tested_on date not null default current_date,
  value numeric(8,3) not null,
  notes text,
  recorded_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.test_results(club_id, test_id, tested_on);
create index on public.test_results(player_id);
create index on public.test_results(test_id);
create index on public.test_results(recorded_by);
create trigger test_results_club before insert or update of player_id on public.test_results
  for each row execute function public.set_club_from_player();

create or replace function public.check_test_scope() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.test_definitions t where t.id = new.test_id and (t.club_id is null or t.club_id = new.club_id)) then
    raise exception 'test not available to this club';
  end if;
  return new;
end $$;
-- runs after test_results_club (before-triggers fire in name order)
create trigger test_results_scope before insert or update of test_id, player_id on public.test_results
  for each row execute function public.check_test_scope();

-- ===== RLS =====
alter table public.training_sessions enable row level security;
alter table public.session_rpe enable row level security;
alter table public.test_definitions enable row level security;
alter table public.test_results enable row level security;

create policy sessions_select on public.training_sessions for select to authenticated using (public.is_member(club_id));
create policy sessions_insert on public.training_sessions for insert to authenticated
  with check (created_by = (select auth.uid()) and public.can_manage_session(club_id, squad_id));
create policy sessions_update on public.training_sessions for update to authenticated
  using (public.can_manage_session(club_id, squad_id)) with check (public.can_manage_session(club_id, squad_id));
create policy sessions_delete on public.training_sessions for delete to authenticated
  using (public.can_manage_session(club_id, squad_id));
revoke update (club_id, created_by) on public.training_sessions from authenticated, anon;

create policy rpe_select on public.session_rpe for select to authenticated
  using (public.is_staff(club_id) or public.is_own_player(player_id));
create policy rpe_insert on public.session_rpe for insert to authenticated
  with check (recorded_by = (select auth.uid()) and (
    public.can_edit_player(player_id)
    or (public.is_own_player(player_id) and session_date between current_date - 3 and current_date + 1)));
create policy rpe_update on public.session_rpe for update to authenticated
  using (public.can_edit_player(player_id) or public.is_own_player(player_id))
  with check (recorded_by = (select auth.uid()) and (
    public.can_edit_player(player_id)
    or (public.is_own_player(player_id) and session_date between current_date - 3 and current_date + 1)));
create policy rpe_delete on public.session_rpe for delete to authenticated using (public.can_edit_player(player_id));

create policy testdef_select on public.test_definitions for select to authenticated
  using (club_id is null or public.is_member(club_id));
create policy testdef_insert on public.test_definitions for insert to authenticated
  with check (club_id is not null and public.is_staff(club_id));
create policy testdef_update on public.test_definitions for update to authenticated
  using (club_id is not null and public.is_staff(club_id)) with check (club_id is not null and public.is_staff(club_id));

create policy results_select on public.test_results for select to authenticated
  using (public.is_staff(club_id) or public.is_own_player(player_id));
create policy results_insert on public.test_results for insert to authenticated
  with check (recorded_by = (select auth.uid()) and public.can_edit_player(player_id));
create policy results_update on public.test_results for update to authenticated
  using (public.can_edit_player(player_id)) with check (public.can_edit_player(player_id));
create policy results_delete on public.test_results for delete to authenticated using (public.can_edit_player(player_id));

revoke execute on function public.check_session_squad(), public.prepare_session_rpe(), public.check_test_scope() from public, anon, authenticated;
revoke execute on function public.can_manage_session(uuid, uuid) from public, anon;
grant execute on function public.can_manage_session(uuid, uuid) to authenticated;
