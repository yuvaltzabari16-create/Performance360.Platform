-- Team (organization) accounts: a director creates a team; staff join with single-use
-- invite codes and hold a role in it; athletes join the team's roster by consenting
-- with the team's athlete code.
--
-- Privacy model:
--   * Staff (everyone except the director) can work with the athletes on the team's roster.
--   * The director sees the roster list and aggregated counts only, never individual
--     athlete records.
--   * Roster membership needs the athlete's consent (own account), or - for athletes who
--     have no account yet - the adding staff member's assertion, which is recorded.
--   * An athlete can leave the team at any time; staff access ends immediately.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  sport text,
  created_by uuid references auth.users (id) on delete set null,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  org_role text not null check (org_role in (
    'director', 'head_coach', 'head_of_performance', 'assistant_coach',
    'physiotherapist', 'sports_scientist', 'other_staff')),
  status text not null default 'active' check (status in ('active', 'removed')),
  joined_at timestamptz not null default now(),
  removed_at timestamptz
);
-- a person belongs to one team at a time
create unique index org_members_one_active_org on public.organization_members (user_id) where status = 'active';
create index org_members_org_idx on public.organization_members (org_id) where status = 'active';

create table public.organization_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('staff', 'athlete')),
  code text not null unique,
  org_role text check (org_role in (
    'director', 'head_coach', 'head_of_performance', 'assistant_coach',
    'physiotherapist', 'sports_scientist', 'other_staff')),
  status text not null default 'active' check (status in ('active', 'revoked', 'used')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  check (
    (kind = 'staff' and org_role is not null and code ~ '^STAFF-[A-Z0-9]{6}$')
    or (kind = 'athlete' and org_role is null and code ~ '^TEAM-[A-Z0-9]{6}$')
  )
);
create unique index org_one_active_athlete_code on public.organization_codes (org_id)
  where kind = 'athlete' and status = 'active';

create table public.organization_athletes (
  org_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'left')),
  consent_source text not null check (consent_source in ('athlete', 'staff_asserted')),
  consented_at timestamptz not null default now(),
  added_by uuid references auth.users (id) on delete set null,
  left_at timestamptz,
  primary key (org_id, athlete_id)
);
create index org_athletes_athlete_idx on public.organization_athletes (athlete_id) where status = 'active';

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_codes enable row level security;
alter table public.organization_athletes enable row level security;

-- All writes go through the SECURITY DEFINER functions below.
revoke insert, update, delete on
  public.organizations, public.organization_members, public.organization_codes, public.organization_athletes
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies can use them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.my_org_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select org_id from public.organization_members where user_id = auth.uid() and status = 'active'
$$;

create or replace function public.my_org_role()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select org_role from public.organization_members where user_id = auth.uid() and status = 'active'
$$;

create or replace function public.is_org_director(p_org uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.organization_members
    where org_id = p_org and user_id = auth.uid() and status = 'active' and org_role = 'director')
$$;

-- Staff access to a roster athlete: any active non-director member of a team the athlete is on.
create or replace function public.is_org_staff_for_athlete(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organization_athletes oa on oa.org_id = m.org_id and oa.status = 'active'
    where m.user_id = auth.uid() and m.status = 'active' and m.org_role <> 'director'
      and oa.athlete_id = p_athlete)
$$;

-- Profile-level management (edit, archive): head coach and head of performance.
create or replace function public.is_org_lead_for_athlete(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organization_athletes oa on oa.org_id = m.org_id and oa.status = 'active'
    where m.user_id = auth.uid() and m.status = 'active'
      and m.org_role in ('head_coach', 'head_of_performance')
      and oa.athlete_id = p_athlete)
$$;

create or replace function public.org_role_to_profile_role(p_org_role text)
returns public.user_role language sql immutable set search_path = public, pg_temp as $$
  select (case p_org_role
    when 'director' then 'org_admin'
    when 'head_coach' then 'performance_coach'
    when 'head_of_performance' then 'performance_coach'
    when 'assistant_coach' then 'sc_coach'
    when 'physiotherapist' then 'physiotherapist'
    else 'sports_scientist' end)::public.user_role
$$;

create or replace function public.generate_prefixed_code(p_prefix text)
returns text language plpgsql volatile set search_path = public, pg_temp as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := uuid_send(gen_random_uuid());
  out text := p_prefix;
begin
  for i in 0..5 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return out;
end $$;

-- Extend the existing access helpers (policies on every athlete table use them).
create or replace function public.can_access_athlete(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.athletes a where a.id = p_athlete and a.user_id = auth.uid())
      or exists (
        select 1 from public.coach_athlete_relationships r
        where r.athlete_id = p_athlete and r.coach_id = auth.uid() and r.status = 'active')
      or public.is_org_staff_for_athlete(p_athlete)
      or public.is_platform_admin()
