-- Performance360 core schema (Phase 1)
-- Every table has row level security enabled. Authorization is enforced in the
-- database, never only in the UI. Privileged multi-row operations go through
-- SECURITY DEFINER functions that re-check the caller.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum (
  'performance_coach',
  'sc_coach',
  'personal_trainer',
  'physiotherapist',
  'sports_scientist',
  'athlete',
  'org_admin'
);

create type public.relationship_kind as enum ('primary', 'collaborator');
create type public.relationship_status as enum ('active', 'ended');
create type public.record_status as enum ('active', 'archived');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  role public.user_role,
  avatar_url text,
  locale text not null default 'en' check (locale in ('en', 'he')),
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  notification_prefs jsonb not null default '{"in_app": true, "email": false}'::jsonb,
  is_platform_admin boolean not null default false,
  onboarded_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, email, full_name, locale)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'locale' = 'he' then 'he' else 'en' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_professional(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles
    where id = p_user and role is not null and role <> 'athlete' and deactivated_at is null
  )
$$;

-- ---------------------------------------------------------------------------
-- Athletes
-- An athlete record may exist before the athlete has an account (created by a
-- coach). user_id links it to an account once the athlete connects.
-- ---------------------------------------------------------------------------
create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  owner_coach_id uuid references auth.users (id) on delete set null,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  date_of_birth date check (date_of_birth is null or date_of_birth > '1900-01-01'),
  gender text,
  preferred_language text check (preferred_language is null or preferred_language in ('en', 'he')),
  emergency_contact text,
  photo_url text,
  -- sporting
  sport text,
  team_name text,
  club text,
  position text,
  competitive_level text,
  training_age_years numeric(4, 1) check (training_age_years is null or training_age_years between 0 and 80),
  current_season text,
  dominant_side text check (dominant_side is null or dominant_side in ('left', 'right', 'both')),
  short_term_goals text,
  long_term_goals text,
  -- physical (canonical metric units; converted for display)
  height_cm numeric(5, 1) check (height_cm is null or height_cm between 50 and 260),
  body_mass_kg numeric(5, 1) check (body_mass_kg is null or body_mass_kg between 15 and 300),
  training_availability text,
  equipment_availability text,
  -- health & training context (athlete-reported; not a medical record)
  injury_history text,
  limitations text,
  rehab_status text,
  training_modifications text,
  status public.record_status not null default 'active',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index athletes_owner_idx on public.athletes (owner_coach_id);
create index athletes_email_idx on public.athletes (lower(email));

create trigger athletes_updated_at before update on public.athletes
  for each row execute function public.set_updated_at();

