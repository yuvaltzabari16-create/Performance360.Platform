-- Academy: updates feed and an optional AI provider.
-- updates/<id>       read by every member, written by coaches, physiotherapists and the owner
-- staffupdates/<id>  staff only
-- acad_ai_allow(a)   used by the academy-ai server function: staff only, active academies, 200 requests per academy per day

create or replace function public.acad_can(a uuid, p text, w boolean) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  lvl int := public.acad_level(a);
  me text := public.acad_me(a)::text;
  s text[] := string_to_array(p, '/');
  pr int; pw int; sr int; sw int;
begin
  if lvl = 0 or me is null or p is null then return false; end if;
  if w and not public.acad_active(a) then return false; end if;
  case s[1]
    when 'academy' then pr := 1; pw := 3;
    when 'library' then pr := 1; pw := 2;
    when 'updates' then pr := 1; pw := 2;
    when 'staffupdates' then pr := 2; pw := 2;
    when 'staff' then pr := 1; pw := 3; sr := 1; sw := 2;
    when 'athletes', 'logs', 'meals', 'inbox' then pr := 2; pw := 2; sr := 1; sw := 1;
    when 'roster', 'plan', 'notes', 'tests' then pr := 2; pw := 2; sr := 1; sw := 2;
    when 'payments', 'ownerprivate' then pr := 3; pw := 3;
    when 'programs', 'staffroom', 'staffnotes' then pr := 2; pw := 2;
    when 'data' then return s[2] = 'users' and s[3] = me;
    else pr := 2; pw := 3;
  end case;
  if sr is not null and s[2] = me then
    return lvl >= least(case when w then pw else pr end, case when w then sw else sr end);
  end if;
  return lvl >= case when w then pw else pr end;
end $$;

create table if not exists public.acad_ai_usage (
  academy_id uuid not null references public.acad_academies (id) on delete cascade,
  day date not null default current_date,
  requests int not null default 0,
  primary key (academy_id, day)
);
alter table public.acad_ai_usage enable row level security;
revoke all on public.acad_ai_usage from anon, authenticated;

create or replace function public.acad_ai_allow(a uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  if public.acad_level(a) < 2 or not public.acad_active(a) then return false; end if;
  insert into public.acad_ai_usage (academy_id, day, requests) values (a, current_date, 1)
    on conflict (academy_id, day) do update set requests = public.acad_ai_usage.requests + 1
    returning requests into n;
  delete from public.acad_ai_usage where day < current_date - 30;
  return n <= 200;
end $$;
revoke all on function public.acad_ai_allow(uuid) from public, anon;
grant execute on function public.acad_ai_allow(uuid) to authenticated;

notify pgrst, 'reload schema';
