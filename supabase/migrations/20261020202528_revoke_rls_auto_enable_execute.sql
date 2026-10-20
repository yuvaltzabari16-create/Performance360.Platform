-- rls_auto_enable is Supabase's event-trigger function that enables RLS on new
-- public tables. It runs from the event trigger, never through the API, so API
-- roles do not need EXECUTE on it. (Absent in plain Postgres test runs.)
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
