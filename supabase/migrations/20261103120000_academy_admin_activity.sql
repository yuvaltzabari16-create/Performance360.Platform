-- Activity tracking and the management page.
-- last_seen: updated when a signed-in member opens the app (at most every 5 minutes).
-- acad_activity(a): people in the academy with last sign-in / last seen (owner: everyone; coaches & physios: athletes + self).
-- Platform admins (the app's seller) see every academy and can set its plan.

alter table public.acad_members add column if not exists last_seen timestamptz;

create or replace function public.acad_touch(a uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.acad_members set last_seen = now()
   where id = public.acad_me(a) and (last_seen is null or last_seen < now() - interval '5 minutes')
$$;

create or replace function public.acad_activity(a uuid)
returns table (member_id uuid, role text, display_name text, joined_at timestamptz, last_sign_in timestamptz, last_seen timestamptz, devices int)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id, m.role, m.display_name, m.joined_at, m.last_sign_in, m.last_seen,
         (select count(*)::int from public.acad_sessions s where s.member_id = m.id)
    from public.acad_members m
   where m.academy_id = a
     and (public.acad_level(a) = 3 or m.id = public.acad_me(a) or (public.acad_level(a) = 2 and m.role = 'athlete'))
   order by m.last_seen desc nulls last, m.display_name
$$;

create table if not exists public.acad_platform_admins (
  member_id uuid primary key references public.acad_members (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.acad_platform_admins enable row level security;
revoke all on public.acad_platform_admins from anon, authenticated;

create or replace function public.acad_is_platform_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.acad_platform_admins p join public.acad_sessions s on s.member_id = p.member_id where s.user_id = auth.uid())
$$;

create or replace function public.acad_platform_overview()
returns table (id uuid, name text, plan text, trial_ends_at timestamptz, paid_until timestamptz, active boolean, created_at timestamptz,
               members int, athletes int, staff int, never_signed_in int, seen_7d int, last_activity timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.acad_is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select x.id, x.name, x.plan, x.trial_ends_at, x.paid_until, public.acad_active(x.id), x.created_at,
         count(m.id)::int, count(m.id) filter (where m.role = 'athlete')::int, count(m.id) filter (where m.role <> 'athlete')::int,
         count(m.id) filter (where m.last_sign_in is null)::int,
         count(m.id) filter (where greatest(m.last_seen, m.last_sign_in) > now() - interval '7 days')::int,
         max(greatest(m.last_seen, m.last_sign_in))
    from public.acad_academies x left join public.acad_members m on m.academy_id = x.id
   group by x.id order by x.created_at desc;
end $$;

-- plan: 'active' (paid; months null = no end date), 'trial' (extend by days), 'cancelled'
create or replace function public.acad_platform_set_plan(a uuid, p_plan text, p_months int default null, p_trial_days int default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.acad_is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_plan not in ('trial', 'active', 'past_due', 'cancelled') then raise exception 'bad plan' using errcode = '22023'; end if;
  update public.acad_academies set plan = p_plan,
    paid_until = case when p_plan = 'active' and p_months is not null then greatest(coalesce(paid_until, now()), now()) + make_interval(months => p_months) when p_plan = 'active' then null else paid_until end,
    trial_ends_at = case when p_plan = 'trial' and p_trial_days is not null then greatest(trial_ends_at, now()) + make_interval(days => p_trial_days) else trial_ends_at end
  where id = a;
end $$;

revoke all on function public.acad_touch(uuid), public.acad_activity(uuid), public.acad_is_platform_admin(), public.acad_platform_overview(), public.acad_platform_set_plan(uuid, text, int, int) from public, anon;
grant execute on function public.acad_touch(uuid), public.acad_activity(uuid), public.acad_is_platform_admin(), public.acad_platform_overview(), public.acad_platform_set_plan(uuid, text, int, int) to authenticated;
notify pgrst, 'reload schema';
