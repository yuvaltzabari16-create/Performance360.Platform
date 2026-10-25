-- Wearables (WHOOP, Fitbit): an athlete connects their own device account or imports an export file.
--
--   * wearable_connections  one row per athlete and provider: status, sharing choice, last sync. Readable by
--                           the athlete; readable by staff only when the athlete chose to share.
--   * wearable_tokens       encrypted access / refresh tokens (encrypted by the app with its own key).
--                           No policy at all: only the SECURITY DEFINER functions below touch it.
--   * wearable_daily        one row per athlete, provider and day: recovery, HRV, resting heart rate, sleep,
--                           strain. Same visibility as the connection's sharing choice.
-- Everything is written through functions that act only on the caller's own athlete record: staff cannot
-- connect, import or alter an athlete's wearable data, and cannot read it unless the athlete shares it.

create table public.wearable_connections (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  provider text not null check (provider in ('whoop', 'fitbit')),
  source text not null default 'api' check (source in ('api', 'file')),
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  share_with_staff boolean not null default false,
  scopes text,
  external_user text,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  unique (athlete_id, provider)
);

create table public.wearable_tokens (
  connection_id uuid primary key references public.wearable_connections (id) on delete cascade,
  access_cipher text,
  refresh_cipher text,
  expires_at timestamptz
);

create table public.wearable_daily (
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  provider text not null check (provider in ('whoop', 'fitbit')),
  day date not null,
  recovery_score numeric(5, 1) check (recovery_score is null or recovery_score between 0 and 100),
  hrv_ms numeric(6, 1) check (hrv_ms is null or hrv_ms between 0 and 500),
  resting_hr numeric(5, 1) check (resting_hr is null or resting_hr between 20 and 150),
  sleep_hours numeric(4, 2) check (sleep_hours is null or sleep_hours between 0 and 24),
  sleep_performance numeric(5, 1) check (sleep_performance is null or sleep_performance between 0 and 100),
  strain numeric(4, 1) check (strain is null or strain between 0 and 30),
  avg_hr numeric(5, 1) check (avg_hr is null or avg_hr between 20 and 250),
  max_hr numeric(5, 1) check (max_hr is null or max_hr between 20 and 250),
  spo2 numeric(4, 1) check (spo2 is null or spo2 between 50 and 100),
  skin_temp_c numeric(4, 1) check (skin_temp_c is null or skin_temp_c between 20 and 45),
  updated_at timestamptz not null default now(),
  primary key (athlete_id, provider, day)
);
create index wearable_daily_day_idx on public.wearable_daily (athlete_id, day desc);

alter table public.wearable_connections enable row level security;
alter table public.wearable_tokens enable row level security;     -- no policy: closed to every client role
alter table public.wearable_daily enable row level security;
revoke all on public.wearable_connections, public.wearable_tokens, public.wearable_daily from anon, authenticated;
grant select on public.wearable_connections, public.wearable_daily to authenticated;