create table public.coach_athlete_relationships (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  kind public.relationship_kind not null default 'primary',
  status public.relationship_status not null default 'active',
  source text not null default 'created' check (source in ('created', 'code', 'transfer', 'admin')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason text
);

-- one active relationship per coach/athlete pair, one active primary coach per athlete
create unique index car_active_pair_uq on public.coach_athlete_relationships (coach_id, athlete_id)
  where status = 'active';
create unique index car_active_primary_uq on public.coach_athlete_relationships (athlete_id)
  where status = 'active' and kind = 'primary';
create index car_athlete_idx on public.coach_athlete_relationships (athlete_id);

-- Read access: the athlete themself, any professional with an active relationship, platform admin.
create or replace function public.can_access_athlete(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.athletes a where a.id = p_athlete and a.user_id = auth.uid())
      or exists (
        select 1 from public.coach_athlete_relationships r
        where r.athlete_id = p_athlete and r.coach_id = auth.uid() and r.status = 'active'
      )
      or public.is_platform_admin()
$$;

-- Professional write access (tests, notes, sessions): any active relationship.
create or replace function public.is_athlete_professional(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.coach_athlete_relationships r
    where r.athlete_id = p_athlete and r.coach_id = auth.uid() and r.status = 'active'
  )
$$;

-- Profile management (edit core profile, archive): primary coach only.
create or replace function public.is_primary_coach(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.coach_athlete_relationships r
    where r.athlete_id = p_athlete and r.coach_id = auth.uid()
      and r.status = 'active' and r.kind = 'primary'
  )
$$;

create or replace function public.is_own_athlete_record(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.athletes a where a.id = p_athlete and a.user_id = auth.uid())
$$;

-- When a coach creates an athlete record, they become its primary coach.
create or replace function public.athletes_after_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.owner_coach_id is not null then
    insert into public.coach_athlete_relationships (coach_id, athlete_id, kind, source)
    values (new.owner_coach_id, new.id, 'primary', 'created');
  end if;
  return new;
end $$;

create trigger athletes_after_insert after insert on public.athletes
  for each row execute function public.athletes_after_insert();

-- Guard fields that must not change through ordinary updates.
create or replace function public.athletes_guard_update()
returns trigger language plpgsql as $$
begin
  if new.user_id is distinct from old.user_id
     or new.owner_coach_id is distinct from old.owner_coach_id then
    if current_setting('p360.allow_link', true) is distinct from 'on' then
      raise exception 'athlete account links can only change through the invitation flow';
    end if;
  end if;
  if new.status is distinct from old.status then
    if not (public.is_primary_coach(old.id) or public.is_platform_admin()
            or current_setting('p360.allow_link', true) = 'on') then
      raise exception 'only the primary coach can archive or restore an athlete';
    end if;
    new.archived_at := case when new.status = 'archived' then now() else null end;
  end if;
  return new;
end $$;

create trigger athletes_guard_update before update on public.athletes
  for each row execute function public.athletes_guard_update();

alter table public.profiles enable row level security;
alter table public.athletes enable row level security;
alter table public.coach_athlete_relationships enable row level security;

-- Profiles: you see yourself, and the people you have an active relationship with.
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1 from public.coach_athlete_relationships r
    join public.athletes a on a.id = r.athlete_id
    where r.status = 'active'
      and ((r.coach_id = auth.uid() and a.user_id = profiles.id)
        or (a.user_id = auth.uid() and r.coach_id = profiles.id))
  )
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- role / admin flag / onboarding timestamps are not user-writable columns.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, locale, units, notification_prefs) on public.profiles to authenticated;

create policy athletes_select on public.athletes for select to authenticated
  using (public.can_access_athlete(id));
create policy athletes_insert on public.athletes for insert to authenticated
  with check (owner_coach_id = auth.uid() and user_id is null and public.is_professional());
create policy athletes_update on public.athletes for update to authenticated
  using (public.is_primary_coach(id) or user_id = auth.uid() or public.is_platform_admin())
  with check (public.is_primary_coach(id) or user_id = auth.uid() or public.is_platform_admin());
-- no delete policy: athletes are archived, never deleted by users.

create policy car_select on public.coach_athlete_relationships for select to authenticated using (
  coach_id = auth.uid() or public.is_own_athlete_record(athlete_id) or public.is_platform_admin()
);
-- relationships are only created/ended through SECURITY DEFINER functions.

-- ---------------------------------------------------------------------------
-- Audit log (append-only; written by definer functions and triggers)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

alter table public.audit_log enable row level security;
create policy audit_select on public.audit_log for select to authenticated
  using (actor_id = auth.uid() or public.is_platform_admin());