$$;

create or replace function public.is_athlete_professional(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.coach_athlete_relationships r
    where r.athlete_id = p_athlete and r.coach_id = auth.uid() and r.status = 'active')
    or public.is_org_staff_for_athlete(p_athlete)
$$;

create or replace function public.is_primary_coach(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.coach_athlete_relationships r
    where r.athlete_id = p_athlete and r.coach_id = auth.uid()
      and r.status = 'active' and r.kind = 'primary')
    or public.is_org_lead_for_athlete(p_athlete)
$$;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
create policy org_athletes_select on public.organization_athletes for select to authenticated
  using (org_id = public.my_org_id() or public.is_own_athlete_record(athlete_id) or public.is_platform_admin());

create policy orgs_select on public.organizations for select to authenticated using (
  id = public.my_org_id()
  or exists (select 1 from public.organization_athletes oa
             where oa.org_id = organizations.id and oa.status = 'active' and public.is_own_athlete_record(oa.athlete_id))
  or public.is_platform_admin());

create policy org_members_select on public.organization_members for select to authenticated using (
  org_id = public.my_org_id()
  or exists (select 1 from public.organization_athletes oa
             where oa.org_id = organization_members.org_id and oa.status = 'active' and public.is_own_athlete_record(oa.athlete_id))
  or public.is_platform_admin());

create policy org_codes_select on public.organization_codes for select to authenticated
  using (public.is_org_director(org_id) or public.is_platform_admin());

-- Profiles: also visible between colleagues, from staff to roster athletes, and from athletes to their team's staff.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1 from public.coach_athlete_relationships r
    join public.athletes a on a.id = r.athlete_id
    where r.status = 'active'
      and ((r.coach_id = auth.uid() and a.user_id = profiles.id)
        or (a.user_id = auth.uid() and r.coach_id = profiles.id)))
  or exists (
    select 1 from public.organization_members m
    where m.user_id = profiles.id and m.status = 'active' and m.org_id = public.my_org_id())
  or exists (
    select 1 from public.athletes a
    join public.organization_athletes oa on oa.athlete_id = a.id and oa.status = 'active'
    where a.user_id = profiles.id and oa.org_id = public.my_org_id() and public.my_org_role() <> 'director')
  or exists (
    select 1 from public.organization_members m
    join public.organization_athletes oa on oa.org_id = m.org_id and oa.status = 'active'
    where m.user_id = profiles.id and m.status = 'active' and public.is_own_athlete_record(oa.athlete_id))
);

