-- Terms acceptance for accounts created with Google sign-in. Those accounts have no sign-up form, so they accept the
-- terms and privacy policy on a page right after the first sign-in. The acceptance record stays out of the person's
-- reach for direct edits; this function is the only way to set it, and it only ever writes to the caller's own row.

create or replace function public.accept_terms(p_version text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v text := nullif(left(btrim(coalesce(p_version, '')), 20), '');
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if v is null then raise exception 'terms version required' using errcode = '22023'; end if;
  update public.profiles set terms_version = v, terms_accepted_at = now() where id = auth.uid();
end $$;

revoke execute on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;

notify pgrst, 'reload schema';
