-- A squad assignment only counts while the person is still staff of that club.
create or replace function public.coaches_squad(p_squad uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.squad_staff ss
    join public.squads s on s.id = ss.squad_id
    join public.club_members m on m.club_id = s.club_id and m.user_id = ss.user_id
    where ss.squad_id = p_squad and ss.user_id = auth.uid() and m.role in ('director','coach')
  )
$$;

-- Removing someone from a club (or demoting to athlete) clears their squad assignments.
create or replace function public.cleanup_squad_staff() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.squad_staff ss using public.squads s
  where ss.squad_id = s.id and s.club_id = old.club_id and ss.user_id = old.user_id;
  return null;
end $$;
create trigger club_members_cleanup after delete on public.club_members
  for each row execute function public.cleanup_squad_staff();
create trigger club_members_demote after update of role on public.club_members
  for each row when (new.role = 'athlete') execute function public.cleanup_squad_staff();
revoke execute on function public.cleanup_squad_staff() from public, anon, authenticated;

-- Directors can't be removed by other directors; protects the club from lock-out.
alter policy members_delete on public.club_members
  using (public.is_director(club_id) and user_id <> (select auth.uid()) and role <> 'director');
