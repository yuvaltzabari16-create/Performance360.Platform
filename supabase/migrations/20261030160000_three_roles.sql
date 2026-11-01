-- Performance360 Academy has three roles: Coach, Physiotherapist and Athlete.
--
-- There is no director any more. Whoever creates the academy joins it as a Coach and is its **owner**: the owner
-- invites coaches and physiotherapists, manages the roster, codes and squads, and tracks payments. Owners are
-- full coaches too (they see and train every roster athlete). Ownership is a flag on the membership, so it can
-- be handed to another coach, and an academy always keeps at least one owner while it has members.
--
-- Mapping onto the existing team roles:  Coach = head_coach,  Physiotherapist = physiotherapist.
-- is_org_director() keeps its name (every owner-only policy and function calls it) but now means "is an owner".

alter table public.organization_members add column is_owner boolean not null default false;
revoke update (is_owner) on public.organization_members from anon, authenticated;

-- Existing directors become owner coaches.
update public.profiles p set role = 'performance_coach'
  from public.organization_members m
 where m.user_id = p.id and m.org_role = 'director' and m.status = 'active' and p.role = 'org_admin';
update public.organization_members set is_owner = true, org_role = 'head_coach' where org_role = 'director';
update public.organization_members set org_role = 'head_coach' where org_role in ('head_of_performance', 'assistant_coach', 'sports_scientist', 'other_staff');
update public.organization_codes set status = 'revoked', revoked_at = now()
 where kind = 'staff' and status = 'active' and org_role not in ('head_coach', 'physiotherapist');

create or replace function public.is_org_director(p_org uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.organization_members
    where org_id = p_org and user_id = auth.uid() and status = 'active' and (is_owner or org_role = 'director'))
$$;

