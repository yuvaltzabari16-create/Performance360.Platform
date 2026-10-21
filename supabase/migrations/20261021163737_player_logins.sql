-- Username + PIN logins for players (no email needed).
-- Accounts are created by the player-login edge function (service role); clients can only read.
create table public.player_logins (
  player_id uuid primary key references public.players(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  pin_reset_at timestamptz
);
create index on public.player_logins(club_id);
alter table public.player_logins enable row level security;
create policy player_logins_select on public.player_logins for select to authenticated
  using (public.is_staff(club_id) or user_id = (select auth.uid()));
revoke insert, update, delete on public.player_logins from authenticated, anon;
