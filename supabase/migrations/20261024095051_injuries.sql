-- Return-to-play: injuries and their timeline.
--
-- Model
--   injuries        one row per injury episode, with the current stage
--                   (rest, rehab, running, modified, full, cleared) and open/resolved status.
--   injury_events   append-only timeline: reported, stage changes, notes, clearance, reopened.
--
-- Rules
--   * Anyone who can access the athlete can read. Nobody writes tables directly: all changes go
--     through the functions below, which record who did what and when.
--   * An athlete can report an injury and add notes to their own; only professionals work with
--     diagnosis, expected return and stages.
--   * Recording "cleared" is limited to the athlete's primary coach, a team's head coach or head of
--     performance, or a team physiotherapist, and needs a written basis. The app records the
--     decision of a qualified person; it never decides or diagnoses.

create table public.injuries (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  reported_by uuid references auth.users (id) on delete set null default auth.uid(),
  body_area text not null check (body_area in (
    'hamstring', 'quadriceps', 'groin', 'calf', 'ankle', 'knee', 'hip', 'foot', 'lower_back', 'shoulder', 'head', 'other')),
  side text check (side in ('left', 'right', 'both')),
  kind text not null default 'other' check (kind in (
    'muscle', 'ligament', 'tendon', 'bone', 'joint', 'contusion', 'concussion', 'illness', 'other')),
  mechanism text check (mechanism in ('contact', 'non_contact', 'overuse', 'unknown')),
  severity text check (severity in ('minor', 'moderate', 'severe')),
  injury_date date not null default current_date,
  diagnosis text check (diagnosis is null or char_length(diagnosis) <= 2000),
  expected_return date,
  stage text not null default 'rest' check (stage in ('rest', 'rehab', 'running', 'modified', 'full', 'cleared')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (injury_date <= current_date + 1),
  check (expected_return is null or expected_return >= injury_date)
);
create trigger injuries_updated_at before update on public.injuries
  for each row execute function public.set_updated_at();
create index injuries_athlete_idx on public.injuries (athlete_id, status, injury_date desc);

create table public.injury_events (
  id uuid primary key default gen_random_uuid(),
  injury_id uuid not null references public.injuries (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  kind text not null check (kind in ('reported', 'stage_changed', 'note', 'cleared', 'updated', 'reopened')),
  stage text check (stage in ('rest', 'rehab', 'running', 'modified', 'full', 'cleared')),
  note text check (note is null or char_length(note) <= 2000),
  author_id uuid references auth.users (id) on delete set null default auth.uid(),
  author_name text,
  author_role text,
  created_at timestamptz not null default now()
);
create index injury_events_injury_idx on public.injury_events (injury_id, created_at);

alter table public.injuries enable row level security;
alter table public.injury_events enable row level security;
revoke insert, update, delete on public.injuries, public.injury_events from anon, authenticated;

create policy injuries_select on public.injuries for select to authenticated using (public.can_access_athlete(athlete_id));
create policy injury_events_select on public.injury_events for select to authenticated using (public.can_access_athlete(athlete_id));

-- ---------------------------------------------------------------------------
-- Helpers (internal)
-- ---------------------------------------------------------------------------

-- Everyone who works with this athlete: personal coaches and non-director staff of their teams.
create or replace function public.athlete_professional_ids(p_athlete uuid)
returns setof uuid language sql stable security definer set search_path = public, pg_temp as $$
  select r.coach_id from public.coach_athlete_relationships r where r.athlete_id = p_athlete and r.status = 'active'
  union
  select m.user_id
  from public.organization_members m
  join public.organization_athletes oa on oa.org_id = m.org_id and oa.status = 'active'
  where oa.athlete_id = p_athlete and m.status = 'active' and m.org_role <> 'director'
$$;

-- Who may record "cleared": the primary coach (personal or team lead) or a team physiotherapist.
create or replace function public.can_record_clearance(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_primary_coach(p_athlete)
      or exists (
        select 1
        from public.organization_members m
        join public.organization_athletes oa on oa.org_id = m.org_id and oa.status = 'active'
        where m.user_id = auth.uid() and m.status = 'active' and m.org_role = 'physiotherapist' and oa.athlete_id = p_athlete)
$$;

-- Name and role of the caller, stored on each event so the timeline stays readable if the account changes.
create or replace function public.injury_actor()
returns table (name text, role text) language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(nullif(p.full_name, ''), p.email),
         coalesce((select m.org_role from public.organization_members m where m.user_id = p.id and m.status = 'active'), p.role::text)
  from public.profiles p where p.id = auth.uid()
$$;

-- Tells the other people on the athlete's side (and the athlete) about a change.
create or replace function public.notify_injury_change(p_athlete uuid, p_injury uuid, p_title text, p_body text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid;
  v_athlete_user uuid;
  v_link text := '/athletes/' || p_athlete || '#injury-' || p_injury;
begin
  for v_user in select public.athlete_professional_ids(p_athlete) loop
    if v_user is distinct from auth.uid() then perform public.notify(v_user, 'injury.update', p_title, p_body, v_link); end if;
  end loop;
  select user_id into v_athlete_user from public.athletes where id = p_athlete;
  if v_athlete_user is not null and v_athlete_user is distinct from auth.uid() then
    perform public.notify(v_athlete_user, 'injury.update', p_title, p_body, v_link);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Public functions
-- ---------------------------------------------------------------------------

-- Report an injury. Athletes report their own; professionals report for their athletes.
create or replace function public.report_injury(
  p_athlete uuid, p_area text, p_side text, p_kind text, p_mechanism text, p_severity text,
  p_date date, p_diagnosis text, p_expected date, p_note text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pro boolean := public.is_athlete_professional(p_athlete);
  v_id uuid;
  v_name text;
  v_role text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not (v_pro or public.is_own_athlete_record(p_athlete)) then raise exception 'not allowed' using errcode = '42501'; end if;
  select a.name, a.role into v_name, v_role from public.injury_actor() a;

  insert into public.injuries (athlete_id, body_area, side, kind, mechanism, severity, injury_date, diagnosis, expected_return)
  values (
    p_athlete, p_area, nullif(p_side, ''), coalesce(nullif(p_kind, ''), 'other'), nullif(p_mechanism, ''), nullif(p_severity, ''),
    coalesce(p_date, current_date),
    case when v_pro then nullif(trim(p_diagnosis), '') end,   -- diagnosis and expected return belong to professionals
    case when v_pro then p_expected end)
  returning id into v_id;

  insert into public.injury_events (injury_id, athlete_id, kind, stage, note, author_name, author_role)
  values (v_id, p_athlete, 'reported', 'rest', nullif(trim(p_note), ''), v_name, v_role);

  perform public.write_audit('injury.reported', 'injury', v_id::text, jsonb_build_object('athlete_id', p_athlete, 'area', p_area));
  perform public.notify_injury_change(p_athlete, v_id, 'Injury reported', coalesce(v_name, '') || ': ' || p_area);
  return v_id;
end $$;

-- Move an injury to another stage (a professional of the athlete). "cleared" has extra conditions.
create or replace function public.set_injury_stage(p_injury uuid, p_stage text, p_note text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  i public.injuries;
  v_name text;
  v_role text;
  v_kind text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into i from public.injuries where id = p_injury;
  if i.id is null or not public.is_athlete_professional(i.athlete_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_stage not in ('rest', 'rehab', 'running', 'modified', 'full', 'cleared') then raise exception 'invalid stage'; end if;
  if p_stage = i.stage then raise exception 'already at this stage'; end if;
  if p_stage = 'cleared' then
    if not public.can_record_clearance(i.athlete_id) then raise exception 'clearance_not_allowed' using errcode = '42501'; end if;
    if v_note is null or char_length(v_note) < 3 then raise exception 'clearance_note_required'; end if;
  end if;
  select a.name, a.role into v_name, v_role from public.injury_actor() a;

  v_kind := case when p_stage = 'cleared' then 'cleared' when i.status = 'resolved' then 'reopened' else 'stage_changed' end;
  update public.injuries
     set stage = p_stage,
         status = case when p_stage = 'cleared' then 'resolved' else 'open' end,
         resolved_on = case when p_stage = 'cleared' then current_date end
   where id = i.id;
  insert into public.injury_events (injury_id, athlete_id, kind, stage, note, author_name, author_role)
  values (i.id, i.athlete_id, v_kind, p_stage, v_note, v_name, v_role);

  perform public.write_audit('injury.' || v_kind, 'injury', i.id::text, jsonb_build_object('stage', p_stage));
  perform public.notify_injury_change(i.athlete_id, i.id, 'Return-to-play update', i.body_area || ': ' || p_stage);
end $$;

-- A note on the timeline (professionals, or the athlete on their own injury).
create or replace function public.add_injury_note(p_injury uuid, p_note text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  i public.injuries;
  v_name text;
  v_role text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into i from public.injuries where id = p_injury;
  if i.id is null or not (public.is_athlete_professional(i.athlete_id) or public.is_own_athlete_record(i.athlete_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_note is null then raise exception 'note is required'; end if;
  select a.name, a.role into v_name, v_role from public.injury_actor() a;
  insert into public.injury_events (injury_id, athlete_id, kind, stage, note, author_name, author_role)
  values (i.id, i.athlete_id, 'note', i.stage, v_note, v_name, v_role);
  perform public.notify_injury_change(i.athlete_id, i.id, 'Injury note', coalesce(v_name, '') || ': ' || left(v_note, 120));
end $$;

-- Diagnosis, expected return and severity (professionals only).
create or replace function public.update_injury_details(p_injury uuid, p_diagnosis text, p_expected date, p_severity text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  i public.injuries;
  v_name text;
  v_role text;
begin
  select * into i from public.injuries where id = p_injury;
  if i.id is null or not public.is_athlete_professional(i.athlete_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  select a.name, a.role into v_name, v_role from public.injury_actor() a;
  update public.injuries
     set diagnosis = nullif(trim(coalesce(p_diagnosis, '')), ''), expected_return = p_expected, severity = nullif(p_severity, '')
   where id = i.id;
  insert into public.injury_events (injury_id, athlete_id, kind, stage, note, author_name, author_role)
  values (i.id, i.athlete_id, 'updated', i.stage, null, v_name, v_role);
  perform public.write_audit('injury.updated', 'injury', i.id::text);
end $$;

-- Internal helpers stay internal; the four public functions are for signed-in users only.
revoke execute on function public.athlete_professional_ids(uuid), public.can_record_clearance(uuid),
  public.injury_actor(), public.notify_injury_change(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function
  public.report_injury(uuid, text, text, text, text, text, date, text, date, text),
  public.set_injury_stage(uuid, text, text),
  public.add_injury_note(uuid, text),
  public.update_injury_details(uuid, text, date, text)
from public, anon;
grant execute on function
  public.report_injury(uuid, text, text, text, text, text, date, text, date, text),
  public.set_injury_stage(uuid, text, text),
  public.add_injury_note(uuid, text),
  public.update_injury_details(uuid, text, date, text)
to authenticated;

notify pgrst, 'reload schema';