create or replace function public.write_audit(p_action text, p_entity text, p_entity_id text, p_meta jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'::jsonb));
$$;
revoke execute on function public.write_audit(text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select p_user, p_kind, p_title, p_body, p_link
  where p_user is not null
    and coalesce((select (notification_prefs ->> 'in_app')::boolean from public.profiles where id = p_user), true);
$$;
revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Coach codes & connection flow
-- ---------------------------------------------------------------------------
create table public.coach_codes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^P360-[A-Z0-9]{6}$'),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index coach_codes_one_active on public.coach_codes (coach_id) where status = 'active';

alter table public.coach_codes enable row level security;
create policy coach_codes_select on public.coach_codes for select to authenticated
  using (coach_id = auth.uid() or public.is_platform_admin());

-- Unambiguous alphabet (no 0/O/1/I/L), drawn from gen_random_uuid's CSPRNG.
create or replace function public.generate_code_string()
returns text language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := uuid_send(gen_random_uuid());
  out text := 'P360-';
begin
  for i in 0..5 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return out;
end $$;

create or replace function public.regenerate_coach_code()
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_code text;
begin
  if not public.is_professional() then
    raise exception 'only professionals have a personal code' using errcode = '42501';
  end if;
  update public.coach_codes set status = 'revoked', revoked_at = now()
   where coach_id = auth.uid() and status = 'active';
  loop
    v_code := public.generate_code_string();
    begin
      insert into public.coach_codes (coach_id, code) values (auth.uid(), v_code);
      exit;
    exception when unique_violation then
      -- collision: try again
    end;
  end loop;
  perform public.write_audit('coach_code.generated', 'coach_code', v_code);
  return v_code;
end $$;

create or replace function public.revoke_coach_code()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.coach_codes set status = 'revoked', revoked_at = now()
   where coach_id = auth.uid() and status = 'active';
  perform public.write_audit('coach_code.revoked', 'coach_code', null);
end $$;

-- Shows only the coach's public name for a valid active code (no other data).
create or replace function public.preview_coach_code(p_code text)
returns table (coach_name text, coach_role public.user_role)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.full_name, p.role
  from public.coach_codes c join public.profiles p on p.id = c.coach_id
  where c.code = upper(trim(p_code)) and c.status = 'active'
    and p.deactivated_at is null and auth.uid() is not null
$$;

-- Connect the calling athlete account to the coach who owns p_code.
-- Returns a status string the UI interprets:
--   connected | already_connected | needs_transfer_confirmation | invalid_code | not_athlete
create or replace function public.connect_with_coach_code(p_code text, p_confirm_transfer boolean default false)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_coach uuid;
  v_coach_role public.user_role;
  v_kind public.relationship_kind;
  v_athlete uuid;
  v_existing_primary uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.role is distinct from 'athlete' then return 'not_athlete'; end if;

  select c.coach_id, p.role into v_coach, v_coach_role
  from public.coach_codes c join public.profiles p on p.id = c.coach_id
  where c.code = upper(trim(p_code)) and c.status = 'active' and p.deactivated_at is null;
  if v_coach is null then
    perform public.write_audit('coach_code.invalid_attempt', 'coach_code', null, jsonb_build_object('code', left(p_code, 16)));
    return 'invalid_code';
  end if;
  if v_coach = v_uid then return 'invalid_code'; end if;

  v_kind := case when v_coach_role in ('physiotherapist', 'sports_scientist') then 'collaborator' else 'primary' end;

  perform set_config('p360.allow_link', 'on', true);

  -- Reuse the athlete's own record if one exists.
  select id into v_athlete from public.athletes where user_id = v_uid;

  -- Otherwise link an unlinked record this coach already created for the same email.
  if v_athlete is null then
    select id into v_athlete from public.athletes
     where owner_coach_id = v_coach and user_id is null
       and lower(email) = lower(v_profile.email)
     order by created_at limit 1;
    if v_athlete is not null then
      update public.athletes set user_id = v_uid where id = v_athlete;
      perform public.write_audit('athlete.account_linked', 'athlete', v_athlete::text, jsonb_build_object('coach_id', v_coach));
    end if;
  end if;

  if v_athlete is null then
    insert into public.athletes (user_id, full_name, email, preferred_language)
    values (v_uid, coalesce(nullif(v_profile.full_name, ''), v_profile.email), v_profile.email, v_profile.locale)
    returning id into v_athlete;
  end if;

  if exists (select 1 from public.coach_athlete_relationships
             where coach_id = v_coach and athlete_id = v_athlete and status = 'active') then
    return 'already_connected';
  end if;

  if v_kind = 'primary' then
    select coach_id into v_existing_primary from public.coach_athlete_relationships
     where athlete_id = v_athlete and status = 'active' and kind = 'primary';
    if v_existing_primary is not null then
      if not p_confirm_transfer then return 'needs_transfer_confirmation'; end if;
      update public.coach_athlete_relationships
         set status = 'ended', ended_at = now(), ended_reason = 'transferred'
       where athlete_id = v_athlete and status = 'active' and kind = 'primary';
      perform public.notify(v_existing_primary, 'connection.transferred', 'An athlete moved to another coach',
                            v_profile.full_name, '/athletes');
    end if;
  end if;

  insert into public.coach_athlete_relationships (coach_id, athlete_id, kind, source)
  values (v_coach, v_athlete, v_kind,
          case when v_existing_primary is not null then 'transfer' else 'code' end);

  perform public.write_audit('connection.created', 'athlete', v_athlete::text,
    jsonb_build_object('coach_id', v_coach, 'kind', v_kind, 'transfer', v_existing_primary is not null));
  perform public.notify(v_coach, 'connection.new', 'New athlete connected',
                        coalesce(nullif(v_profile.full_name, ''), v_profile.email), '/athletes/' || v_athlete);
  return 'connected';
end $$;

-- Either side may end an active relationship. History is kept.
create or replace function public.end_relationship(p_relationship uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.coach_athlete_relationships;
begin
  select * into r from public.coach_athlete_relationships where id = p_relationship and status = 'active';
  if r.id is null then raise exception 'relationship not found'; end if;
  if not (r.coach_id = auth.uid() or public.is_own_athlete_record(r.athlete_id) or public.is_platform_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.coach_athlete_relationships
     set status = 'ended', ended_at = now(), ended_reason = 'ended_by_user'
   where id = p_relationship;
  perform public.write_audit('connection.ended', 'athlete', r.athlete_id::text, jsonb_build_object('coach_id', r.coach_id));
end $$;

-- Role selection happens once, server-side. Professionals get a personal code.
create or replace function public.complete_onboarding(p_role public.user_role, p_full_name text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_current public.user_role;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_full_name, ''))) not between 1 and 120 then
    raise exception 'name is required';
  end if;
  select role into v_current from public.profiles where id = auth.uid();
  if v_current is not null and v_current <> p_role then
    raise exception 'role already set; contact support to change it' using errcode = '42501';
  end if;
  update public.profiles
     set role = p_role, full_name = trim(p_full_name), onboarded_at = coalesce(onboarded_at, now())
   where id = auth.uid();
  if p_role <> 'athlete' and not exists (select 1 from public.coach_codes where coach_id = auth.uid() and status = 'active') then
    perform public.regenerate_coach_code();
  end if;
  perform public.write_audit('profile.onboarded', 'profile', auth.uid()::text, jsonb_build_object('role', p_role));
end $$;

-- Users can deactivate their own account (data retained; sign-in still works
-- so they can export or reactivate via support).
create or replace function public.deactivate_my_account()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.profiles set deactivated_at = now() where id = auth.uid();
  update public.coach_codes set status = 'revoked', revoked_at = now() where coach_id = auth.uid() and status = 'active';
  perform public.write_audit('profile.deactivated', 'profile', auth.uid()::text);
end $$;

-- ---------------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  sport text,
  season text,
  description text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger teams_updated_at before update on public.teams
  for each row execute function public.set_updated_at();

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (team_id, athlete_id)
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create or replace function public.owns_team(p_team uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.teams where id = p_team and owner_id = auth.uid())
$$;

create policy teams_select on public.teams for select to authenticated using (
  owner_id = auth.uid() or public.is_platform_admin()
  or exists (select 1 from public.team_members m join public.athletes a on a.id = m.athlete_id
             where m.team_id = teams.id and a.user_id = auth.uid())
);
create policy teams_insert on public.teams for insert to authenticated
  with check (owner_id = auth.uid() and public.is_professional());
create policy teams_update on public.teams for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy teams_delete on public.teams for delete to authenticated using (owner_id = auth.uid());

create policy team_members_select on public.team_members for select to authenticated
  using (public.owns_team(team_id) or public.is_own_athlete_record(athlete_id));
-- team membership never grants data access by itself; the coach must already work with the athlete.
create policy team_members_insert on public.team_members for insert to authenticated
  with check (public.owns_team(team_id) and public.is_athlete_professional(athlete_id));
create policy team_members_delete on public.team_members for delete to authenticated
  using (public.owns_team(team_id));

-- ---------------------------------------------------------------------------
-- Athlete notes
-- ---------------------------------------------------------------------------
create table public.athlete_notes (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 5000),
  shared_with_athlete boolean not null default false,
  created_at timestamptz not null default now()
);
create index athlete_notes_athlete_idx on public.athlete_notes (athlete_id, created_at desc);
alter table public.athlete_notes enable row level security;

create policy notes_select on public.athlete_notes for select to authenticated using (
  public.is_athlete_professional(athlete_id)
  or (shared_with_athlete and public.is_own_athlete_record(athlete_id))
);
create policy notes_insert on public.athlete_notes for insert to authenticated
  with check (author_id = auth.uid() and public.is_athlete_professional(athlete_id));
create policy notes_delete on public.athlete_notes for delete to authenticated
  using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Exercise library
-- owner_id null = Performance360 system library (read-only for everyone).
-- ---------------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  category text not null check (category in (
    'strength', 'power', 'olympic', 'plyometrics', 'sprint', 'acceleration', 'max_velocity',
    'deceleration', 'cod', 'conditioning', 'mobility', 'stability', 'core', 'warmup',
    'recovery', 'rehab')),
  primary_objective text,
  movement_pattern text,
  primary_muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  difficulty text not null default 'intermediate' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  coaching_cues text[] not null default '{}',
  common_errors text[] not null default '{}',
  regressions text,
  progressions text,
  modification_notes text,
  suggested_prescription text,
  video_url text check (video_url is null or video_url ~* '^https://'),
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~* '^https://'),
  tags text[] not null default '{}',
  source text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exercises_owner_idx on public.exercises (owner_id);
