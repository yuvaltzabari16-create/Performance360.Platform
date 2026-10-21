alter policy notes_insert on public.player_notes
  with check (author_id = (select auth.uid()) and public.is_staff(club_id));
revoke execute on function public.handle_new_user(), public.set_club_from_player(), public.check_player_squad(), public.set_updated_at() from authenticated, anon, public;
