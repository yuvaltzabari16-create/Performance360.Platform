-- Messages and return-to-play (RTP) workflow.
-- Same rules as the core schema: RLS on every table, access only through an
-- active coach–athlete relationship, privileged steps in SECURITY DEFINER
-- functions that re-check the caller, sensitive actions in audit_log.

-- ---------------------------------------------------------------------------
-- Messages: one thread per (athlete, professional) pair.
-- A professional reads and writes the thread only while the relationship is
-- active. The athlete always keeps their own thread history.
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  coach_id uuid not null references auth.users (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages (athlete_id, coach_id, created_at);
create index messages_unread_idx on public.messages (coach_id, athlete_id) where read_at is null;

-- True when coach and athlete are actively connected.
create or replace function public.is_active_pair(p_coach uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.coach_athlete_relationships r
    where r.coach_id = p_coach and r.athlete_id = p_athlete and r.status = 'active'
  )
$$;

alter table public.messages enable row level security;

create policy messages_select on public.messages for select to authenticated using (
  public.is_own_athlete_record(athlete_id)
  or (coach_id = auth.uid() and public.is_active_pair(coach_id, athlete_id))
);

-- The sender is the caller and is one of the two parties of an active link.
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and public.is_active_pair(coach_id, athlete_id)
  and (coach_id = auth.uid() or public.is_own_athlete_record(athlete_id))
);
-- No update/delete for users: messages are a record. Read receipts go through
-- mark_thread_read so a sender cannot mark their own message as read.

