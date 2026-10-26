-- Squads: a team can split its roster into squads (for example "U19" and "First team").
-- A head coach or assistant coach then works only with the athletes of the squads assigned to them.
-- Other roles (head of performance, physiotherapist, ...) keep the whole roster.
--
-- A team that has defined no squad behaves as before: every coach sees the whole roster.
-- Once a team has an active squad, a coach with no squad assigned sees no team athletes
-- (athletes the coach personally created stay visible to them).
--
-- Squads are archived and coach assignments are switched off instead of being removed,
-- which lets the file be applied through the Supabase connection.

create table public.squads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index squads_org_name on public.squads (org_id, lower(trim(name))) where status = 'active';

create table public.squad_coaches (
  squad_id uuid not null references public.squads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'removed')),
  primary key (squad_id, user_id)
);

alter table public.organization_athletes add column squad_id uuid references public.squads (id) on delete set null;
create index org_athletes_squad_idx on public.organization_athletes (squad_id) where status = 'active';

alter table public.squads enable row level security;
alter table public.squad_coaches enable row level security;
revoke insert, update, delete on public.squads, public.squad_coaches from anon, authenticated;
revoke update (squad_id) on public.organization_athletes from anon, authenticated;

create policy squads_select on public.squads for select to authenticated using (org_id = public.my_org_id() or public.is_platform_admin());
create policy squad_coaches_select on public.squad_coaches for select to authenticated
  using (exists (select 1 from public.squads s where s.id = squad_id and s.org_id = public.my_org_id()) or public.is_platform_admin());