create index exercises_category_idx on public.exercises (category);
create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

create table public.exercise_favorites (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table public.exercises enable row level security;
alter table public.exercise_favorites enable row level security;

create policy exercises_select on public.exercises for select to authenticated
  using (owner_id is null or owner_id = auth.uid() or public.is_platform_admin());
create policy exercises_insert on public.exercises for insert to authenticated
  with check (owner_id = auth.uid() and public.is_professional());
create policy exercises_update on public.exercises for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy exercises_delete on public.exercises for delete to authenticated
  using (owner_id = auth.uid());

create policy favorites_all on public.exercise_favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Training programs: Program -> Phase -> Week -> Session -> Exercise
-- ---------------------------------------------------------------------------
create table public.training_programs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 160),
  description text,
  program_type text not null default 'block' check (program_type in (
    'session', 'weekly', 'block', 'monthly', 'annual', 'preseason', 'inseason', 'offseason',
    'return_to_training', 'sport_specific')),
  sport text,
  goal text,
  num_weeks int not null default 4 check (num_weeks between 1 and 104),
  is_template boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  ai_generated boolean not null default false,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index programs_coach_idx on public.training_programs (coach_id);
create trigger programs_updated_at before update on public.training_programs
  for each row execute function public.set_updated_at();

create table public.program_phases (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs (id) on delete cascade,
  name text not null,
  cycle_level text not null default 'mesocycle' check (cycle_level in ('macrocycle', 'mesocycle', 'microcycle')),
  start_week int not null check (start_week >= 1),
  end_week int not null,
  objective text,
  check (end_week >= start_week)
);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs (id) on delete cascade,
  week_number int not null default 1 check (week_number between 1 and 104),
  day_number int not null default 1 check (day_number between 1 and 7),
  title text not null check (char_length(title) between 1 and 160),
  notes text,
  planned_duration_min int check (planned_duration_min is null or planned_duration_min between 1 and 600),
  created_at timestamptz not null default now()
);
create index sessions_program_idx on public.training_sessions (program_id, week_number, day_number);

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text not null,
  section text not null default 'strength' check (section in (
    'warmup', 'mobility', 'activation', 'sprint', 'plyometrics', 'strength', 'power', 'cod',
    'conditioning', 'core', 'recovery', 'cooldown')),
  position int not null default 0,
  sets int check (sets is null or sets between 1 and 50),
  reps text,
  duration_s int check (duration_s is null or duration_s > 0),
  distance_m numeric(8, 1) check (distance_m is null or distance_m > 0),
  load_kg numeric(6, 1) check (load_kg is null or load_kg >= 0),
  percent_1rm numeric(5, 1) check (percent_1rm is null or percent_1rm between 0 and 120),
  tempo text,
  rest_s int check (rest_s is null or rest_s >= 0),
  intensity_target text,
  rpe numeric(3, 1) check (rpe is null or rpe between 0 and 10),
  rir int check (rir is null or rir between 0 and 10),
  cues text,
  modifications text,
  notes text
);
create index session_exercises_session_idx on public.session_exercises (session_id, position);

