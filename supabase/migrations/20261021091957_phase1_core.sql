-- Phase 1 core: clubs, roles, squads, players, invites, wellness check-ins, coach notes. All tables use RLS.
create extension if not exists pgcrypto with schema extensions;

create type public.club_role as enum ('director','coach','athlete');
create type public.player_status as enum ('available','injured','rehab','unavailable');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  locale text not null default 'he' check (locale in ('he','en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CLUBS
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.club_members (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.club_role not null,
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index on public.club_members(user_id);

-- SQUADS
create table public.squads (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  age_group text,
  season text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.squads(club_id);

create table public.squad_staff (
  squad_id uuid not null references public.squads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (squad_id, user_id)
);
create index on public.squad_staff(user_id);

-- PLAYERS
create table public.players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  squad_id uuid references public.squads(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  date_of_birth date,
  position text check (position in ('GK','DF','MF','FW')),
  shirt_number int check (shirt_number between 0 and 999),
  dominant_foot text check (dominant_foot in ('left','right','both')),
  height_cm numeric(5,1) check (height_cm between 80 and 250),
  weight_kg numeric(5,1) check (weight_kg between 20 and 200),
  status public.player_status not null default 'available',
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, user_id)
);
create index on public.players(club_id);
create index on public.players(squad_id);
create index on public.players(user_id);

-- INVITES
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  role public.club_role not null,
  player_id uuid references public.players(id) on delete cascade,
  squad_id uuid references public.squads(id) on delete set null,
  email text,
  token text not null unique default encode(extensions.gen_random_bytes(18),'hex'),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (role <> 'athlete' or player_id is not null)
);
create index on public.invites(club_id);

-- WELLNESS CHECK-INS
create table public.wellness_checkins (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  entry_date date not null default current_date,
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 16),
  sleep smallint not null check (sleep between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  freshness smallint not null check (freshness between 1 and 5),
  calm smallint not null check (calm between 1 and 5),
  mood smallint not null check (mood between 1 and 5),
  readiness smallint generated always as (round(((sleep+energy+freshness+calm+mood)/5.0 - 1)/4*100)) stored,
  pain boolean not null default false,
  pain_area text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, entry_date)
);
create index on public.wellness_checkins(club_id, entry_date);

-- PLAYER NOTES
create table public.player_notes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  shared_with_athlete boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.player_notes(player_id);

-- ===== helper functions (security definer, fixed search_path) =====
create or replace function public.my_role(p_club uuid) returns public.club_role
language sql stable security definer set search_path = '' as $$
  select role from public.club_members where club_id = p_club and user_id = auth.uid()
$$;

create or replace function public.is_member(p_club uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.club_members where club_id = p_club and user_id = auth.uid())
$$;

create or replace function public.is_staff(p_club uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.club_members where club_id = p_club and user_id = auth.uid() and role in ('director','coach'))
$$;

create or replace function public.is_director(p_club uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.club_members where club_id = p_club and user_id = auth.uid() and role = 'director')
$$;

create or replace function public.coaches_squad(p_squad uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.squad_staff where squad_id = p_squad and user_id = auth.uid())
$$;

create or replace function public.is_own_player(p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.players where id = p_player and user_id = auth.uid() and archived_at is null)
$$;

create or replace function public.can_edit_player(p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.players p
    where p.id = p_player
      and (public.is_director(p.club_id) or (p.squad_id is not null and public.coaches_squad(p.squad_id)))
  )
$$;

create or replace function public.shares_club(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.club_members a join public.club_members b on a.club_id = b.club_id
    where a.user_id = auth.uid() and b.user_id = p_user
  )
$$;

-- ===== triggers =====
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger players_updated before update on public.players for each row execute function public.set_updated_at();
create trigger wellness_updated before update on public.wellness_checkins for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, locale)
  values (new.id,
          nullif(trim(new.raw_user_meta_data->>'full_name'),''),
          case when new.raw_user_meta_data->>'locale' in ('he','en') then new.raw_user_meta_data->>'locale' else 'he' end)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- club_id on child rows always comes from the player
