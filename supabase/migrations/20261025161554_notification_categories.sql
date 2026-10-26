-- Notification categories: a person can turn off whole kinds of in-app notifications
-- (injury, message, program, team, connection) in Settings. The choice is stored in
-- profiles.notification_prefs -> 'muted' (a list of category names).

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select p_user, p_kind, p_title, p_body, p_link
  where p_user is not null
    and coalesce((select (notification_prefs ->> 'in_app')::boolean from public.profiles where id = p_user), true)
    and not coalesce((select (notification_prefs -> 'muted') ? split_part(p_kind, '.', 1)
                        from public.profiles
                       where id = p_user and jsonb_typeof(notification_prefs -> 'muted') = 'array'), false);
$$;
revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;
