-- Functions that contain a DELETE statement.
-- The Supabase connection used by the assistant asks for a confirmation on these and the question
-- cannot be answered from there, so they are kept here to run once in the Supabase dashboard:
--   SQL editor -> paste this file -> Run.   (Safe to run more than once.)

-- 1. Permanent account deletion (Settings -> Delete account)
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_role text;
  r record;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select org_id, org_role into v_org, v_role
    from public.organization_members where user_id = v_uid and status = 'active';
  if v_org is not null and v_role = 'director'
     and (select count(*) from public.organization_members where org_id = v_org and status = 'active' and org_role = 'director') < 2
     and (select count(*) from public.organization_members where org_id = v_org and status = 'active') > 1 then
    raise exception 'last_director' using errcode = 'P0001', hint = 'Hand the director role to another member first.';
  end if;

  perform public.write_audit('account.deleted', 'profile', v_uid::text);
  -- Unlinking athletes from the deleted account is an allowed link change (transaction-local switch).
  perform set_config('p360.allow_link', 'on', true);

  if v_org is not null and (select count(*) from public.organization_members where org_id = v_org and status = 'active') = 1 then
    delete from public.organizations where id = v_org;
  end if;

  delete from public.athletes where user_id = v_uid and owner_coach_id is null;

  -- Foreign keys to auth.users without an ON DELETE rule would block the delete: clear them.
  for r in
    select c.conrelid::regclass as tbl, a.attname as col, a.attnotnull as mandatory
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and c.confdeltype in ('a', 'r')
       and (select relnamespace from pg_class where oid = c.conrelid) = 'public'::regnamespace
  loop
    if r.mandatory then
      execute format('delete from %s where %I = $1', r.tbl, r.col) using v_uid;
    else
      execute format('update %s set %I = null where %I = $1', r.tbl, r.col, r.col) using v_uid;
    end if;
  end loop;

  delete from auth.users where id = v_uid;
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;


-- 2. Delete a GPS session (GPS -> session -> Delete session)
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
revoke execute on function public.delete_gps_session(uuid) from public, anon;
grant execute on function public.delete_gps_session(uuid) to authenticated;

-- 3. Remove an attached file (Files -> Remove)
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
revoke execute on function public.remove_attachment(uuid) from public, anon;
grant execute on function public.remove_attachment(uuid) to authenticated;

-- 4. Erase stored wearable days (Wearables -> Erase stored data); needs the wearables migration first
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
revoke execute on function public.wearable_erase_data(text) from public, anon;
grant execute on function public.wearable_erase_data(text) to authenticated;

notify pgrst, 'reload schema';
