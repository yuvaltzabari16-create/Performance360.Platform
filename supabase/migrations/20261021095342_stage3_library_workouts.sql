-- Stage 3: exercise library, workouts, assignments (sessions carry a workout snapshot), athlete workout logs, AI usage.

-- EXERCISES (club_id null = built-in library from the club's PDF)
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs(id) on delete cascade,
  region text not null check (region in ('lower','upper','core','rehab','other')),
  category text not null,
  name_en text not null check (length(trim(name_en)) between 1 and 160),
  name_he text check (length(name_he) <= 160),
  video_id text check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  video_url text check (video_url ~ '^https://'),
  equipment text[] not null default '{}',
  cues text[] not null default '{}',
  notes text,
  sort int not null default 1000,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.exercises(club_id);
create index on public.exercises(category);
create index on public.exercises(created_by);

-- WORKOUTS (club library). content = { sections: [{ id, title, blocks: [{ id, kind, rounds, items: [{ id, exercise_id, name, note, fields, sets }] }] }] }
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  description text,
  focus text,
  est_minutes int check (est_minutes between 5 and 300),
  content jsonb not null default '{"sections":[]}'::jsonb check (jsonb_typeof(content->'sections') = 'array'),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.workouts(club_id);
create index on public.workouts(created_by);
create trigger workouts_updated before update on public.workouts for each row execute function public.set_updated_at();

-- SESSIONS can now carry a workout (snapshot at assignment time) and target one athlete
alter table public.training_sessions
  add column workout_id uuid references public.workouts(id) on delete set null,
  add column workout_snapshot jsonb,
  add column player_id uuid references public.players(id) on delete cascade,
  add constraint session_target check (player_id is null or squad_id is null);
create index on public.training_sessions(workout_id);
create index on public.training_sessions(player_id);

create or replace function public.check_session_squad() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.squad_id is not null and not exists(select 1 from public.squads where id = new.squad_id and club_id = new.club_id) then
    raise exception 'squad does not belong to this club';
  end if;
  if new.player_id is not null and not exists(select 1 from public.players where id = new.player_id and club_id = new.club_id) then
    raise exception 'player does not belong to this club';
  end if;
  if new.workout_id is not null and not exists(select 1 from public.workouts where id = new.workout_id and club_id = new.club_id) then
    raise exception 'workout does not belong to this club';
  end if;
  return new;
end $$;

create or replace trigger sessions_squad_check before insert or update of squad_id, club_id, player_id, workout_id on public.training_sessions
  for each row execute function public.check_session_squad();

-- Who may plan a session: squad -> director/squad coach; individual -> whoever can edit that player; club-wide -> director
create or replace function public.can_manage_session_v2(p_club uuid, p_squad uuid, p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_player is not null then public.can_edit_player(p_player)
    else public.is_director(p_club) or (p_squad is not null and public.coaches_squad(p_squad))
  end
$$;
revoke execute on function public.can_manage_session_v2(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_manage_session_v2(uuid, uuid, uuid) to authenticated;

alter policy sessions_select on public.training_sessions
  using (public.is_staff(club_id) or (player_id is null and public.is_member(club_id)) or public.is_own_player(player_id));
alter policy sessions_insert on public.training_sessions
  with check (created_by = (select auth.uid()) and public.can_manage_session_v2(club_id, squad_id, player_id));
alter policy sessions_update on public.training_sessions
  using (public.can_manage_session_v2(club_id, squad_id, player_id)) with check (public.can_manage_session_v2(club_id, squad_id, player_id));
alter policy sessions_delete on public.training_sessions
  using (public.can_manage_session_v2(club_id, squad_id, player_id));

-- RPE: an individual session can only be rated for its athlete
create or replace function public.prepare_session_rpe() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.training_sessions; p public.players;
begin
  select * into s from public.training_sessions where id = new.session_id;
  select * into p from public.players where id = new.player_id;
  if s.id is null or p.id is null or s.club_id <> p.club_id then raise exception 'session/player mismatch'; end if;
  if s.squad_id is not null and p.squad_id is distinct from s.squad_id then raise exception 'player not in this squad'; end if;
  if s.player_id is not null and s.player_id <> p.id then raise exception 'session is for another athlete'; end if;
  new.club_id := s.club_id;
  new.session_date := s.session_date;
  return new;
end $$;

-- WORKOUT LOGS (what the athlete actually did)
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  log jsonb not null default '{}'::jsonb,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, player_id)
);
create index on public.workout_logs(club_id);
create index on public.workout_logs(player_id);
create trigger workout_logs_updated before update on public.workout_logs for each row execute function public.set_updated_at();

create or replace function public.prepare_workout_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.training_sessions; p public.players;
begin
  select * into s from public.training_sessions where id = new.session_id;
  select * into p from public.players where id = new.player_id;
  if s.id is null or p.id is null or s.club_id <> p.club_id then raise exception 'session/player mismatch'; end if;
  if s.squad_id is not null and p.squad_id is distinct from s.squad_id then raise exception 'player not in this squad'; end if;
  if s.player_id is not null and s.player_id <> p.id then raise exception 'session is for another athlete'; end if;
  new.club_id := s.club_id;
  return new;
end $$;
create trigger workout_logs_prepare before insert or update of session_id, player_id on public.workout_logs
  for each row execute function public.prepare_workout_log();

-- AI USAGE (written by the edge function on behalf of the signed-in coach)
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,
  model text,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);
create index on public.ai_usage(club_id, created_at);
create index on public.ai_usage(user_id);

-- ===== RLS =====
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_logs enable row level security;
alter table public.ai_usage enable row level security;

create policy exercises_select on public.exercises for select to authenticated
  using (club_id is null or public.is_member(club_id));
create policy exercises_insert on public.exercises for insert to authenticated
  with check (club_id is not null and public.is_staff(club_id) and created_by = (select auth.uid()));
create policy exercises_update on public.exercises for update to authenticated
  using (club_id is not null and public.is_staff(club_id)) with check (club_id is not null and public.is_staff(club_id));
revoke update (club_id, created_by) on public.exercises from authenticated, anon;

create policy workouts_select on public.workouts for select to authenticated using (public.is_staff(club_id));
create policy workouts_insert on public.workouts for insert to authenticated
  with check (public.is_staff(club_id) and created_by = (select auth.uid()));
create policy workouts_update on public.workouts for update to authenticated
  using (public.is_staff(club_id)) with check (public.is_staff(club_id));
create policy workouts_delete on public.workouts for delete to authenticated
  using (public.is_director(club_id) or created_by = (select auth.uid()));
revoke update (club_id, created_by) on public.workouts from authenticated, anon;

create policy logs_select on public.workout_logs for select to authenticated
  using (public.is_staff(club_id) or public.is_own_player(player_id));
create policy logs_insert on public.workout_logs for insert to authenticated with check (public.is_own_player(player_id));
create policy logs_update on public.workout_logs for update to authenticated
  using (public.is_own_player(player_id)) with check (public.is_own_player(player_id));

create policy ai_usage_select on public.ai_usage for select to authenticated using (public.is_staff(club_id));
create policy ai_usage_insert on public.ai_usage for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_staff(club_id));

revoke execute on function public.prepare_workout_log() from public, anon, authenticated;
