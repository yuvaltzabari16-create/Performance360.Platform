-- File attachments in each category, and GPS import for the physiotherapist.
--
-- Attachments are stored in the database (small files, up to 5 MB, a fixed list of document and image
-- types) so they follow the same row-level security as the records they belong to:
--   message   -> a message (sender attaches; sender and recipient read)
--   injury    -> an injury (the athlete's professionals and the athlete attach; the director reads)
--   gps       -> a GPS session (its importer attaches)
--   test      -> an athlete's testing documents (professionals attach)
--   athlete   -> general athlete documents (professionals and the athlete attach)
--   training  -> a training program (its owner attaches)
-- Files are only ever served as downloads (never rendered inline) with a type fixed from the extension.

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('message', 'injury', 'gps', 'test', 'athlete', 'training')),
  ref_id uuid not null,
  athlete_id uuid references public.athletes (id) on delete cascade,
  uploaded_by uuid references auth.users (id) on delete set null default auth.uid(),
  file_name text not null check (char_length(file_name) between 1 and 200
    and file_name ~* '\.(pdf|png|jpe?g|webp|gif|csv|txt|docx?|xlsx?|pptx?)$'),
  mime_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  data bytea not null,
  created_at timestamptz not null default now(),
  check (octet_length(data) = size_bytes)
);
create index attachments_ref_idx on public.attachments (kind, ref_id);
create index attachments_athlete_idx on public.attachments (athlete_id);
alter table public.attachments enable row level security;
revoke insert, update, delete on public.attachments from anon, authenticated;

create or replace function public.can_view_attachment(p_kind text, p_ref uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select case p_kind
    when 'message' then exists (select 1 from public.direct_messages m where m.id = p_ref and auth.uid() in (m.sender_id, m.recipient_id))
    when 'injury' then exists (select 1 from public.injuries i where i.id = p_ref
                               and (public.can_access_athlete(i.athlete_id) or public.director_sees_athlete(i.athlete_id)))
    when 'gps' then public.can_view_gps_session(p_ref)
    when 'training' then public.can_view_program(p_ref)
    else p_athlete is not null and (public.can_access_athlete(p_athlete) or public.director_sees_athlete(p_athlete))
  end
$$;

create or replace function public.can_attach(p_kind text, p_ref uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select case p_kind
    when 'message' then exists (select 1 from public.direct_messages m where m.id = p_ref and m.sender_id = auth.uid())
    when 'injury' then exists (select 1 from public.injuries i where i.id = p_ref
                               and (public.is_athlete_professional(i.athlete_id) or public.is_own_athlete_record(i.athlete_id)))
    when 'gps' then exists (select 1 from public.gps_sessions g where g.id = p_ref and g.owner_id = auth.uid())
    when 'training' then public.owns_program(p_ref)
    when 'test' then p_athlete is not null and public.is_athlete_professional(p_athlete)
    when 'athlete' then p_athlete is not null and (public.is_athlete_professional(p_athlete) or public.is_own_athlete_record(p_athlete))
    else false
  end
$$;

create policy attachments_select on public.attachments for select to authenticated using (public.can_view_attachment(kind, ref_id, athlete_id));

create or replace function public.add_attachment(p_kind text, p_ref uuid, p_athlete uuid, p_name text, p_data bytea)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '[\\/:*?"<>|\x00-\x1f]', '_', 'g');
  v_ext text := lower(substring(v_name from '\.([A-Za-z0-9]+)$'));
  v_mime text;
  v_athlete uuid := p_athlete;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_kind = 'injury' then select athlete_id into v_athlete from public.injuries where id = p_ref; end if;
  if not public.can_attach(p_kind, p_ref, v_athlete) then raise exception 'not allowed' using errcode = '42501'; end if;
  v_mime := case v_ext
    when 'pdf' then 'application/pdf' when 'png' then 'image/png' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg'
    when 'webp' then 'image/webp' when 'gif' then 'image/gif' when 'csv' then 'text/csv' when 'txt' then 'text/plain'
    when 'doc' then 'application/msword' when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    when 'xls' then 'application/vnd.ms-excel' when 'xlsx' then 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    when 'ppt' then 'application/vnd.ms-powerpoint' when 'pptx' then 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    else null end;
  if v_mime is null then raise exception 'file type not allowed'; end if;
  if p_data is null or octet_length(p_data) not between 1 and 5242880 then raise exception 'file size not allowed'; end if;
  insert into public.attachments (kind, ref_id, athlete_id, file_name, mime_type, size_bytes, data)
  values (p_kind, p_ref, case when p_kind in ('message', 'gps', 'training') then null else v_athlete end,
          left(v_name, 200), v_mime, octet_length(p_data), p_data)
  returning id into v_id;
  perform public.write_audit('attachment.added', 'attachment', v_id::text, jsonb_build_object('kind', p_kind));
  return v_id;
end $$;

-- Remove a file the caller uploaded.
create or replace function public.remove_attachment(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.attachments where id = p_id and uploaded_by = auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.attachments where id = p_id;
  perform public.write_audit('attachment.removed', 'attachment', p_id::text);
end $$;

revoke execute on function public.can_view_attachment(text, uuid, uuid), public.can_attach(text, uuid, uuid) from public, anon;
grant execute on function public.can_view_attachment(text, uuid, uuid), public.can_attach(text, uuid, uuid) to authenticated;
revoke execute on function public.add_attachment(text, uuid, uuid, text, bytea), public.remove_attachment(uuid) from public, anon;
grant execute on function public.add_attachment(text, uuid, uuid, text, bytea), public.remove_attachment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- GPS import is open to the physiotherapist too (only the director cannot import).
-- ---------------------------------------------------------------------------
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
  if not public.is_professional() or coalesce(public.my_org_role(), '') = 'director' then
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

notify pgrst, 'reload schema';
