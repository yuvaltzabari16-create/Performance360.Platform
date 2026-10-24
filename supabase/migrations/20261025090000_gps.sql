-- GPS / wearable data: sessions imported from a wearable export (StatSports, Catapult, Polar, any CSV)
-- with one metrics row per athlete, including a heat-map grid.
--
-- Access
--   * Staff read GPS data for the athletes they work with (same rule as every athlete record);
--     athletes read their own; the team director sees none.
--   * Writing goes through import_gps_session(): not for the director or the physiotherapist, and
--     only for athletes the caller works with.

create table public.gps_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete set null default auth.uid(),
  org_id uuid references public.organizations (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  kind text not null default 'training' check (kind in ('training', 'match')),
  session_date date not null default current_date,
  duration_min numeric(6, 1) check (duration_min is null or duration_min between 0 and 600),
  pitch_length_m numeric(5, 1) not null default 105 check (pitch_length_m between 20 and 140),
  pitch_width_m numeric(5, 1) not null default 68 check (pitch_width_m between 10 and 100),
  source text not null default 'other' check (source in ('statsports', 'catapult', 'polar', 'other', 'sample')),
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index gps_sessions_date_idx on public.gps_sessions (session_date desc);
create index gps_sessions_owner_idx on public.gps_sessions (owner_id);

create table public.gps_session_metrics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.gps_sessions (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  minutes numeric(6, 1) not null default 0 check (minutes between 0 and 600),
  total_distance_m integer not null default 0 check (total_distance_m between 0 and 30000),
  hsr_distance_m integer not null default 0 check (hsr_distance_m between 0 and 30000),
  sprint_distance_m integer not null default 0 check (sprint_distance_m between 0 and 30000),
  sprint_count integer not null default 0 check (sprint_count between 0 and 500),
  max_speed_kmh numeric(4, 1) not null default 0 check (max_speed_kmh between 0 and 45),
  accel_count integer not null default 0 check (accel_count between 0 and 1000),
  decel_count integer not null default 0 check (decel_count between 0 and 1000),
  player_load numeric(7, 1) not null default 0 check (player_load between 0 and 5000),
  avg_hr integer check (avg_hr is null or avg_hr between 30 and 230),
  max_hr integer check (max_hr is null or max_hr between 30 and 230),
  zones jsonb not null default '[]'::jsonb check (jsonb_typeof(zones) = 'array' and jsonb_array_length(zones) <= 5),
  heat jsonb check (heat is null or (jsonb_typeof(heat) = 'object' and pg_column_size(heat) < 20000)),
  unique (session_id, athlete_id)
);
create index gps_metrics_athlete_idx on public.gps_session_metrics (athlete_id);

alter table public.gps_sessions enable row level security;
alter table public.gps_session_metrics enable row level security;
revoke insert, update, delete on public.gps_sessions, public.gps_session_metrics from anon, authenticated;

-- Can the caller see this athlete's GPS data? Staff of the athlete or the athlete; never the director.
create or replace function public.can_view_gps(p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.can_access_athlete(p_athlete) and coalesce(public.my_org_role(), '') <> 'director'
$$;

create or replace function public.can_view_gps_session(p_session uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.gps_session_metrics m where m.session_id = p_session and public.can_view_gps(m.athlete_id))
$$;

create policy gps_metrics_select on public.gps_session_metrics for select to authenticated using (public.can_view_gps(athlete_id));
create policy gps_sessions_select on public.gps_sessions for select to authenticated
  using ((owner_id = auth.uid() and coalesce(public.my_org_role(), '') <> 'director') or public.can_view_gps_session(id));

-- Import one session with its per-athlete rows (rows: jsonb array, at most 60 athletes).
create or replace function public.import_gps_session(
  p_title text, p_kind text, p_date date, p_pitch_length numeric, p_pitch_width numeric,
  p_source text, p_is_sample boolean, p_rows jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_row jsonb;
  v_athlete uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not public.is_professional() or coalesce(public.my_org_role(), '') in ('director', 'physiotherapist') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 60 then raise exception 'invalid rows'; end if;

  insert into public.gps_sessions (org_id, title, kind, session_date, duration_min, pitch_length_m, pitch_width_m, source, is_sample)
  select public.my_org_id(), trim(p_title), p_kind, coalesce(p_date, current_date),
         (select max((r ->> 'minutes')::numeric) from jsonb_array_elements(p_rows) r),
         coalesce(p_pitch_length, 105), coalesce(p_pitch_width, 68), p_source, coalesce(p_is_sample, false)
  returning id into v_id;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_athlete := (v_row ->> 'athlete_id')::uuid;
    if not public.is_athlete_professional(v_athlete) then raise exception 'not allowed for this athlete' using errcode = '42501'; end if;
    insert into public.gps_session_metrics (session_id, athlete_id, minutes, total_distance_m, hsr_distance_m, sprint_distance_m,
      sprint_count, max_speed_kmh, accel_count, decel_count, player_load, avg_hr, max_hr, zones, heat)
    values (v_id, v_athlete,
      coalesce((v_row ->> 'minutes')::numeric, 0), coalesce((v_row ->> 'total_distance_m')::int, 0),
      coalesce((v_row ->> 'hsr_distance_m')::int, 0), coalesce((v_row ->> 'sprint_distance_m')::int, 0),
      coalesce((v_row ->> 'sprint_count')::int, 0), coalesce((v_row ->> 'max_speed_kmh')::numeric, 0),
      coalesce((v_row ->> 'accel_count')::int, 0), coalesce((v_row ->> 'decel_count')::int, 0),
      coalesce((v_row ->> 'player_load')::numeric, 0), (v_row ->> 'avg_hr')::int, (v_row ->> 'max_hr')::int,
      coalesce(v_row -> 'zones', '[]'::jsonb), nullif(v_row -> 'heat', 'null'::jsonb));
  end loop;

  perform public.write_audit('gps.imported', 'gps_session', v_id::text, jsonb_build_object('athletes', jsonb_array_length(p_rows), 'source', p_source));
  return v_id;
end $$;

-- Delete a session the caller imported.
create or replace function public.delete_gps_session(p_session uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.gps_sessions where id = p_session and owner_id = auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.gps_sessions where id = p_session;
  perform public.write_audit('gps.deleted', 'gps_session', p_session::text);
end $$;

revoke execute on function public.can_view_gps(uuid), public.can_view_gps_session(uuid) from public, anon;
grant execute on function public.can_view_gps(uuid), public.can_view_gps_session(uuid) to authenticated;
revoke execute on function public.import_gps_session(text, text, date, numeric, numeric, text, boolean, jsonb), public.delete_gps_session(uuid) from public, anon;
grant execute on function public.import_gps_session(text, text, date, numeric, numeric, text, boolean, jsonb), public.delete_gps_session(uuid) to authenticated;

notify pgrst, 'reload schema';