-- ---------------------------------------------------------------------------
-- Team lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(p_name text, p_sport text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_role public.user_role;
  v_code text;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 120 then raise exception 'team name is required'; end if;
  if char_length(trim(coalesce(p_full_name, ''))) not between 1 and 120 then raise exception 'name is required'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role is not null then raise exception 'account already set up' using errcode = '42501'; end if;

  insert into public.organizations (name, sport, created_by)
  values (trim(p_name), nullif(trim(coalesce(p_sport, '')), ''), v_uid) returning id into v_org;
  insert into public.organization_members (org_id, user_id, org_role) values (v_org, v_uid, 'director');
  update public.profiles
     set role = 'org_admin', full_name = trim(p_full_name), onboarded_at = coalesce(onboarded_at, now())
   where id = v_uid;

  loop
    v_code := public.generate_prefixed_code('TEAM-');
    begin
      insert into public.organization_codes (org_id, kind, code, created_by) values (v_org, 'athlete', v_code, v_uid);
      exit;
    exception when unique_violation then
    end;
  end loop;
  perform public.write_audit('organization.created', 'organization', v_org::text);
  return v_org;
end $$;

create or replace function public.preview_staff_code(p_code text)
returns table (org_name text, org_role text)
language sql stable security definer set search_path = public, pg_temp as $$
  select o.name, c.org_role
  from public.organization_codes c join public.organizations o on o.id = c.org_id
  where c.code = upper(trim(p_code)) and c.kind = 'staff' and c.status = 'active'
    and (c.expires_at is null or c.expires_at > now()) and o.status = 'active' and auth.uid() is not null
$$;

-- returns: joined | invalid_code | already_member | not_allowed
create or replace function public.join_organization(p_code text, p_full_name text default null)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  c public.organization_codes;
  v_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_org_name text;
  d record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.role = 'athlete' then return 'not_allowed'; end if;

  select * into c from public.organization_codes
   where code = upper(trim(p_code)) and kind = 'staff' and status = 'active'
     and (expires_at is null or expires_at > now())
   for update;
  if c.id is null then
    perform public.write_audit('organization.invalid_staff_code', 'organization_code', null, jsonb_build_object('code', left(p_code, 16)));
    return 'invalid_code';
  end if;
  if exists (select 1 from public.organization_members where user_id = v_uid and status = 'active') then
    return 'already_member';
  end if;
  if v_profile.role is null and v_name is null and nullif(v_profile.full_name, '') is null then
    raise exception 'name is required';
  end if;

  insert into public.organization_members (org_id, user_id, org_role) values (c.org_id, v_uid, c.org_role);
  update public.organization_codes set status = 'used', used_by = v_uid, used_at = now() where id = c.id;
  update public.profiles
     set role = coalesce(role, public.org_role_to_profile_role(c.org_role)),
         full_name = coalesce(v_name, full_name),
         onboarded_at = coalesce(onboarded_at, now())
   where id = v_uid;

  select name into v_org_name from public.organizations where id = c.org_id;
  for d in select user_id from public.organization_members
            where org_id = c.org_id and status = 'active' and org_role = 'director' and user_id <> v_uid loop
    perform public.notify(d.user_id, 'team.staff_joined', 'New staff member joined', coalesce(v_name, v_profile.full_name), '/team');
  end loop;
  perform public.write_audit('organization.staff_joined', 'organization', c.org_id::text,
    jsonb_build_object('org_role', c.org_role));
  return 'joined';
end $$;

create or replace function public.create_staff_invite(p_org_role text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid := public.my_org_id();
  v_code text;
begin
  if v_org is null or not public.is_org_director(v_org) then raise exception 'only the director can invite staff' using errcode = '42501'; end if;
  if p_org_role not in ('director', 'head_coach', 'head_of_performance', 'assistant_coach', 'physiotherapist', 'sports_scientist', 'other_staff') then
    raise exception 'invalid role';
  end if;
  loop
    v_code := public.generate_prefixed_code('STAFF-');
    begin
      insert into public.organization_codes (org_id, kind, code, org_role, created_by, expires_at)
      values (v_org, 'staff', v_code, p_org_role, auth.uid(), now() + interval '14 days');
      exit;
    exception when unique_violation then
    end;
  end loop;
  perform public.write_audit('organization.staff_invite_created', 'organization', v_org::text, jsonb_build_object('org_role', p_org_role));
  return v_code;
end $$;

create or replace function public.revoke_org_code(p_code_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid := public.my_org_id();
begin
  if v_org is null or not public.is_org_director(v_org) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.organization_codes set status = 'revoked', revoked_at = now()
   where id = p_code_id and org_id = v_org and status = 'active';
  perform public.write_audit('organization.code_revoked', 'organization', v_org::text);
end $$;

create or replace function public.regenerate_org_athlete_code()
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid := public.my_org_id();
  v_code text;
begin
  if v_org is null or not public.is_org_director(v_org) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.organization_codes set status = 'revoked', revoked_at = now()
   where org_id = v_org and kind = 'athlete' and status = 'active';
  loop
    v_code := public.generate_prefixed_code('TEAM-');
    begin
      insert into public.organization_codes (org_id, kind, code, created_by) values (v_org, 'athlete', v_code, auth.uid());
      exit;
    exception when unique_violation then
    end;
  end loop;
  perform public.write_audit('organization.athlete_code_generated', 'organization', v_org::text);
  return v_code;
end $$;

create or replace function public.set_org_member_role(p_user uuid, p_org_role text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid := public.my_org_id();
  m public.organization_members;
begin
  if v_org is null or not public.is_org_director(v_org) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_org_role not in ('director', 'head_coach', 'head_of_performance', 'assistant_coach', 'physiotherapist', 'sports_scientist', 'other_staff') then
    raise exception 'invalid role';
  end if;
  select * into m from public.organization_members where org_id = v_org and user_id = p_user and status = 'active';
  if m.id is null then raise exception 'member not found'; end if;
  if m.org_role = 'director' and p_org_role <> 'director'
     and (select count(*) from public.organization_members where org_id = v_org and status = 'active' and org_role = 'director') < 2 then
    raise exception 'a team needs at least one director';
  end if;
  update public.organization_members set org_role = p_org_role where id = m.id;
  update public.profiles set role = public.org_role_to_profile_role(p_org_role) where id = p_user and role <> 'athlete';
  perform public.write_audit('organization.member_role_changed', 'organization', v_org::text,
    jsonb_build_object('user_id', p_user, 'org_role', p_org_role));
end $$;

create or replace function public.remove_org_member(p_user uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid := public.my_org_id();
  m public.organization_members;
begin
  if v_org is null or not (public.is_org_director(v_org) or p_user = auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into m from public.organization_members where org_id = v_org and user_id = p_user and status = 'active';
  if m.id is null then raise exception 'member not found'; end if;
  if m.org_role = 'director'
     and (select count(*) from public.organization_members where org_id = v_org and status = 'active' and org_role = 'director') < 2 then
    raise exception 'a team needs at least one director';
  end if;
  update public.organization_members set status = 'removed', removed_at = now() where id = m.id;
  perform public.write_audit('organization.member_removed', 'organization', v_org::text, jsonb_build_object('user_id', p_user));
end $$;

-- ---------------------------------------------------------------------------
-- Athletes and the roster
-- ---------------------------------------------------------------------------
create or replace function public.preview_org_code(p_code text)
returns table (org_name text, sport text)
language sql stable security definer set search_path = public, pg_temp as $$
  select o.name, o.sport
  from public.organization_codes c join public.organizations o on o.id = c.org_id
  where c.code = upper(trim(p_code)) and c.kind = 'athlete' and c.status = 'active'
    and o.status = 'active' and auth.uid() is not null
$$;

-- returns: connected | already_connected | invalid_code | not_athlete
create or replace function public.connect_with_org_code(p_code text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_org uuid;
  v_athlete uuid;
  v_existing public.organization_athletes;
  m record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.role is distinct from 'athlete' then return 'not_athlete'; end if;

  select c.org_id into v_org from public.organization_codes c join public.organizations o on o.id = c.org_id
   where c.code = upper(trim(p_code)) and c.kind = 'athlete' and c.status = 'active' and o.status = 'active';
  if v_org is null then
    perform public.write_audit('organization.invalid_athlete_code', 'organization_code', null, jsonb_build_object('code', left(p_code, 16)));
    return 'invalid_code';
  end if;

  select id into v_athlete from public.athletes where user_id = v_uid;
  if v_athlete is null then
    insert into public.athletes (user_id, full_name, email, preferred_language)
    values (v_uid, coalesce(nullif(v_profile.full_name, ''), v_profile.email), v_profile.email, v_profile.locale)
    returning id into v_athlete;
  end if;

  select * into v_existing from public.organization_athletes where org_id = v_org and athlete_id = v_athlete;
  if v_existing.athlete_id is not null and v_existing.status = 'active' then return 'already_connected'; end if;
  insert into public.organization_athletes (org_id, athlete_id, consent_source, added_by)
  values (v_org, v_athlete, 'athlete', v_uid)
  on conflict (org_id, athlete_id) do update
    set status = 'active', consent_source = 'athlete', consented_at = now(), left_at = null, added_by = v_uid;

  for m in select user_id from public.organization_members where org_id = v_org and status = 'active' loop
    perform public.notify(m.user_id, 'team.athlete_joined', 'New athlete joined the team',
      coalesce(nullif(v_profile.full_name, ''), v_profile.email),
      case when m.user_id in (select user_id from public.organization_members where org_id = v_org and org_role = 'director')
           then '/team' else '/athletes/' || v_athlete end);
  end loop;
  perform public.write_audit('organization.athlete_joined', 'athlete', v_athlete::text, jsonb_build_object('org_id', v_org));
  return 'connected';
end $$;

create or replace function public.leave_org_as_athlete(p_org uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_athlete uuid;
begin
  select id into v_athlete from public.athletes where user_id = auth.uid();
  if v_athlete is null then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.organization_athletes set status = 'left', left_at = now()
   where org_id = p_org and athlete_id = v_athlete and status = 'active';
  perform public.write_audit('organization.athlete_left', 'athlete', v_athlete::text, jsonb_build_object('org_id', p_org));
end $$;

-- Staff can add athletes without an account (no one to consent) to the roster; the assertion is recorded.
-- returns: added | already_on_roster | needs_athlete_consent | not_allowed
create or replace function public.add_athlete_to_roster(p_athlete uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid := public.my_org_id();
  v_role text := public.my_org_role();
  v_user uuid;
begin
  if v_org is null or v_role not in ('head_coach', 'head_of_performance', 'assistant_coach') then return 'not_allowed'; end if;
  if not exists (select 1 from public.coach_athlete_relationships r
                  where r.athlete_id = p_athlete and r.coach_id = auth.uid() and r.status = 'active') then
    return 'not_allowed';
  end if;
  select user_id into v_user from public.athletes where id = p_athlete;
  if v_user is not null then return 'needs_athlete_consent'; end if;
  if exists (select 1 from public.organization_athletes where org_id = v_org and athlete_id = p_athlete and status = 'active') then
    return 'already_on_roster';
  end if;
  insert into public.organization_athletes (org_id, athlete_id, consent_source, added_by)
  values (v_org, p_athlete, 'staff_asserted', auth.uid())
  on conflict (org_id, athlete_id) do update set status = 'active', consent_source = 'staff_asserted', consented_at = now(), left_at = null, added_by = auth.uid();
  perform public.write_audit('organization.athlete_added_by_staff', 'athlete', p_athlete::text, jsonb_build_object('org_id', v_org));
  return 'added';
end $$;

create or replace function public.remove_athlete_from_roster(p_athlete uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid := public.my_org_id();
begin
  if v_org is null or public.my_org_role() not in ('head_coach', 'head_of_performance') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.organization_athletes set status = 'left', left_at = now()
   where org_id = v_org and athlete_id = p_athlete and status = 'active';
  perform public.write_audit('organization.athlete_removed', 'athlete', p_athlete::text, jsonb_build_object('org_id', v_org));
end $$;

-- Roster list with a minimal set of columns. This is all the director can see about athletes.
create or replace function public.org_roster()
returns table (athlete_id uuid, full_name text, sport text, "position" text, has_account boolean, consent_source text, joined_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.id, a.full_name, a.sport, a.position, a.user_id is not null, oa.consent_source, oa.consented_at
  from public.organization_athletes oa
  join public.athletes a on a.id = oa.athlete_id
  where oa.org_id = public.my_org_id() and oa.status = 'active' and a.status = 'active'
  order by a.full_name
$$;

-- Aggregated counts only.
create or replace function public.org_summary()
returns table (staff_count int, roster_count int, roster_with_account int, tests_30d int, sessions_7d int, readiness_today int)
language sql stable security definer set search_path = public, pg_temp as $$
  with roster as (
    select oa.athlete_id from public.organization_athletes oa
    join public.athletes a on a.id = oa.athlete_id
    where oa.org_id = public.my_org_id() and oa.status = 'active' and a.status = 'active')
  select
    (select count(*) from public.organization_members m where m.org_id = public.my_org_id() and m.status = 'active')::int,
    (select count(*) from roster)::int,
    (select count(*) from roster r join public.athletes a on a.id = r.athlete_id where a.user_id is not null)::int,
    (select count(*) from public.test_results t where t.athlete_id in (select athlete_id from roster) and t.tested_on >= current_date - 30)::int,
    (select count(*) from public.workout_completions w where w.athlete_id in (select athlete_id from roster)
        and w.completed_on >= current_date - 7 and w.status <> 'skipped')::int,
    (select count(*) from public.readiness_entries e where e.athlete_id in (select athlete_id from roster) and e.entry_date = current_date)::int
$$;

-- ---------------------------------------------------------------------------
-- Grants: signed-in users only
-- ---------------------------------------------------------------------------
revoke execute on function public.generate_prefixed_code(text) from public, anon, authenticated;
revoke execute on function
  public.my_org_id(), public.my_org_role(), public.is_org_director(uuid),
  public.is_org_staff_for_athlete(uuid), public.is_org_lead_for_athlete(uuid),
  public.org_role_to_profile_role(text),
  public.create_organization(text, text, text), public.preview_staff_code(text), public.join_organization(text, text),
  public.create_staff_invite(text), public.revoke_org_code(uuid), public.regenerate_org_athlete_code(),
  public.set_org_member_role(uuid, text), public.remove_org_member(uuid),
  public.preview_org_code(text), public.connect_with_org_code(text), public.leave_org_as_athlete(uuid),
  public.add_athlete_to_roster(uuid), public.remove_athlete_from_roster(uuid),
  public.org_roster(), public.org_summary()
from public, anon;
grant execute on function
  public.my_org_id(), public.my_org_role(), public.is_org_director(uuid),
  public.is_org_staff_for_athlete(uuid), public.is_org_lead_for_athlete(uuid),
  public.org_role_to_profile_role(text),
  public.create_organization(text, text, text), public.preview_staff_code(text), public.join_organization(text, text),
  public.create_staff_invite(text), public.revoke_org_code(uuid), public.regenerate_org_athlete_code(),
  public.set_org_member_role(uuid, text), public.remove_org_member(uuid),
  public.preview_org_code(text), public.connect_with_org_code(text), public.leave_org_as_athlete(uuid),
  public.add_athlete_to_roster(uuid), public.remove_athlete_from_roster(uuid),
  public.org_roster(), public.org_summary()
to authenticated;

-- Make the API pick up the new functions and tables right away.
notify pgrst, 'reload schema';