create or replace function public.mark_thread_read(p_athlete uuid, p_coach uuid)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  n int;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not (
    (p_coach = auth.uid() and public.is_active_pair(p_coach, p_athlete))
    or public.is_own_athlete_record(p_athlete)
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.messages
     set read_at = now()
   where athlete_id = p_athlete and coach_id = p_coach
     and read_at is null and sender_id <> auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;

-- In-app notification for the recipient.
create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_athlete_user uuid;
  v_sender_name text;
begin
  select user_id into v_athlete_user from public.athletes where id = new.athlete_id;
  select coalesce(nullif(full_name, ''), email) into v_sender_name from public.profiles where id = new.sender_id;
  if new.sender_id = new.coach_id then
    perform public.notify(v_athlete_user, 'message.new', 'New message', v_sender_name,
                          '/messages?coach=' || new.coach_id);
  else
    perform public.notify(new.coach_id, 'message.new', 'New message', v_sender_name,
                          '/messages?athlete=' || new.athlete_id);
  end if;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

-- ---------------------------------------------------------------------------
-- Return-to-play plans
-- A plan is written by a professional working with the athlete. Each phase
-- has progression criteria. A phase is cleared only by recording WHO cleared
-- it (name and role); Performance360 never decides clearance.
-- ---------------------------------------------------------------------------
create table public.rtp_plans (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  created_by uuid not null references auth.users (id) default auth.uid(),
  title text not null check (char_length(title) between 1 and 160),
  context text check (context is null or char_length(context) <= 4000),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rtp_plans_athlete_idx on public.rtp_plans (athlete_id, created_at desc);
create trigger rtp_plans_updated_at before update on public.rtp_plans
  for each row execute function public.set_updated_at();

create table public.rtp_phases (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.rtp_plans (id) on delete cascade,
  position int not null check (position between 1 and 20),
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 4000),
  criteria text[] not null default '{}' check (cardinality(criteria) <= 20),
  status text not null default 'locked' check (status in ('locked', 'in_progress', 'cleared')),
  started_at timestamptz,
  cleared_by_name text check (cleared_by_name is null or char_length(cleared_by_name) between 1 and 160),
  cleared_by_role text check (cleared_by_role is null or char_length(cleared_by_role) <= 80),
  clearance_note text check (clearance_note is null or char_length(clearance_note) <= 4000),
  cleared_at timestamptz,
  recorded_by uuid references auth.users (id),
  unique (plan_id, position),
  -- a cleared phase always names the professional and the time
  check (status <> 'cleared' or (cleared_by_name is not null and cleared_at is not null and recorded_by is not null))
);

create table public.rtp_phase_exercises (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.rtp_phases (id) on delete cascade,
  position int not null default 0,
  exercise_id uuid references public.exercises (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  prescription text check (prescription is null or char_length(prescription) <= 1000),
  last_done_at timestamptz,
  times_done int not null default 0 check (times_done >= 0)
);

create or replace function public.rtp_plan_athlete(p_plan uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select athlete_id from public.rtp_plans where id = p_plan
$$;
create or replace function public.rtp_phase_athlete(p_phase uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select p.athlete_id from public.rtp_phases ph join public.rtp_plans p on p.id = ph.plan_id where ph.id = p_phase
$$;

alter table public.rtp_plans enable row level security;
alter table public.rtp_phases enable row level security;
alter table public.rtp_phase_exercises enable row level security;

-- Read: the athlete and professionals with an active relationship (same as health fields on athletes).
create policy rtp_plans_select on public.rtp_plans for select to authenticated
  using (public.can_access_athlete(athlete_id));
create policy rtp_plans_insert on public.rtp_plans for insert to authenticated
  with check (created_by = auth.uid() and public.is_athlete_professional(athlete_id));
create policy rtp_plans_update on public.rtp_plans for update to authenticated
  using (public.is_athlete_professional(athlete_id)) with check (public.is_athlete_professional(athlete_id));

create policy rtp_phases_select on public.rtp_phases for select to authenticated
  using (public.can_access_athlete(public.rtp_plan_athlete(plan_id)));
-- Phase content is edited directly by professionals; status changes go through set_rtp_phase_status.
create policy rtp_phases_insert on public.rtp_phases for insert to authenticated
  with check (status = 'locked' and public.is_athlete_professional(public.rtp_plan_athlete(plan_id)));
create policy rtp_phases_update on public.rtp_phases for update to authenticated
  using (public.is_athlete_professional(public.rtp_plan_athlete(plan_id)))
  with check (public.is_athlete_professional(public.rtp_plan_athlete(plan_id)));
create policy rtp_phases_delete on public.rtp_phases for delete to authenticated
  using (status = 'locked' and public.is_athlete_professional(public.rtp_plan_athlete(plan_id)));
revoke update on public.rtp_phases from authenticated, anon;
grant update (title, description, criteria) on public.rtp_phases to authenticated;

create policy rtp_ex_select on public.rtp_phase_exercises for select to authenticated
  using (public.can_access_athlete(public.rtp_phase_athlete(phase_id)));
create policy rtp_ex_write on public.rtp_phase_exercises for all to authenticated
  using (public.is_athlete_professional(public.rtp_phase_athlete(phase_id)))
  with check (public.is_athlete_professional(public.rtp_phase_athlete(phase_id)));
revoke update on public.rtp_phase_exercises from authenticated, anon;
grant update (position, exercise_id, name, prescription) on public.rtp_phase_exercises to authenticated;

-- Move a phase: locked -> in_progress -> cleared, or back (reopen).
-- Clearing records the named professional; reopening withdraws the clearance.
create or replace function public.set_rtp_phase_status(
  p_phase uuid, p_status text,
  p_cleared_by_name text default null, p_cleared_by_role text default null, p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ph public.rtp_phases;
  v_athlete uuid;
begin
  select * into ph from public.rtp_phases where id = p_phase;
  if ph.id is null then raise exception 'phase not found'; end if;
  v_athlete := public.rtp_plan_athlete(ph.plan_id);
  if not public.is_athlete_professional(v_athlete) then
    raise exception 'only a professional working with this athlete can change phases' using errcode = '42501';
  end if;
  if p_status not in ('locked', 'in_progress', 'cleared') then raise exception 'unknown status'; end if;
  if p_status = ph.status then raise exception 'phase is already %', p_status; end if;
  if ph.status = 'locked' and p_status = 'cleared' then
    raise exception 'start the phase before clearing it';
  end if;

  if p_status = 'cleared' then
    if char_length(trim(coalesce(p_cleared_by_name, ''))) = 0 then
      raise exception 'record the name of the professional who cleared this phase';
    end if;
    update public.rtp_phases
       set status = 'cleared', cleared_by_name = trim(p_cleared_by_name),
           cleared_by_role = nullif(trim(coalesce(p_cleared_by_role, '')), ''),
           clearance_note = nullif(trim(coalesce(p_note, '')), ''),
           cleared_at = now(), recorded_by = auth.uid()
     where id = p_phase;
    perform public.write_audit('rtp.phase_cleared', 'rtp_phase', p_phase::text,
      jsonb_build_object('athlete_id', v_athlete, 'cleared_by_name', trim(p_cleared_by_name)));
  else
    update public.rtp_phases
       set status = p_status,
           started_at = case when p_status = 'in_progress' then coalesce(started_at, now()) else started_at end,
           cleared_by_name = null, cleared_by_role = null, clearance_note = null, cleared_at = null,
           recorded_by = case when ph.status = 'cleared' then auth.uid() else recorded_by end
     where id = p_phase;
    if ph.status = 'cleared' then
      perform public.write_audit('rtp.phase_reopened', 'rtp_phase', p_phase::text, jsonb_build_object('athlete_id', v_athlete));
    end if;
  end if;
  perform public.notify((select user_id from public.athletes where id = v_athlete), 'rtp.phase_updated',
                        'Return-to-play plan updated', ph.title, '/rehab');
end $$;

-- The athlete logs that they did an exercise in a phase that has been started.
create or replace function public.log_rtp_exercise(p_exercise uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_phase public.rtp_phases;
begin
  select ph.* into v_phase from public.rtp_phase_exercises e
    join public.rtp_phases ph on ph.id = e.phase_id where e.id = p_exercise;
  if v_phase.id is null then raise exception 'exercise not found'; end if;
  if not public.is_own_athlete_record(public.rtp_plan_athlete(v_phase.plan_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_phase.status <> 'in_progress' then raise exception 'this phase has not been started'; end if;
  update public.rtp_phase_exercises set last_done_at = now(), times_done = times_done + 1 where id = p_exercise;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.messages_after_insert() from public, anon, authenticated;
revoke execute on function
  public.is_active_pair(uuid, uuid),
  public.mark_thread_read(uuid, uuid),
  public.rtp_plan_athlete(uuid),
  public.rtp_phase_athlete(uuid),
  public.set_rtp_phase_status(uuid, text, text, text, text),
  public.log_rtp_exercise(uuid)
from public, anon;
grant execute on function
  public.is_active_pair(uuid, uuid),
  public.mark_thread_read(uuid, uuid),
  public.rtp_plan_athlete(uuid),
  public.rtp_phase_athlete(uuid),
  public.set_rtp_phase_status(uuid, text, text, text, text),
  public.log_rtp_exercise(uuid)
to authenticated;