-- Staff and the director read wearable data only for athletes who share it with them.
create or replace function public.can_view_wearables(p_athlete uuid, p_provider text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_own_athlete_record(p_athlete)
      or (exists (select 1 from public.wearable_connections c
                  where c.athlete_id = p_athlete and c.provider = p_provider and c.share_with_staff)
          and (public.can_access_athlete(p_athlete) or public.director_sees_athlete(p_athlete)))
$$;

create policy wearable_connections_select on public.wearable_connections for select to authenticated
  using (public.is_own_athlete_record(athlete_id)
         or (share_with_staff and (public.can_access_athlete(athlete_id) or public.director_sees_athlete(athlete_id))));
create policy wearable_daily_select on public.wearable_daily for select to authenticated
  using (public.can_view_wearables(athlete_id, provider));

-- ---------------------------------------------------------------------------
-- Functions (all act on the caller's own athlete record)
-- ---------------------------------------------------------------------------
create or replace function public.wearable_me()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.athletes where user_id = auth.uid()
$$;

-- Connect (or reconnect) a provider; tokens arrive already encrypted by the app.
create or replace function public.wearable_connect(p_provider text, p_source text, p_access text, p_refresh text, p_expires timestamptz, p_scopes text, p_external text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_athlete uuid := public.wearable_me();
  v_id uuid;
begin
  if v_athlete is null then raise exception 'not an athlete' using errcode = '42501'; end if;
  insert into public.wearable_connections (athlete_id, provider, source, status, scopes, external_user, connected_at, last_error)
  values (v_athlete, p_provider, coalesce(p_source, 'api'), 'connected', left(p_scopes, 300), left(p_external, 100), now(), null)
  on conflict (athlete_id, provider) do update
    set source = excluded.source, status = 'connected', scopes = excluded.scopes, external_user = excluded.external_user,
        connected_at = now(), last_error = null
  returning id into v_id;
  insert into public.wearable_tokens (connection_id, access_cipher, refresh_cipher, expires_at)
  values (v_id, p_access, p_refresh, p_expires)
  on conflict (connection_id) do update set access_cipher = excluded.access_cipher, refresh_cipher = excluded.refresh_cipher, expires_at = excluded.expires_at;
  perform public.write_audit('wearable.connected', 'wearable_connection', v_id::text, jsonb_build_object('provider', p_provider, 'source', p_source));
  return v_id;
end $$;

create or replace function public.wearable_tokens_get(p_provider text)
returns table (access_cipher text, refresh_cipher text, expires_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select t.access_cipher, t.refresh_cipher, t.expires_at
    from public.wearable_connections c join public.wearable_tokens t on t.connection_id = c.id
   where c.athlete_id = public.wearable_me() and c.provider = p_provider and c.status = 'connected'
$$;

create or replace function public.wearable_tokens_update(p_provider text, p_access text, p_refresh text, p_expires timestamptz)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.wearable_tokens t set access_cipher = p_access, refresh_cipher = coalesce(p_refresh, t.refresh_cipher), expires_at = p_expires
    from public.wearable_connections c
   where t.connection_id = c.id and c.athlete_id = public.wearable_me() and c.provider = p_provider
$$;

-- Insert or update daily rows. p_rows: array of objects with day plus any metric.
create or replace function public.wearable_save_days(p_provider text, p_rows jsonb, p_error text default null)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_athlete uuid := public.wearable_me();
  v_row jsonb;
  v_n integer := 0;
begin
  if v_athlete is null then raise exception 'not an athlete' using errcode = '42501'; end if;
  if not exists (select 1 from public.wearable_connections where athlete_id = v_athlete and provider = p_provider and status = 'connected') then
    raise exception 'not connected' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 400 then raise exception 'invalid rows'; end if;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    insert into public.wearable_daily (athlete_id, provider, day, recovery_score, hrv_ms, resting_hr, sleep_hours, sleep_performance, strain, avg_hr, max_hr, spo2, skin_temp_c)
    values (v_athlete, p_provider, (v_row ->> 'day')::date,
      (v_row ->> 'recovery_score')::numeric, (v_row ->> 'hrv_ms')::numeric, (v_row ->> 'resting_hr')::numeric,
      (v_row ->> 'sleep_hours')::numeric, (v_row ->> 'sleep_performance')::numeric, (v_row ->> 'strain')::numeric,
      (v_row ->> 'avg_hr')::numeric, (v_row ->> 'max_hr')::numeric, (v_row ->> 'spo2')::numeric, (v_row ->> 'skin_temp_c')::numeric)
    on conflict (athlete_id, provider, day) do update set
      recovery_score = coalesce(excluded.recovery_score, wearable_daily.recovery_score),
      hrv_ms = coalesce(excluded.hrv_ms, wearable_daily.hrv_ms),
      resting_hr = coalesce(excluded.resting_hr, wearable_daily.resting_hr),
      sleep_hours = coalesce(excluded.sleep_hours, wearable_daily.sleep_hours),
      sleep_performance = coalesce(excluded.sleep_performance, wearable_daily.sleep_performance),
      strain = coalesce(excluded.strain, wearable_daily.strain),
      avg_hr = coalesce(excluded.avg_hr, wearable_daily.avg_hr),
      max_hr = coalesce(excluded.max_hr, wearable_daily.max_hr),
      spo2 = coalesce(excluded.spo2, wearable_daily.spo2),
      skin_temp_c = coalesce(excluded.skin_temp_c, wearable_daily.skin_temp_c),
      updated_at = now();
    v_n := v_n + 1;
  end loop;
  update public.wearable_connections
     set last_sync_at = now(), last_error = left(p_error, 300), status = case when p_error is null then 'connected' else 'error' end
   where athlete_id = v_athlete and provider = p_provider;
  return v_n;
end $$;

create or replace function public.wearable_set_sharing(p_provider text, p_share boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.wearable_connections set share_with_staff = coalesce(p_share, false)
   where athlete_id = public.wearable_me() and provider = p_provider;
  if not found then raise exception 'not connected' using errcode = '42501'; end if;
  perform public.write_audit('wearable.sharing', 'wearable_connection', p_provider, jsonb_build_object('share', p_share));
end $$;

-- Disconnect: the provider link and tokens are cleared and sharing is switched off; already stored days stay
-- until the athlete erases them (wearable_erase_data, in supabase/manual because it contains a DELETE).
create or replace function public.wearable_disconnect(p_provider text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  update public.wearable_connections set status = 'disconnected', share_with_staff = false
   where athlete_id = public.wearable_me() and provider = p_provider returning id into v_id;
  if v_id is null then raise exception 'not connected' using errcode = '42501'; end if;
  update public.wearable_tokens set access_cipher = null, refresh_cipher = null, expires_at = null where connection_id = v_id;
  perform public.write_audit('wearable.disconnected', 'wearable_connection', v_id::text, jsonb_build_object('provider', p_provider));
end $$;

-- Erase every stored day for a provider (the athlete's right to delete). Contains a DELETE, so it is also in
-- supabase/manual/pending_delete_functions.sql for the live project.
create or replace function public.wearable_erase_data(p_provider text)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_n integer;
begin
  delete from public.wearable_daily where athlete_id = public.wearable_me() and provider = p_provider;
  get diagnostics v_n = row_count;
  perform public.write_audit('wearable.erased', 'wearable_daily', p_provider, jsonb_build_object('days', v_n));
  return v_n;
end $$;

revoke execute on function public.wearable_me(), public.can_view_wearables(uuid, text) from public, anon;
grant execute on function public.can_view_wearables(uuid, text) to authenticated;
revoke execute on function public.wearable_connect(text, text, text, text, timestamptz, text, text), public.wearable_tokens_get(text),
  public.wearable_tokens_update(text, text, text, timestamptz), public.wearable_save_days(text, jsonb, text),
  public.wearable_set_sharing(text, boolean), public.wearable_disconnect(text), public.wearable_erase_data(text) from public, anon;
grant execute on function public.wearable_connect(text, text, text, text, timestamptz, text, text), public.wearable_tokens_get(text),
  public.wearable_tokens_update(text, text, text, timestamptz), public.wearable_save_days(text, jsonb, text),
  public.wearable_set_sharing(text, boolean), public.wearable_disconnect(text), public.wearable_erase_data(text) to authenticated;

notify pgrst, 'reload schema';