create or replace function public.set_club_from_player() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select club_id into new.club_id from public.players where id = new.player_id;
  if new.club_id is null then raise exception 'player not found'; end if;
  return new;
end $$;
create trigger wellness_club before insert or update of player_id on public.wellness_checkins for each row execute function public.set_club_from_player();
create trigger notes_club before insert or update of player_id on public.player_notes for each row execute function public.set_club_from_player();

-- squad must belong to the player's club
create or replace function public.check_player_squad() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.squad_id is not null and not exists(select 1 from public.squads where id = new.squad_id and club_id = new.club_id) then
    raise exception 'squad does not belong to this club';
  end if;
  return new;
end $$;
create trigger players_squad_check before insert or update of squad_id, club_id on public.players for each row execute function public.check_player_squad();

-- ===== RPCs =====
create or replace function public.create_club(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.clubs(name, created_by) values (trim(p_name), auth.uid()) returning id into v_id;
  insert into public.club_members(club_id, user_id, role) values (v_id, auth.uid(), 'director');
  return v_id;
end $$;

create or replace function public.preview_invite(p_token text) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object('club', c.name, 'role', i.role, 'player', p.full_name, 'squad', s.name,
    'valid', i.revoked_at is null and i.accepted_at is null and i.expires_at > now())
  from public.invites i
  join public.clubs c on c.id = i.club_id
  left join public.players p on p.id = i.player_id
  left join public.squads s on s.id = i.squad_id
  where i.token = p_token
$$;

create or replace function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare i public.invites; v_existing public.club_role;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into i from public.invites where token = p_token for update;
  if i.id is null then raise exception 'invite_not_found'; end if;
  if i.revoked_at is not null or i.accepted_at is not null or i.expires_at <= now() then raise exception 'invite_invalid'; end if;

  select role into v_existing from public.club_members where club_id = i.club_id and user_id = auth.uid();
  if v_existing is null then
    insert into public.club_members(club_id, user_id, role) values (i.club_id, auth.uid(), i.role);
  elsif v_existing = 'athlete' and i.role <> 'athlete' then
    update public.club_members set role = i.role where club_id = i.club_id and user_id = auth.uid();
  end if;

  if i.role = 'athlete' then
    if exists(select 1 from public.players where club_id = i.club_id and user_id = auth.uid() and id <> i.player_id) then
      raise exception 'already_linked_to_other_player';
    end if;
    update public.players set user_id = auth.uid() where id = i.player_id and (user_id is null or user_id = auth.uid());
    if not found then raise exception 'player_already_claimed'; end if;
  elsif i.squad_id is not null then
    insert into public.squad_staff(squad_id, user_id) values (i.squad_id, auth.uid()) on conflict do nothing;
  end if;

  update public.invites set accepted_at = now(), accepted_by = auth.uid() where id = i.id;
  return i.club_id;
end $$;

-- ===== RLS =====
alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.squads enable row level security;
alter table public.squad_staff enable row level security;
alter table public.players enable row level security;
alter table public.invites enable row level security;
alter table public.wellness_checkins enable row level security;
alter table public.player_notes enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_club(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy clubs_select on public.clubs for select to authenticated using (public.is_member(id));
create policy clubs_update on public.clubs for update to authenticated using (public.is_director(id)) with check (public.is_director(id));

create policy members_select on public.club_members for select to authenticated using (public.is_member(club_id));
create policy members_update on public.club_members for update to authenticated
  using (public.is_director(club_id) and user_id <> (select auth.uid())) with check (public.is_director(club_id));
create policy members_delete on public.club_members for delete to authenticated
  using (public.is_director(club_id) and user_id <> (select auth.uid()));

create policy squads_select on public.squads for select to authenticated using (public.is_member(club_id));
create policy squads_insert on public.squads for insert to authenticated with check (public.is_director(club_id));
create policy squads_update on public.squads for update to authenticated
  using (public.is_director(club_id) or public.coaches_squad(id)) with check (public.is_director(club_id) or public.coaches_squad(id));
create policy squads_delete on public.squads for delete to authenticated using (public.is_director(club_id));

create policy squad_staff_select on public.squad_staff for select to authenticated
  using (exists(select 1 from public.squads s where s.id = squad_id and public.is_member(s.club_id)));
create policy squad_staff_insert on public.squad_staff for insert to authenticated
  with check (exists(select 1 from public.squads s where s.id = squad_id and public.is_director(s.club_id))
              and exists(select 1 from public.squads s join public.club_members m on m.club_id = s.club_id
                         where s.id = squad_id and m.user_id = squad_staff.user_id and m.role in ('director','coach')));
create policy squad_staff_delete on public.squad_staff for delete to authenticated
  using (exists(select 1 from public.squads s where s.id = squad_id and public.is_director(s.club_id)));

create policy players_select on public.players for select to authenticated
  using (public.is_staff(club_id) or user_id = (select auth.uid()));
create policy players_insert on public.players for insert to authenticated
  with check (user_id is null and (public.is_director(club_id) or (squad_id is not null and public.coaches_squad(squad_id))));
create policy players_update on public.players for update to authenticated
  using (public.is_director(club_id) or (squad_id is not null and public.coaches_squad(squad_id)))
  with check (public.is_director(club_id) or (squad_id is not null and public.coaches_squad(squad_id)));
create policy players_delete on public.players for delete to authenticated using (public.is_director(club_id));
-- identity columns can only change through accept_invite / never
revoke update (user_id, club_id) on public.players from authenticated, anon;

create policy invites_select on public.invites for select to authenticated using (public.is_staff(club_id));
create policy invites_insert on public.invites for insert to authenticated
  with check (created_by = (select auth.uid()) and accepted_at is null and revoked_at is null and (
    public.is_director(club_id)
    or (role = 'athlete' and public.can_edit_player(player_id))
  ) and (player_id is null or exists(select 1 from public.players p where p.id = player_id and p.club_id = invites.club_id))
    and (squad_id is null or exists(select 1 from public.squads s where s.id = squad_id and s.club_id = invites.club_id)));
create policy invites_update on public.invites for update to authenticated
  using (public.is_director(club_id) or created_by = (select auth.uid()))
  with check (public.is_director(club_id) or created_by = (select auth.uid()));
revoke update on public.invites from authenticated, anon;
grant update (revoked_at) on public.invites to authenticated;

create policy wellness_select on public.wellness_checkins for select to authenticated
  using (public.is_staff(club_id) or public.is_own_player(player_id));
create policy wellness_insert on public.wellness_checkins for insert to authenticated
  with check (public.is_own_player(player_id) and entry_date between current_date - 1 and current_date + 1);
create policy wellness_update on public.wellness_checkins for update to authenticated
  using (public.is_own_player(player_id)) with check (public.is_own_player(player_id) and entry_date between current_date - 1 and current_date + 1);

create policy notes_select on public.player_notes for select to authenticated
  using (public.is_staff(club_id) or (shared_with_athlete and public.is_own_player(player_id)));
create policy notes_insert on public.player_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_staff(club_id) and public.can_edit_player(player_id) or
              (author_id = (select auth.uid()) and public.is_staff(club_id)));
create policy notes_update on public.player_notes for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy notes_delete on public.player_notes for delete to authenticated using (author_id = (select auth.uid()));

-- lock down function execution
revoke execute on all functions in schema public from public, anon;
grant execute on function public.create_club(text), public.accept_invite(text), public.preview_invite(text) to authenticated;
grant execute on function public.preview_invite(text) to anon;
grant execute on function public.my_role(uuid), public.is_member(uuid), public.is_staff(uuid), public.is_director(uuid),
  public.coaches_squad(uuid), public.is_own_player(uuid), public.can_edit_player(uuid), public.shares_club(uuid) to authenticated;
