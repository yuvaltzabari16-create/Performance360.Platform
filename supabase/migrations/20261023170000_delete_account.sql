-- Permanent account deletion, requested by the account owner from Settings.
--
-- What happens:
--   * the sign-in account and profile are removed (rows that reference them cascade);
--   * a team director cannot delete the account while other staff remain (hand over first);
--     a sole team member dissolves the team with the account;
--   * an athlete record the person created for themselves is erased; a record created by a coach
--     stays with that coach (professional record) but is unlinked from the deleted account;
--   * references that would otherwise block deletion are cleared generically, so future tables
--     with a plain "created_by uuid references auth.users" column keep working.
-- The action is written to the audit log with the (now orphaned) account id only.

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

notify pgrst, 'reload schema';
