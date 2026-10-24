-- Director view and in-app messages.
--
-- The director reads (never writes) what runs the club: the roster's athletes, their training
-- schedule, injuries, GPS (already open) and squads. The planner contents, the exercise library,
-- notes, test results and wellness data stay closed to the role.
-- Messages are one-to-one between people who work together: team members, roster athletes with an
-- account, and a coach with their connected athletes.

-- ---------------------------------------------------------------------------
-- Director read access (separate policies; nothing is added to can_access_athlete)
-- ---------------------------------------------------------------------------
create or replace function public.director_sees_athlete(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.my_org_role(), '') = 'director' and exists (
    select 1 from public.organization_athletes oa
    where oa.athlete_id = p_athlete and oa.org_id = public.my_org_id() and oa.status = 'active')
$$;

create or replace function public.director_sees_program(p_program uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.program_assignments pa
                 where pa.program_id = p_program and pa.status = 'active' and public.director_sees_athlete(pa.athlete_id))
$$;

create or replace function public.director_sees_team(p_team uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.my_org_role(), '') = 'director' and exists (
    select 1 from public.teams t
    join public.organization_members m on m.user_id = t.owner_id and m.status = 'active' and m.org_id = public.my_org_id()
    where t.id = p_team)
$$;

create policy athletes_select_director on public.athletes for select to authenticated using (public.director_sees_athlete(id));
create policy assignments_select_director on public.program_assignments for select to authenticated using (public.director_sees_athlete(athlete_id));
create policy programs_select_director on public.training_programs for select to authenticated using (public.director_sees_program(id));
create policy sessions_select_director on public.training_sessions for select to authenticated using (public.director_sees_program(program_id));
create policy completions_select_director on public.workout_completions for select to authenticated using (public.director_sees_athlete(athlete_id));
create policy teams_select_director on public.teams for select to authenticated using (public.director_sees_team(id));
create policy team_members_select_director on public.team_members for select to authenticated using (public.director_sees_team(team_id));

alter policy injuries_select on public.injuries using (public.can_access_athlete(athlete_id) or public.director_sees_athlete(athlete_id));
alter policy injury_events_select on public.injury_events using (public.can_access_athlete(athlete_id) or public.director_sees_athlete(athlete_id));

revoke execute on function public.director_sees_athlete(uuid), public.director_sees_program(uuid), public.director_sees_team(uuid) from public, anon;
grant execute on function public.director_sees_athlete(uuid), public.director_sees_program(uuid), public.director_sees_team(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index messages_recipient_idx on public.messages (recipient_id, read_at, created_at desc);
create index messages_sender_idx on public.messages (sender_id, created_at desc);
alter table public.messages enable row level security;
revoke insert, update, delete on public.messages from anon, authenticated;
create policy messages_select on public.messages for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());

-- People the caller may message, with a display name and a label (team role, "athlete" or profession).
create or replace function public.message_contacts()
returns table (user_id uuid, full_name text, label text)
language sql stable security definer set search_path = public, pg_temp as $$
  with me as (select public.my_org_id() as org, auth.uid() as uid)
  -- colleagues in my team
  select m.user_id, coalesce(nullif(p.full_name, ''), p.email), m.org_role
    from public.organization_members m join public.profiles p on p.id = m.user_id, me
   where m.status = 'active' and m.org_id = me.org and m.user_id <> me.uid
  union
  -- roster athletes with an account, for team staff
  select a.user_id, a.full_name, 'athlete'
    from public.organization_athletes oa join public.athletes a on a.id = oa.athlete_id, me
   where oa.status = 'active' and oa.org_id = me.org and a.user_id is not null and a.user_id <> me.uid
  union
  -- for an athlete: staff of the teams they are on the roster of
  select m.user_id, coalesce(nullif(p.full_name, ''), p.email), m.org_role
    from public.athletes a
    join public.organization_athletes oa on oa.athlete_id = a.id and oa.status = 'active'
    join public.organization_members m on m.org_id = oa.org_id and m.status = 'active'
    join public.profiles p on p.id = m.user_id, me
   where a.user_id = me.uid
  union
  -- a coach and their connected athletes, both directions
  select a.user_id, a.full_name, 'athlete'
    from public.coach_athlete_relationships r join public.athletes a on a.id = r.athlete_id, me
   where r.status = 'active' and r.coach_id = me.uid and a.user_id is not null
  union
  select r.coach_id, coalesce(nullif(p.full_name, ''), p.email), p.role::text
    from public.athletes a
    join public.coach_athlete_relationships r on r.athlete_id = a.id and r.status = 'active'
    join public.profiles p on p.id = r.coach_id, me
   where a.user_id = me.uid
$$;

create or replace function public.send_message(p_to uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_body text := trim(coalesce(p_body, ''));
  v_name text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if v_body = '' then raise exception 'empty message'; end if;
  if not exists (select 1 from public.message_contacts() c where c.user_id = p_to) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.messages (sender_id, recipient_id, body) values (auth.uid(), p_to, left(v_body, 4000)) returning id into v_id;
  select coalesce(nullif(full_name, ''), email) into v_name from public.profiles where id = auth.uid();
  perform public.notify(p_to, 'message', 'New message from ' || coalesce(v_name, ''), left(v_body, 120), '/messages?with=' || auth.uid());
  return v_id;
end $$;

create or replace function public.mark_messages_read(p_with uuid)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.messages set read_at = now()
   where recipient_id = auth.uid() and sender_id = p_with and read_at is null
$$;

revoke execute on function public.message_contacts(), public.send_message(uuid, text), public.mark_messages_read(uuid) from public, anon;
grant execute on function public.message_contacts(), public.send_message(uuid, text), public.mark_messages_read(uuid) to authenticated;

notify pgrst, 'reload schema';
