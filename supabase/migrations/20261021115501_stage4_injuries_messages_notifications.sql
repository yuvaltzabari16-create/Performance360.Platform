-- Stage 4: injuries & return-to-play, coach–athlete messaging, in-app notifications.

-- ===== INJURIES =====
create type public.injury_severity as enum ('minor','moderate','severe');

create table public.injuries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  reported_on date not null default current_date,
  body_area text not null check (length(trim(body_area)) between 1 and 80),
  side text check (side in ('left','right','both')),
  kind text check (kind in ('muscle','ligament','tendon','bone','joint','contusion','concussion','illness','other')),
  mechanism text check (mechanism in ('contact','non_contact','overuse','unknown')),
  severity public.injury_severity not null default 'minor',
  -- 0 rest · 1 rehab · 2 running · 3 modified training · 4 full training · 5 cleared to play
  stage smallint not null default 0 check (stage between 0 and 5),
  expected_return date,
  diagnosis text,
  notes text,
  closed_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.injuries(club_id, closed_at);
create index on public.injuries(player_id);
create index on public.injuries(created_by);
create trigger injuries_updated before update on public.injuries for each row execute function public.set_updated_at();
create trigger injuries_club before insert or update of player_id on public.injuries for each row execute function public.set_club_from_player();

create table public.injury_updates (
  id uuid primary key default gen_random_uuid(),
  injury_id uuid not null references public.injuries(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  stage smallint not null check (stage between 0 and 5),
  note text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.injury_updates(injury_id);
create index on public.injury_updates(club_id);
create index on public.injury_updates(created_by);

-- Close at "cleared", reopen if moved back; log every stage change
create or replace function public.injury_before() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.stage = 5 and (tg_op = 'INSERT' or old.stage <> 5) then new.closed_at := now();
  elsif new.stage < 5 then new.closed_at := null;
  end if;
  return new;
end $$;
create trigger injuries_before before insert or update of stage on public.injuries for each row execute function public.injury_before();

-- Player status follows their open injuries: rest/rehab -> injured, running/modified -> rehab, otherwise available
create or replace function public.sync_player_status(p_player uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m smallint; cur public.player_status;
begin
  select min(stage) into m from public.injuries where player_id = p_player and closed_at is null;
  select status into cur from public.players where id = p_player;
  if m is null then
    if cur in ('injured','rehab') then update public.players set status = 'available' where id = p_player; end if;
  elsif m <= 1 then update public.players set status = 'injured' where id = p_player and status <> 'injured';
  elsif m <= 3 then update public.players set status = 'rehab' where id = p_player and status <> 'rehab';
  else update public.players set status = 'available' where id = p_player and status <> 'available';
  end if;
end $$;

-- ===== MESSAGES (one thread per athlete with their staff) =====
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.messages(player_id, created_at);
create index on public.messages(club_id);
create index on public.messages(sender_id);
create trigger messages_club before insert on public.messages for each row execute function public.set_club_from_player();

create table public.message_reads (
  player_id uuid not null references public.players(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (player_id, user_id)
);
create index on public.message_reads(user_id);

-- ===== NOTIFICATIONS (written only by triggers; text is rendered per language in the app from kind + data) =====
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, read_at, created_at desc);
create index on public.notifications(club_id);

create or replace function public.notify(p_user uuid, p_club uuid, p_kind text, p_data jsonb, p_link text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications(user_id, club_id, kind, data, link)
  select p_user, p_club, p_kind, p_data, p_link where p_user is not null and p_user is distinct from auth.uid()
$$;

-- Staff responsible for a player: the club's directors plus coaches of the player's squad
create or replace function public.player_staff(p_player uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.user_id from public.players p join public.club_members m on m.club_id = p.club_id and m.role = 'director' where p.id = p_player
  union
  select ss.user_id from public.players p
    join public.squad_staff ss on ss.squad_id = p.squad_id
    join public.club_members m on m.club_id = p.club_id and m.user_id = ss.user_id and m.role in ('director','coach')
  where p.id = p_player
$$;

create or replace function public.on_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.players; u uuid;
begin
  select * into p from public.players where id = new.player_id;
  if new.sender_id = p.user_id then
    for u in select * from public.player_staff(new.player_id) loop
      perform public.notify(u, new.club_id, 'message_from_athlete', jsonb_build_object('player', p.full_name, 'preview', left(new.body, 120)), '/messages/' || new.player_id);
    end loop;
  else
    perform public.notify(p.user_id, new.club_id, 'message_from_staff', jsonb_build_object('preview', left(new.body, 120)), '/messages');
  end if;
  return null;
end $$;
create trigger messages_notify after insert on public.messages for each row execute function public.on_message();

create or replace function public.on_injury() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.players; u uuid;
begin
  select * into p from public.players where id = new.player_id;
  if tg_op = 'INSERT' or old.stage is distinct from new.stage then
    insert into public.injury_updates(injury_id, club_id, stage, note) values (new.id, new.club_id, new.stage, null);
  end if;
  if tg_op = 'INSERT' then
    for u in select * from public.player_staff(new.player_id) loop
      perform public.notify(u, new.club_id, 'injury_new', jsonb_build_object('player', p.full_name, 'area', new.body_area, 'severity', new.severity), '/players/' || new.player_id);
    end loop;
  elsif old.stage is distinct from new.stage then
    perform public.notify(p.user_id, new.club_id, 'injury_stage', jsonb_build_object('stage', new.stage, 'area', new.body_area), '/today');
  end if;
  perform public.sync_player_status(new.player_id);
  return null;
end $$;
create trigger injuries_after after insert or update on public.injuries for each row execute function public.on_injury();

create or replace function public.on_session_assigned() returns trigger
language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  if new.workout_snapshot is null then return null; end if;
  for u in
    select p.user_id from public.players p
    where p.club_id = new.club_id and p.user_id is not null and p.archived_at is null
      and (case when new.player_id is not null then p.id = new.player_id
                when new.squad_id is not null then p.squad_id = new.squad_id
                else true end)
  loop
    perform public.notify(u, new.club_id, 'workout_assigned', jsonb_build_object('title', new.workout_snapshot->>'title', 'date', new.session_date), '/workout/' || new.id);
  end loop;
  return null;
end $$;
create trigger sessions_notify after insert on public.training_sessions for each row execute function public.on_session_assigned();

create or replace function public.on_checkin_pain() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p public.players; u uuid;
begin
  if not new.pain or (tg_op = 'UPDATE' and old.pain) then return null; end if;
  select * into p from public.players where id = new.player_id;
  for u in select * from public.player_staff(new.player_id) loop
    perform public.notify(u, new.club_id, 'pain_reported', jsonb_build_object('player', p.full_name, 'area', new.pain_area), '/players/' || new.player_id);
  end loop;
  return null;
end $$;
create trigger wellness_pain_notify after insert or update of pain on public.wellness_checkins for each row execute function public.on_checkin_pain();

-- ===== RLS =====
alter table public.injuries enable row level security;
alter table public.injury_updates enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.notifications enable row level security;

create policy injuries_select on public.injuries for select to authenticated
  using (public.is_staff(club_id) or public.is_own_player(player_id));
create policy injuries_insert on public.injuries for insert to authenticated
  with check (created_by = (select auth.uid()) and public.can_edit_player(player_id));
create policy injuries_update on public.injuries for update to authenticated
  using (public.can_edit_player(player_id)) with check (public.can_edit_player(player_id));
create policy injuries_delete on public.injuries for delete to authenticated using (public.is_director(club_id));
revoke update (club_id, created_by, closed_at) on public.injuries from authenticated, anon;

create policy injury_updates_select on public.injury_updates for select to authenticated
  using (public.is_staff(club_id) or exists(select 1 from public.injuries i where i.id = injury_id and public.is_own_player(i.player_id)));
create policy injury_updates_note on public.injury_updates for update to authenticated
  using (exists(select 1 from public.injuries i where i.id = injury_id and public.can_edit_player(i.player_id)))
  with check (exists(select 1 from public.injuries i where i.id = injury_id and public.can_edit_player(i.player_id)));
revoke update on public.injury_updates from authenticated, anon;
grant update (note) on public.injury_updates to authenticated;

create policy messages_select on public.messages for select to authenticated
  using (public.can_edit_player(player_id) or public.is_own_player(player_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and (public.can_edit_player(player_id) or public.is_own_player(player_id)));

create policy reads_select on public.message_reads for select to authenticated using (user_id = (select auth.uid()));
create policy reads_insert on public.message_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and (public.can_edit_player(player_id) or public.is_own_player(player_id)));
create policy reads_update on public.message_reads for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

revoke execute on function public.injury_before(), public.sync_player_status(uuid), public.notify(uuid, uuid, text, jsonb, text),
  public.player_staff(uuid), public.on_message(), public.on_injury(), public.on_session_assigned(), public.on_checkin_pain()
  from public, anon, authenticated;
