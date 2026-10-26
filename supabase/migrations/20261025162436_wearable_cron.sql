-- Scheduled WHOOP sync. A server job (Vercel cron) uses the service-role key to sync every connected athlete
-- without a person being signed in. These functions are callable only by the service role, never by app users
-- or the public API roles.
--
-- The user-facing save function is rebuilt on top of the same internal one, so both paths store days the same way.

create or replace function public.wearable_save_days_for(p_athlete uuid, p_provider text, p_rows jsonb, p_error text default null)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row jsonb;
  v_n integer := 0;
begin
  if p_athlete is null then raise exception 'not an athlete' using errcode = '42501'; end if;
  if not exists (select 1 from public.wearable_connections where athlete_id = p_athlete and provider = p_provider and status in ('connected', 'error')) then
    raise exception 'not connected' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 400 then raise exception 'invalid rows'; end if;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    insert into public.wearable_daily (athlete_id, provider, day, recovery_score, hrv_ms, resting_hr, sleep_hours, sleep_performance, strain, avg_hr, max_hr, spo2, skin_temp_c)
    values (p_athlete, p_provider, (v_row ->> 'day')::date,
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
   where athlete_id = p_athlete and provider = p_provider;
  return v_n;
end $$;

create or replace function public.wearable_save_days(p_provider text, p_rows jsonb, p_error text default null)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.wearable_me() is null then raise exception 'not an athlete' using errcode = '42501'; end if;
  return public.wearable_save_days_for(public.wearable_me(), p_provider, p_rows, p_error);
end $$;

-- Connections that are due for a sync: API-linked, not synced for p_older_than, with tokens on file.
create or replace function public.wearable_cron_due(p_provider text, p_older_than interval, p_limit integer)
returns table (athlete_id uuid, access_cipher text, refresh_cipher text, expires_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.athlete_id, t.access_cipher, t.refresh_cipher, t.expires_at
    from public.wearable_connections c
    join public.wearable_tokens t on t.connection_id = c.id
   where c.provider = p_provider and c.source = 'api' and c.status in ('connected', 'error')
     and t.access_cipher is not null
     and (c.last_sync_at is null or c.last_sync_at < now() - p_older_than)
   order by c.last_sync_at nulls first
   limit greatest(1, least(coalesce(p_limit, 50), 200))
$$;

create or replace function public.wearable_cron_tokens_update(p_athlete uuid, p_provider text, p_access text, p_refresh text, p_expires timestamptz)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.wearable_tokens t set access_cipher = p_access, refresh_cipher = coalesce(p_refresh, t.refresh_cipher), expires_at = p_expires
    from public.wearable_connections c
   where t.connection_id = c.id and c.athlete_id = p_athlete and c.provider = p_provider
$$;

revoke execute on function public.wearable_save_days_for(uuid, text, jsonb, text), public.wearable_cron_due(text, interval, integer),
  public.wearable_cron_tokens_update(uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.wearable_save_days_for(uuid, text, jsonb, text), public.wearable_cron_due(text, interval, integer),
  public.wearable_cron_tokens_update(uuid, text, text, text, timestamptz) to service_role;

notify pgrst, 'reload schema';