create table public.program_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  assigned_by uuid not null references auth.users (id) default auth.uid(),
  start_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);
create unique index assignments_active_uq on public.program_assignments (program_id, athlete_id) where status = 'active';
create index assignments_athlete_idx on public.program_assignments (athlete_id);

create table public.program_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs (id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  note text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (program_id, version)
);

-- Completion log: what the athlete actually did.
create table public.workout_completions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  completed_on date not null default current_date,
  status text not null default 'completed' check (status in ('completed', 'partial', 'skipped')),
  duration_min int check (duration_min is null or duration_min between 1 and 600),
  session_rpe numeric(3, 1) check (session_rpe is null or session_rpe between 0 and 10),
  athlete_feedback text,
  coach_feedback text,
  recorded_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (session_id, athlete_id, completed_on)
);
create index completions_athlete_idx on public.workout_completions (athlete_id, completed_on desc);

create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null references public.workout_completions (id) on delete cascade,
  session_exercise_id uuid not null references public.session_exercises (id) on delete cascade,
  done boolean not null default true,
  actual_sets int,
  actual_reps text,
  actual_load_kg numeric(6, 1),
  feedback text,
  unique (completion_id, session_exercise_id)
);

alter table public.training_programs enable row level security;
alter table public.program_phases enable row level security;
alter table public.training_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.program_assignments enable row level security;
alter table public.program_versions enable row level security;
alter table public.workout_completions enable row level security;
alter table public.exercise_logs enable row level security;

