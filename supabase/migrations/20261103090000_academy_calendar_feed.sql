-- Private calendar-feed tokens for the academy-ical server function (one per member; replaceable).
create table if not exists public.acad_cal_tokens (
  member_id uuid primary key references public.acad_members (id) on delete cascade,
  token text not null unique check (token ~ '^[A-Za-z0-9]{32}$'),
  created_at timestamptz not null default now()
);
alter table public.acad_cal_tokens enable row level security;
revoke all on public.acad_cal_tokens from anon, authenticated;

create or replace function public.acad_cal_token(a uuid, renew boolean default false) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := public.acad_me(a); t text;
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if renew then delete from public.acad_cal_tokens where member_id = me; end if;
  select token into t from public.acad_cal_tokens where member_id = me;
  if t is null then
    t := replace(gen_random_uuid()::text, '-', '');
    insert into public.acad_cal_tokens (member_id, token) values (me, t);
  end if;
  return t;
end $$;
revoke all on function public.acad_cal_token(uuid, boolean) from public, anon;
grant execute on function public.acad_cal_token(uuid, boolean) to authenticated;
notify pgrst, 'reload schema';
