-- Email copies of notifications for people who turned on "Email notifications" in Settings.
-- A scheduled server job reads what is due through service-only functions, sends it, and marks it sent.
-- Only notifications from the last day are considered, so switching the preference on does not send old news.

alter table public.notifications add column emailed_at timestamptz;
create index notifications_email_due_idx on public.notifications (created_at) where emailed_at is null;

create or replace function public.notification_email_due(p_limit integer)
returns table (id uuid, email text, full_name text, locale text, kind text, title text, body text, link text)
language sql stable security definer set search_path = public, pg_temp as $$
  select n.id, p.email, p.full_name, p.locale, n.kind, n.title, n.body, n.link
    from public.notifications n
    join public.profiles p on p.id = n.user_id
   where n.emailed_at is null
     and n.created_at > now() - interval '1 day'
     and coalesce((p.notification_prefs ->> 'email')::boolean, false)
     and p.email is not null
   order by n.created_at
   limit greatest(1, least(coalesce(p_limit, 100), 500))
$$;

create or replace function public.notification_mark_emailed(p_ids uuid[])
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n integer;
begin
  update public.notifications set emailed_at = now() where id = any (p_ids) and emailed_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function public.notification_email_due(integer), public.notification_mark_emailed(uuid[]) from public, anon, authenticated;
grant execute on function public.notification_email_due(integer), public.notification_mark_emailed(uuid[]) to service_role;

notify pgrst, 'reload schema';