create or replace function public.owns_program(p_program uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.training_programs where id = p_program and coach_id = auth.uid())
$$;

-- An athlete sees a program only while it is actively assigned to them.
create or replace function public.can_view_program(p_program uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.owns_program(p_program)
      or public.is_platform_admin()
      or exists (
        select 1 from public.program_assignments pa
        join public.athletes a on a.id = pa.athlete_id
        where pa.program_id = p_program and pa.status = 'active' and a.user_id = auth.uid()
      )
$$;

create or replace function public.session_program(p_session uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select program_id from public.training_sessions where id = p_session
$$;

-- coach_id is checked directly so INSERT ... RETURNING can see the row being created.
create policy programs_select on public.training_programs for select to authenticated
  using (coach_id = auth.uid() or public.can_view_program(id));
create policy programs_insert on public.training_programs for insert to authenticated
  with check (coach_id = auth.uid() and public.is_professional());
create policy programs_update on public.training_programs for update to authenticated
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy programs_delete on public.training_programs for delete to authenticated
  using (coach_id = auth.uid() and not exists (
    select 1 from public.program_assignments pa where pa.program_id = training_programs.id));

create policy phases_select on public.program_phases for select to authenticated using (public.can_view_program(program_id));
create policy phases_write on public.program_phases for all to authenticated
  using (public.owns_program(program_id)) with check (public.owns_program(program_id));

create policy sessions_select on public.training_sessions for select to authenticated using (public.can_view_program(program_id));
create policy sessions_write on public.training_sessions for all to authenticated
  using (public.owns_program(program_id)) with check (public.owns_program(program_id));

create policy session_ex_select on public.session_exercises for select to authenticated
  using (public.can_view_program(public.session_program(session_id)));
create policy session_ex_write on public.session_exercises for all to authenticated
  using (public.owns_program(public.session_program(session_id)))
  with check (public.owns_program(public.session_program(session_id)));

create policy assignments_select on public.program_assignments for select to authenticated
  using (public.owns_program(program_id) or public.is_own_athlete_record(athlete_id)
         or public.is_athlete_professional(athlete_id));
create policy assignments_insert on public.program_assignments for insert to authenticated
  with check (assigned_by = auth.uid() and public.owns_program(program_id) and public.is_athlete_professional(athlete_id));
create policy assignments_update on public.program_assignments for update to authenticated
  using (public.owns_program(program_id)) with check (public.owns_program(program_id));

create policy versions_select on public.program_versions for select to authenticated using (public.owns_program(program_id));
create policy versions_insert on public.program_versions for insert to authenticated
  with check (public.owns_program(program_id));

create or replace function public.can_view_program_for_athlete(p_program uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.program_assignments pa
    where pa.program_id = p_program and pa.athlete_id = p_athlete and pa.status = 'active'
  )
$$;

-- The athlete logs their own sessions; their professionals may log on their behalf.
create policy completions_select on public.workout_completions for select to authenticated
  using (public.can_access_athlete(athlete_id));
create policy completions_insert on public.workout_completions for insert to authenticated
  with check (
    (public.is_own_athlete_record(athlete_id) or public.is_athlete_professional(athlete_id))
    and public.can_view_program_for_athlete(public.session_program(session_id), athlete_id)
  );
create policy completions_update on public.workout_completions for update to authenticated
  using (public.is_own_athlete_record(athlete_id) or public.is_athlete_professional(athlete_id))
  with check (public.is_own_athlete_record(athlete_id) or public.is_athlete_professional(athlete_id));

create or replace function public.completion_athlete(p_completion uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select athlete_id from public.workout_completions where id = p_completion
$$;

create policy logs_select on public.exercise_logs for select to authenticated
  using (public.can_access_athlete(public.completion_athlete(completion_id)));
create policy logs_write on public.exercise_logs for all to authenticated
  using (public.is_own_athlete_record(public.completion_athlete(completion_id))
         or public.is_athlete_professional(public.completion_athlete(completion_id)))
  with check (public.is_own_athlete_record(public.completion_athlete(completion_id))
         or public.is_athlete_professional(public.completion_athlete(completion_id)));

-- Notify the athlete when a program is assigned.
create or replace function public.assignments_after_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid;
  v_title text;
begin
  select user_id into v_user from public.athletes where id = new.athlete_id;
  select title into v_title from public.training_programs where id = new.program_id;
  perform public.notify(v_user, 'program.assigned', 'New training plan assigned', v_title, '/training');
  perform public.write_audit('program.assigned', 'program', new.program_id::text, jsonb_build_object('athlete_id', new.athlete_id));
  return new;
end $$;
create trigger assignments_after_insert after insert on public.program_assignments
  for each row execute function public.assignments_after_insert();

-- ---------------------------------------------------------------------------
-- Performance testing
-- ---------------------------------------------------------------------------
create table public.test_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null,
  short_name text,
  category text not null check (category in ('jump', 'speed', 'cod', 'endurance', 'strength', 'mobility', 'custom')),
  unit text not null,
  higher_is_better boolean not null,
  bilateral boolean not null default false,
  protocol text,
  default_trials int not null default 3 check (default_trials between 1 and 10),
  created_at timestamptz not null default now()
);

create table public.test_results (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  test_id uuid not null references public.test_definitions (id),
  tested_on date not null default current_date,
  side text not null default 'both' check (side in ('both', 'left', 'right')),
  trials numeric(10, 3)[] not null check (cardinality(trials) between 1 and 10),
  method text,
  conditions text,
  data_quality text not null default 'good' check (data_quality in ('good', 'questionable', 'poor')),
  is_baseline boolean not null default false,
  notes text,
  tester_id uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index test_results_athlete_idx on public.test_results (athlete_id, test_id, tested_on);

create table public.test_batteries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  description text,
  test_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.test_definitions enable row level security;
alter table public.test_results enable row level security;
alter table public.test_batteries enable row level security;

create policy testdefs_select on public.test_definitions for select to authenticated
  using (owner_id is null or owner_id = auth.uid()
         or exists (select 1 from public.test_results r where r.test_id = test_definitions.id
                    and public.can_access_athlete(r.athlete_id)));
create policy testdefs_insert on public.test_definitions for insert to authenticated
  with check (owner_id = auth.uid() and public.is_professional());
create policy testdefs_update on public.test_definitions for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy results_select on public.test_results for select to authenticated
  using (public.can_access_athlete(athlete_id));
create policy results_insert on public.test_results for insert to authenticated
  with check (tester_id = auth.uid() and public.is_athlete_professional(athlete_id));
create policy results_update on public.test_results for update to authenticated
  using (tester_id = auth.uid() and public.is_athlete_professional(athlete_id))
  with check (tester_id = auth.uid() and public.is_athlete_professional(athlete_id));
create policy results_delete on public.test_results for delete to authenticated
  using (tester_id = auth.uid() and public.is_athlete_professional(athlete_id));

create policy batteries_all on public.test_batteries for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_professional());

-- ---------------------------------------------------------------------------
-- Readiness monitoring
-- ---------------------------------------------------------------------------
create table public.readiness_entries (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  entry_date date not null default current_date,
  sleep_hours numeric(3, 1) check (sleep_hours is null or sleep_hours between 0 and 24),
  sleep_quality int check (sleep_quality between 1 and 5),
  fatigue int check (fatigue between 1 and 5),
  soreness int check (soreness between 1 and 5),
  stress int check (stress between 1 and 5),
  mood int check (mood between 1 and 5),
  motivation int check (motivation between 1 and 5),
  pain_reported boolean not null default false,
  pain_notes text,
  notes text,
  created_at timestamptz not null default now(),
  unique (athlete_id, entry_date)
);

alter table public.readiness_entries enable row level security;
create policy readiness_select on public.readiness_entries for select to authenticated
  using (public.can_access_athlete(athlete_id));
create policy readiness_insert on public.readiness_entries for insert to authenticated
  with check (public.is_own_athlete_record(athlete_id));
create policy readiness_update on public.readiness_entries for update to authenticated
  using (public.is_own_athlete_record(athlete_id)) with check (public.is_own_athlete_record(athlete_id));

-- ---------------------------------------------------------------------------
-- Athlete self-profile (athlete onboarding without a coach)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_my_athlete_record()
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.role is distinct from 'athlete' then raise exception 'not an athlete' using errcode = '42501'; end if;
  select id into v_id from public.athletes where user_id = auth.uid();
  if v_id is null then
    insert into public.athletes (user_id, full_name, email, preferred_language)
    values (auth.uid(), coalesce(nullif(v_profile.full_name, ''), v_profile.email), v_profile.email, v_profile.locale)
    returning id into v_id;
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------------------
revoke execute on function public.generate_code_string() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function
  public.regenerate_coach_code(),
  public.revoke_coach_code(),
  public.preview_coach_code(text),
  public.connect_with_coach_code(text, boolean),
  public.end_relationship(uuid),
  public.complete_onboarding(public.user_role, text),
  public.deactivate_my_account(),
  public.ensure_my_athlete_record()
to authenticated;