-- Does this coach (head coach or assistant coach) work with this athlete through a squad?
-- True for every other role, and for every coach while the team has no active squad.
create or replace function public.coach_squad_ok(p_org uuid, p_user uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when not exists (select 1 from public.organization_members m
                      where m.org_id = p_org and m.user_id = p_user and m.status = 'active'
                        and m.org_role in ('head_coach', 'assistant_coach')) then true
    when not exists (select 1 from public.squads s where s.org_id = p_org and s.status = 'active') then true
    else exists (
      select 1
      from public.organization_athletes oa
      join public.squads s on s.id = oa.squad_id and s.status = 'active'
      join public.squad_coaches sc on sc.squad_id = s.id and sc.user_id = p_user and sc.status = 'active'
      where oa.org_id = p_org and oa.athlete_id = p_athlete and oa.status = 'active')
  end
$$;

create or replace function public.is_org_staff_for_athlete(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organization_athletes oa on oa.org_id = m.org_id and oa.status = 'active'
    where m.user_id = auth.uid() and m.status = 'active' and m.org_role <> 'director'
      and oa.athlete_id = p_athlete
      and public.coach_squad_ok(m.org_id, m.user_id, p_athlete))
$$;

create or replace function public.is_org_lead_for_athlete(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organization_athletes oa on oa.org_id = m.org_id and oa.status = 'active'
    where m.user_id = auth.uid() and m.status = 'active'
      and m.org_role in ('head_coach', 'head_of_performance')
      and oa.athlete_id = p_athlete
      and public.coach_squad_ok(m.org_id, m.user_id, p_athlete))
$$;

-- People who work with an athlete (notification recipients) respect the same squad scope.
create or replace function public.athlete_professional_ids(p_athlete uuid)
returns setof uuid language sql stable security definer set search_path = public, pg_temp as $$
  select r.coach_id from public.coach_athlete_relationships r where r.athlete_id = p_athlete and r.status = 'active'
  union
  select m.user_id
  from public.organization_members m
  join public.organization_athletes oa on oa.org_id = m.org_id and oa.status = 'active'
  where oa.athlete_id = p_athlete and m.status = 'active' and m.org_role <> 'director'
    and public.coach_squad_ok(m.org_id, m.user_id, p_athlete)
$$;

-- The roster list a coach gets also follows the squad scope (the director and other roles see all).
create or replace function public.org_roster()
returns table (athlete_id uuid, full_name text, sport text, "position" text, has_account boolean, consent_source text, joined_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.id, a.full_name, a.sport, a.position, a.user_id is not null, oa.consent_source, oa.consented_at
  from public.organization_athletes oa
  join public.athletes a on a.id = oa.athlete_id
  where oa.org_id = public.my_org_id() and oa.status = 'active' and a.status = 'active'
    and public.coach_squad_ok(oa.org_id, auth.uid(), a.id)
  order by a.full_name
$$;

-- Only the director and the head of performance organise squads.
create or replace function public.can_manage_squads()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.my_org_role(), '') in ('director', 'head_of_performance')
$$;

create or replace function public.create_squad(p_name text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if not public.can_manage_squads() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.squads (org_id, name, created_by) values (public.my_org_id(), trim(p_name), auth.uid()) returning id into v_id;
  perform public.write_audit('squad.created', 'squad', v_id::text);
  return v_id;
exception when unique_violation then
  raise exception 'a squad with this name already exists' using errcode = 'P0001';
end $$;

create or replace function public.archive_squad(p_squad uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.can_manage_squads() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.squads set status = 'archived' where id = p_squad and org_id = public.my_org_id();
  update public.organization_athletes set squad_id = null where squad_id = p_squad and org_id = public.my_org_id();
  perform public.write_audit('squad.archived', 'squad', p_squad::text);
end $$;

-- Switch a coach on or off for a squad. Only head coaches and assistant coaches of the team can be assigned.
create or replace function public.set_squad_coach(p_squad uuid, p_user uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.can_manage_squads() then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.squads where id = p_squad and org_id = public.my_org_id() and status = 'active') then
    raise exception 'squad not found' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.organization_members m
                  where m.org_id = public.my_org_id() and m.user_id = p_user and m.status = 'active'
                    and m.org_role in ('head_coach', 'assistant_coach')) then
    raise exception 'only coaches can be assigned to a squad' using errcode = 'P0001';
  end if;
  insert into public.squad_coaches (squad_id, user_id, status) values (p_squad, p_user, case when p_on then 'active' else 'removed' end)
  on conflict (squad_id, user_id) do update set status = excluded.status;
  perform public.write_audit('squad.coach_changed', 'squad', p_squad::text, jsonb_build_object('user_id', p_user, 'on', p_on));
end $$;

-- Put a roster athlete into a squad (null = no squad).
create or replace function public.set_athlete_squad(p_athlete uuid, p_squad uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.can_manage_squads() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_squad is not null and not exists (select 1 from public.squads where id = p_squad and org_id = public.my_org_id() and status = 'active') then
    raise exception 'squad not found' using errcode = 'P0001';
  end if;
  update public.organization_athletes set squad_id = p_squad
   where athlete_id = p_athlete and org_id = public.my_org_id() and status = 'active';
  perform public.write_audit('squad.athlete_assigned', 'athlete', p_athlete::text, jsonb_build_object('squad_id', p_squad));
end $$;

-- The squads the caller coaches (empty for everyone else).
create or replace function public.my_squads()
returns table (id uuid, name text) language sql stable security definer set search_path = public, pg_temp as $$
  select s.id, s.name from public.squads s
  join public.squad_coaches sc on sc.squad_id = s.id and sc.user_id = auth.uid() and sc.status = 'active'
  where s.status = 'active' and s.org_id = public.my_org_id()
  order by s.name
$$;

revoke execute on function public.coach_squad_ok(uuid, uuid, uuid), public.can_manage_squads(), public.create_squad(text),
  public.archive_squad(uuid), public.set_squad_coach(uuid, uuid, boolean), public.set_athlete_squad(uuid, uuid), public.my_squads()
from public, anon;
grant execute on function public.coach_squad_ok(uuid, uuid, uuid), public.can_manage_squads(), public.create_squad(text),
  public.archive_squad(uuid), public.set_squad_coach(uuid, uuid, boolean), public.set_athlete_squad(uuid, uuid), public.my_squads()
to authenticated;

notify pgrst, 'reload schema';