create or replace function public.org_owner_count(p_org uuid)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from public.organization_members where org_id = p_org and status = 'active' and is_owner
$$;
revoke execute on function public.org_owner_count(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Creating, inviting, roles and leaving
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
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 120 then raise exception 'academy name is required'; end if;
  if char_length(trim(coalesce(p_full_name, ''))) not between 1 and 120 then raise exception 'name is required'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role is not null then raise exception 'account already set up' using errcode = '42501'; end if;

  insert into public.organizations (name, sport, created_by)
  values (trim(p_name), nullif(trim(coalesce(p_sport, '')), ''), v_uid) returning id into v_org;
  insert into public.organization_members (org_id, user_id, org_role, is_owner) values (v_org, v_uid, 'head_coach', true);
  update public.profiles
     set role = 'performance_coach', full_name = trim(p_full_name), onboarded_at = coalesce(onboarded_at, now())
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

create or replace function public.create_staff_invite(p_org_role text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid := public.my_org_id();
  v_code text;
begin
  if v_org is null or not public.is_org_director(v_org) then raise exception 'only the owner can invite staff' using errcode = '42501'; end if;
  if p_org_role not in ('head_coach', 'physiotherapist') then raise exception 'invalid role'; end if;
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

-- returns: joined | invalid_code | already_member | not_allowed
create or replace function public.join_organization(p_code text, p_full_name text default null)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  c public.organization_codes;
  v_name text := nullif(trim(coalesce(p_full_name, '')), '');
  d record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.role = 'athlete' then return 'not_allowed'; end if;

  select * into c from public.organization_codes
   where code = upper(trim(p_code)) and kind = 'staff' and status = 'active'
     and (expires_at is null or expires_at > now())
     and org_role in ('head_coach', 'physiotherapist')
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

  for d in select user_id from public.organization_members
            where org_id = c.org_id and status = 'active' and is_owner and user_id <> v_uid loop
    perform public.notify(d.user_id, 'team.staff_joined', 'New staff member joined', coalesce(v_name, v_profile.full_name), '/team');
  end loop;
  perform public.write_audit('organization.staff_joined', 'organization', c.org_id::text, jsonb_build_object('org_role', c.org_role));
  return 'joined';
end $$;

-- Coach <-> Physiotherapist. Ownership is separate (set_org_owner).
create or replace function public.set_org_member_role(p_user uuid, p_org_role text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid := public.my_org_id();
  m public.organization_members;
begin
  if v_org is null or not public.is_org_director(v_org) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_org_role not in ('head_coach', 'physiotherapist') then raise exception 'invalid role'; end if;
  select * into m from public.organization_members where org_id = v_org and user_id = p_user and status = 'active';
  if m.id is null then raise exception 'member not found'; end if;
  if m.is_owner and p_org_role <> 'head_coach' then raise exception 'an owner is a coach' using errcode = '42501'; end if;
  update public.organization_members set org_role = p_org_role where id = m.id;
  update public.profiles set role = public.org_role_to_profile_role(p_org_role) where id = p_user and role <> 'athlete';
  perform public.write_audit('organization.member_role_changed', 'organization', v_org::text, jsonb_build_object('user_id', p_user, 'org_role', p_org_role));
end $$;

-- An owner makes another coach an owner, or removes ownership (never from the last owner).
create or replace function public.set_org_owner(p_user uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid := public.my_org_id();
  m public.organization_members;
begin
  if v_org is null or not public.is_org_director(v_org) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into m from public.organization_members where org_id = v_org and user_id = p_user and status = 'active';
  if m.id is null then raise exception 'member not found'; end if;
  if p_on and m.org_role <> 'head_coach' then raise exception 'only a coach can be an owner' using errcode = '42501'; end if;
  if not p_on and m.is_owner and public.org_owner_count(v_org) < 2 then raise exception 'an academy needs at least one owner'; end if;
  update public.organization_members set is_owner = p_on where id = m.id;
  perform public.write_audit(case when p_on then 'organization.owner_added' else 'organization.owner_removed' end, 'organization', v_org::text, jsonb_build_object('user_id', p_user));
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
  if m.is_owner and public.org_owner_count(v_org) < 2 then raise exception 'an academy needs at least one owner'; end if;
  update public.organization_members set status = 'removed', removed_at = now(), is_owner = false where id = m.id;
  perform public.write_audit('organization.member_removed', 'organization', v_org::text, jsonb_build_object('user_id', p_user));
end $$;

revoke execute on function public.set_org_owner(uuid, boolean) from public, anon;
grant execute on function public.set_org_owner(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Academy-wide read access for owners: every roster athlete, and every program (with its sessions and exercises)
-- assigned to one, including colleagues' programs. Writing stays with each program's coach.
-- ---------------------------------------------------------------------------
create or replace function public.director_sees_athlete(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.is_org_director(public.my_org_id()), false) and exists (
    select 1 from public.organization_athletes oa
    where oa.athlete_id = p_athlete and oa.org_id = public.my_org_id() and oa.status = 'active')
$$;

create or replace function public.director_sees_team(p_team uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.is_org_director(public.my_org_id()), false) and exists (
    select 1 from public.teams t
    join public.organization_members m on m.user_id = t.owner_id and m.status = 'active' and m.org_id = public.my_org_id()
    where t.id = p_team)
$$;

create or replace function public.can_view_program(p_program uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.owns_program(p_program)
      or public.is_platform_admin()
      or exists (
        select 1 from public.program_assignments pa
        join public.athletes a on a.id = pa.athlete_id
        where pa.program_id = p_program and pa.status = 'active' and a.user_id = auth.uid()
      )
      or public.director_sees_program(p_program)
$$;

-- ---------------------------------------------------------------------------
-- Squads: owners see the whole roster and organise squads (with nobody else).
-- ---------------------------------------------------------------------------
create or replace function public.coach_squad_ok(p_org uuid, p_user uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when not exists (select 1 from public.organization_members m
                      where m.org_id = p_org and m.user_id = p_user and m.status = 'active'
                        and m.org_role in ('head_coach', 'assistant_coach') and not m.is_owner) then true
    when not exists (select 1 from public.squads s where s.org_id = p_org and s.status = 'active') then true
    else exists (
      select 1
      from public.organization_athletes oa
      join public.squads s on s.id = oa.squad_id and s.status = 'active'
      join public.squad_coaches sc on sc.squad_id = s.id and sc.user_id = p_user and sc.status = 'active'
      where oa.org_id = p_org and oa.athlete_id = p_athlete and oa.status = 'active')
  end
$$;

create or replace function public.can_manage_squads()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.is_org_director(public.my_org_id()), false)
$$;

-- ---------------------------------------------------------------------------
-- Account deletion: the last owner hands ownership over first while others remain.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_owner boolean;
  r record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select org_id, is_owner into v_org, v_owner
    from public.organization_members where user_id = v_uid and status = 'active';
  if v_org is not null and v_owner and public.org_owner_count(v_org) < 2
     and (select count(*) from public.organization_members where org_id = v_org and status = 'active') > 1 then
    raise exception 'last_director' using errcode = 'P0001', hint = 'Make another coach an owner first.';
  end if;

  perform public.write_audit('account.deleted', 'profile', v_uid::text);
  perform set_config('p360.allow_link', 'on', true);

  if v_org is not null and (select count(*) from public.organization_members where org_id = v_org and status = 'active') = 1 then
    delete from public.organizations where id = v_org;
  end if;

  delete from public.athletes where user_id = v_uid and owner_coach_id is null;

  for r in
    select c.conrelid::regclass as tbl, a.attname as col, a.attnotnull as mandatory
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and c.confdeltype in ('a', 'r')
       and (select relnamespace from pg_class where oid = c.conrelid) = 'public'::regnamespace
  loop
    if r.mandatory then
      execute format('delete from %s where %I = $1', r.tbl, r.col) using v_uid;
    else
      execute format('update %s set %I = null where %I = $1', r.tbl, r.col, r.col) using v_uid;
    end if;
  end loop;

  delete from auth.users where id = v_uid;
end $$;

notify pgrst, 'reload schema';
