-- Performance360 Academy: sign in with one personal code (no email, no password, no Claude).
-- Every member (owner, coach, physiotherapist, athlete) has a stable member id and a personal sign-in code.
-- A device signs in anonymously with Supabase Auth and is then linked to a member by entering that code.
-- Records are keyed by member id, so the same person on a new phone sees the same records.
-- Replaces 20261101120000_academy_standalone (no academies existed yet).

-- ---------- remove the email-code version ----------
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    drop policy if exists "academy meal photos read" on storage.objects;
    drop policy if exists "academy meal photos add" on storage.objects;
    drop policy if exists "academy meal photos remove" on storage.objects;
  end if;
end $$;
drop table if exists public.acad_docs, public.acad_join_attempts, public.acad_codes, public.acad_members, public.acad_academies cascade;
drop function if exists public.acad_role(uuid), public.acad_level(uuid), public.acad_active(uuid), public.acad_can(uuid, text, boolean),
  public.acad_try_uuid(text), public.acad_docs_stamp(), public.acad_jsonb_merge(jsonb, jsonb), public.acad_merge(uuid, text, jsonb),
  public.acad_new_code(), public.acad_set_code(uuid, text), public.acad_my_academies(), public.acad_create_academy(text, text, text),
  public.acad_join(text, text), public.acad_codes_list(uuid), public.acad_rotate_code(uuid, text), public.acad_disable_code(uuid, text),
  public.acad_member_names(uuid), public.acad_set_display_name(uuid, text), public.acad_set_member_role(uuid, uuid, text),
  public.acad_remove_member(uuid, uuid), public.acad_delete_my_account(), public.acad_delete_academy(uuid) cascade;

-- ---------- tables ----------
create table public.acad_academies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  plan text not null default 'trial' check (plan in ('trial', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz not null default now() + interval '30 days',
  paid_until timestamptz,
  created_at timestamptz not null default now()
);

create table public.acad_members (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.acad_academies (id) on delete cascade,
  role text not null check (role in ('owner', 'coach', 'physio', 'athlete')),
  display_name text not null default '' check (char_length(display_name) <= 80),
  login_code text not null unique check (login_code ~ '^[A-Z2-9]{8}$'),
  joined_at timestamptz not null default now(),
  last_sign_in timestamptz
);
create index acad_members_academy_idx on public.acad_members (academy_id);

-- which signed-in device belongs to which member (one member per device at a time)
create table public.acad_sessions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  member_id uuid not null references public.acad_members (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index acad_sessions_member_idx on public.acad_sessions (member_id);

-- shared codes that let a new coach, physiotherapist or athlete add themself
create table public.acad_codes (
  academy_id uuid not null references public.acad_academies (id) on delete cascade,
  role text not null check (role in ('athlete', 'coach', 'physio')),
  code text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  created_at timestamptz not null default now(),
  primary key (academy_id, role)
);

create table public.acad_attempts (user_id uuid not null, at timestamptz not null default now());
create index acad_attempts_idx on public.acad_attempts (user_id, at);

create table public.acad_docs (
  academy_id uuid not null references public.acad_academies (id) on delete cascade,
  path text not null check (
    char_length(path) <= 1000
    and path ~ '^[A-Za-z0-9_.~:@+-]{1,200}(/[A-Za-z0-9_.~:@+-]{1,200}){1,15}$'
    and path !~ '(^|/)\.{1,2}(/|$)'
    and array_length(string_to_array(path, '/'), 1) % 2 = 0),
  coll text generated always as (regexp_replace(path, '/[^/]+$', '')) stored,
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 262144),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (academy_id, path)
);
create index acad_docs_coll_idx on public.acad_docs (academy_id, coll);

alter table public.acad_academies enable row level security;
alter table public.acad_members enable row level security;
alter table public.acad_sessions enable row level security;
alter table public.acad_codes enable row level security;
alter table public.acad_attempts enable row level security;
alter table public.acad_docs enable row level security;
revoke all on public.acad_academies, public.acad_members, public.acad_sessions, public.acad_codes, public.acad_attempts, public.acad_docs from anon, authenticated;

-- ---------- helpers ----------
create or replace function public.acad_new_code() returns text
language plpgsql volatile set search_path = public, pg_temp as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea := decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex');
  out text := '';
begin
  for i in 0..7 loop out := out || substr(alphabet, (get_byte(b, i * 3) % 31) + 1, 1); end loop;
  return out;
end $$;

-- a code not used anywhere, as a personal code or as a shared code
create or replace function public.acad_free_code() returns text
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare c text;
begin
  loop
    c := public.acad_new_code();
    exit when not exists (select 1 from public.acad_members where login_code = c)
          and not exists (select 1 from public.acad_codes where code = c);
  end loop;
  return c;
end $$;

create or replace function public.acad_norm(c text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select upper(regexp_replace(coalesce(c, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

-- the member this device is signed in as, in academy a
create or replace function public.acad_me(a uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id from public.acad_sessions s join public.acad_members m on m.id = s.member_id
   where s.user_id = auth.uid() and m.academy_id = a
$$;

create or replace function public.acad_role(a uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select m.role from public.acad_members m where m.id = public.acad_me(a)
$$;

create or replace function public.acad_level(a uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select case public.acad_role(a) when 'owner' then 3 when 'coach' then 2 when 'physio' then 2 when 'athlete' then 1 else 0 end
$$;

create or replace function public.acad_active(a uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select (x.plan = 'trial' and x.trial_ends_at > now())
                       or (x.plan = 'active' and (x.paid_until is null or x.paid_until > now()))
                     from public.acad_academies x where x.id = a), false)
$$;

-- The rule table. Levels: 1 athlete, 2 coach/physio, 3 owner. A member's own documents are those whose
-- second path segment is their member id; for those the more generous level applies.
create or replace function public.acad_can(a uuid, p text, w boolean) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  lvl int := public.acad_level(a);
  me text := public.acad_me(a)::text;
  s text[] := string_to_array(p, '/');
  pr int; pw int; sr int; sw int;
begin
  if lvl = 0 or me is null or p is null then return false; end if;
  if w and not public.acad_active(a) then return false; end if;
  case s[1]
    when 'academy' then pr := 1; pw := 3;
    when 'library' then pr := 1; pw := 2;
    when 'staff' then pr := 1; pw := 3; sr := 1; sw := 2;
    when 'athletes', 'logs', 'meals', 'inbox' then pr := 2; pw := 2; sr := 1; sw := 1;
    when 'roster', 'plan', 'notes', 'tests' then pr := 2; pw := 2; sr := 1; sw := 2;
    when 'payments', 'ownerprivate' then pr := 3; pw := 3;
    when 'programs', 'staffroom', 'staffnotes' then pr := 2; pw := 2;
    when 'data' then return s[2] = 'users' and s[3] = me;
    else pr := 2; pw := 3;
  end case;
  if sr is not null and s[2] = me then
    return lvl >= least(case when w then pw else pr end, case when w then sw else sr end);
  end if;
  return lvl >= case when w then pw else pr end;
end $$;

create or replace function public.acad_try_uuid(t text) returns uuid
language plpgsql immutable set search_path = public, pg_temp as $$
begin return t::uuid; exception when others then return null; end $$;

-- ---------- documents ----------
create policy acad_docs_read on public.acad_docs for select to authenticated using (public.acad_can(academy_id, path, false));
create policy acad_docs_insert on public.acad_docs for insert to authenticated with check (public.acad_can(academy_id, path, true));
create policy acad_docs_update on public.acad_docs for update to authenticated
  using (public.acad_can(academy_id, path, true)) with check (public.acad_can(academy_id, path, true));
create policy acad_docs_delete on public.acad_docs for delete to authenticated using (public.acad_can(academy_id, path, true));

create or replace function public.acad_docs_stamp() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
create trigger acad_docs_stamp before insert or update on public.acad_docs for each row execute function public.acad_docs_stamp();

grant select, delete on public.acad_docs to authenticated;
grant insert (academy_id, path, data) on public.acad_docs to authenticated;
grant update (academy_id, path, data) on public.acad_docs to authenticated;

create or replace function public.acad_jsonb_merge(a jsonb, b jsonb) returns jsonb
language plpgsql immutable set search_path = public, pg_temp as $$
declare k text; v jsonb; r jsonb := coalesce(a, '{}'::jsonb);
begin
  for k, v in select * from jsonb_each(coalesce(b, '{}'::jsonb)) loop
    if v = 'null'::jsonb then r := r - k;
    elsif jsonb_typeof(v) = 'object' and jsonb_typeof(r -> k) = 'object' then r := jsonb_set(r, array[k], public.acad_jsonb_merge(r -> k, v));
    elsif jsonb_typeof(v) = 'object' then r := jsonb_set(r, array[k], jsonb_strip_nulls(v));
    else r := jsonb_set(r, array[k], v);
    end if;
  end loop;
  return r;
end $$;

create or replace function public.acad_merge(a uuid, p text, patch jsonb) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if patch is null or jsonb_typeof(patch) <> 'object' then raise exception 'patch must be an object' using errcode = '22023'; end if;
  update public.acad_docs set data = public.acad_jsonb_merge(data, patch) where academy_id = a and path = p;
  if not found then raise exception 'document not found' using errcode = 'P0002'; end if;
end $$;

-- ---------- sign in ----------
-- Too many wrong codes from one device locks code entry for 15 minutes.
create or replace function public.acad_throttle() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'no session' using errcode = '28000'; end if;
  if (select count(*) from public.acad_attempts t where t.user_id = auth.uid() and t.at > now() - interval '15 minutes') >= 8 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  insert into public.acad_attempts (user_id) values (auth.uid());
  delete from public.acad_attempts t where t.at < now() - interval '1 day';
end $$;

-- Enter a code. A personal code signs this device in as that member ('member'). A shared role code
-- returns 'join' so the app can ask for a name. Anything else returns no rows (not an error, so the
-- attempt stays counted).
create or replace function public.acad_enter(p_code text)
returns table (kind text, academy_id uuid, academy_name text, role text, member_id uuid)
language plpgsql security definer set search_path = public, pg_temp as $$
declare c text := public.acad_norm(p_code); m record; k record;
begin
  perform public.acad_throttle();
  select x.id, x.academy_id, x.role into m from public.acad_members x where x.login_code = c;
  if found then
    insert into public.acad_sessions (user_id, member_id) values (auth.uid(), m.id)
      on conflict (user_id) do update set member_id = excluded.member_id, created_at = now();
    update public.acad_members set last_sign_in = now() where id = m.id;
    delete from public.acad_attempts t where t.user_id = auth.uid();
    return query select 'member'::text, m.academy_id, (select name from public.acad_academies where id = m.academy_id), m.role, m.id;
    return;
  end if;
  select q.academy_id, q.role into k from public.acad_codes q where q.code = c;
  if found then
    if not public.acad_active(k.academy_id) then raise exception 'academy_inactive' using errcode = 'P0001'; end if;
    return query select 'join'::text, k.academy_id, (select name from public.acad_academies where id = k.academy_id), k.role, null::uuid;
  end if;
end $$;

-- Join with a shared role code: creates the member, signs this device in, returns their personal code.
create or replace function public.acad_join(p_code text, p_display text)
returns table (academy_id uuid, role text, member_id uuid, login_code text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare c text := public.acad_norm(p_code); dn text := left(btrim(coalesce(p_display, '')), 80); k record; mid uuid; lc text;
begin
  perform public.acad_throttle();
  if char_length(dn) < 2 then raise exception 'name_required' using errcode = '22023'; end if;
  select q.academy_id, q.role into k from public.acad_codes q where q.code = c;
  if not found then return; end if;
  if not public.acad_active(k.academy_id) then raise exception 'academy_inactive' using errcode = 'P0001'; end if;
  lc := public.acad_free_code();
  insert into public.acad_members (academy_id, role, display_name, login_code) values (k.academy_id, k.role, dn, lc) returning id into mid;
  insert into public.acad_sessions (user_id, member_id) values (auth.uid(), mid)
    on conflict (user_id) do update set member_id = excluded.member_id, created_at = now();
  if k.role in ('coach', 'physio') then
    insert into public.acad_docs (academy_id, path, data)
    values (k.academy_id, 'staff/' || mid::text, jsonb_build_object('name', dn, 'role', k.role, 'joined', now(), 'agreed', jsonb_build_object('at', now())));
  end if;
  return query select k.academy_id, k.role, mid, lc;
end $$;

-- Open a new academy: owner member, shared codes, settings; signs this device in as the owner.
create or replace function public.acad_create_academy(p_name text, p_display text, p_sport text default '')
returns table (academy_id uuid, member_id uuid, login_code text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare nm text := btrim(coalesce(p_name, '')); dn text := left(btrim(coalesce(p_display, '')), 80); aid uuid; mid uuid; lc text;
begin
  if auth.uid() is null then raise exception 'no session' using errcode = '28000'; end if;
  if char_length(nm) < 2 or char_length(nm) > 80 then raise exception 'academy name must be 2 to 80 characters' using errcode = '22023'; end if;
  if char_length(dn) < 2 then raise exception 'name_required' using errcode = '22023'; end if;
  if (select count(*) from public.acad_attempts t where t.user_id = auth.uid() and t.at > now() - interval '1 day') >= 20 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  insert into public.acad_attempts (user_id) values (auth.uid());
  insert into public.acad_academies (name) values (nm) returning id into aid;
  lc := public.acad_free_code();
  insert into public.acad_members (academy_id, role, display_name, login_code) values (aid, 'owner', dn, lc) returning id into mid;
  insert into public.acad_sessions (user_id, member_id) values (auth.uid(), mid)
    on conflict (user_id) do update set member_id = excluded.member_id, created_at = now();
  insert into public.acad_codes (academy_id, role, code) values
    (aid, 'athlete', public.acad_free_code()), (aid, 'coach', public.acad_free_code()), (aid, 'physio', public.acad_free_code());
  insert into public.acad_docs (academy_id, path, data) values
    (aid, 'academy/settings', jsonb_build_object('name', nm, 'sport', left(coalesce(p_sport, ''), 40), 'currency', 'ILS',
      'weekStart', 'sun', 'timezone', 'Asia/Jerusalem', 'defaultMinutes', 60, 'groups', '[]'::jsonb, 'mealComments', true, 'retentionMonths', 24)),
    (aid, 'staff/' || mid::text, jsonb_build_object('name', dn, 'role', 'coach', 'owner', true, 'title', 'Head coach', 'joined', now()));
  return query select aid, mid, lc;
end $$;

-- What this device is signed in as.
create or replace function public.acad_whoami()
returns table (id uuid, name text, role text, member_id uuid, display_name text, plan text, trial_ends_at timestamptz, paid_until timestamptz, active boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select x.id, x.name, m.role, m.id, m.display_name, x.plan, x.trial_ends_at, x.paid_until, public.acad_active(x.id)
    from public.acad_sessions s join public.acad_members m on m.id = s.member_id join public.acad_academies x on x.id = m.academy_id
   where s.user_id = auth.uid()
$$;

create or replace function public.acad_sign_out() returns void
language sql security definer set search_path = public, pg_temp as $$
  delete from public.acad_sessions where user_id = auth.uid()
$$;

-- ---------- people and codes ----------
-- Staff add athletes; the owner also adds coaches and physiotherapists. Returns the new personal code.
create or replace function public.acad_add_member(a uuid, p_role text, p_display text)
returns table (member_id uuid, login_code text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare dn text := left(btrim(coalesce(p_display, '')), 80); mid uuid; lc text; lvl int := public.acad_level(a);
begin
  if p_role not in ('athlete', 'coach', 'physio') then raise exception 'unknown role' using errcode = '22023'; end if;
  if not (lvl = 3 or (lvl = 2 and p_role = 'athlete')) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not public.acad_active(a) then raise exception 'academy_inactive' using errcode = 'P0001'; end if;
  if char_length(dn) < 2 then raise exception 'name_required' using errcode = '22023'; end if;
  lc := public.acad_free_code();
  insert into public.acad_members (academy_id, role, display_name, login_code) values (a, p_role, dn, lc) returning id into mid;
  if p_role = 'athlete' then
    insert into public.acad_docs (academy_id, path, data) values (a, 'athletes/' || mid::text, jsonb_build_object('name', dn, 'addedBy', public.acad_me(a), 'createdAt', now()));
  else
    insert into public.acad_docs (academy_id, path, data) values (a, 'staff/' || mid::text, jsonb_build_object('name', dn, 'role', p_role, 'joined', now()));
  end if;
  return query select mid, lc;
end $$;

-- People and their personal codes: the owner sees everyone; coaches and physiotherapists see athletes
-- and themself; an athlete sees only themself.
create or replace function public.acad_people(a uuid)
returns table (member_id uuid, role text, display_name text, login_code text, joined_at timestamptz, last_sign_in timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id, m.role, m.display_name, m.login_code, m.joined_at, m.last_sign_in from public.acad_members m
   where m.academy_id = a
     and (public.acad_level(a) = 3 or m.id = public.acad_me(a) or (public.acad_level(a) = 2 and m.role = 'athlete'))
   order by array_position(array['owner', 'coach', 'physio', 'athlete'], m.role), m.display_name
$$;

-- Names for display: staff see everyone; athletes see staff and themself.
create or replace function public.acad_member_names(a uuid) returns table (member_id uuid, role text, display_name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id, m.role, m.display_name from public.acad_members m
   where m.academy_id = a and public.acad_level(a) > 0
     and (public.acad_level(a) >= 2 or m.id = public.acad_me(a) or m.role <> 'athlete')
$$;

-- New personal code (lost or leaked): signs that person out everywhere.
create or replace function public.acad_reset_code(a uuid, m uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare r text; lvl int := public.acad_level(a); lc text;
begin
  select x.role into r from public.acad_members x where x.id = m and x.academy_id = a;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if not (lvl = 3 or m = public.acad_me(a) or (lvl = 2 and r = 'athlete')) then raise exception 'not allowed' using errcode = '42501'; end if;
  lc := public.acad_free_code();
  update public.acad_members set login_code = lc where id = m;
  delete from public.acad_sessions where member_id = m and user_id <> auth.uid();
  return lc;
end $$;

create or replace function public.acad_codes_list(a uuid) returns table (role text, code text)
language sql stable security definer set search_path = public, pg_temp as $$
  select k.role, k.code from public.acad_codes k
   where k.academy_id = a and (public.acad_level(a) = 3 or (public.acad_level(a) = 2 and k.role = 'athlete'))
   order by array_position(array['athlete', 'coach', 'physio'], k.role)
$$;

create or replace function public.acad_rotate_code(a uuid, r text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare c text;
begin
  if public.acad_level(a) < 3 then raise exception 'owner only' using errcode = '42501'; end if;
  if r not in ('athlete', 'coach', 'physio') then raise exception 'unknown role' using errcode = '22023'; end if;
  c := public.acad_free_code();
  insert into public.acad_codes (academy_id, role, code) values (a, r, c)
    on conflict (academy_id, role) do update set code = excluded.code, created_at = now();
  return c;
end $$;

create or replace function public.acad_disable_code(a uuid, r text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.acad_level(a) < 3 then raise exception 'owner only' using errcode = '42501'; end if;
  delete from public.acad_codes where academy_id = a and role = r;
end $$;

create or replace function public.acad_set_display_name(a uuid, p_display text) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.acad_members set display_name = left(btrim(coalesce(p_display, '')), 80) where id = public.acad_me(a)
$$;

create or replace function public.acad_set_member_role(a uuid, m uuid, r text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.acad_level(a) < 3 then raise exception 'owner only' using errcode = '42501'; end if;
  if r not in ('coach', 'physio') then raise exception 'staff can be coach or physio' using errcode = '22023'; end if;
  update public.acad_members set role = r where academy_id = a and id = m and role in ('coach', 'physio');
  if not found then raise exception 'not a staff member' using errcode = 'P0002'; end if;
  update public.acad_docs set data = data || jsonb_build_object('role', r) where academy_id = a and path = 'staff/' || m::text;
end $$;

-- Owner removes anyone but themself; coaches and physiotherapists remove athletes. Access ends at once.
create or replace function public.acad_remove_member(a uuid, m uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r text;
begin
  select x.role into r from public.acad_members x where x.academy_id = a and x.id = m;
  if not found then return; end if;
  if m = public.acad_me(a) then raise exception 'use delete account' using errcode = '22023'; end if;
  if not (public.acad_level(a) = 3 or (public.acad_level(a) = 2 and r = 'athlete')) then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.acad_members where id = m;
  if r in ('coach', 'physio') then delete from public.acad_docs where academy_id = a and path = 'staff/' || m::text; end if;
end $$;

-- Delete the signed-in member: an owner deletes the whole academy; others delete their own records.
create or replace function public.acad_delete_me(a uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := public.acad_me(a); r text := public.acad_role(a);
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if r = 'owner' then delete from public.acad_academies where id = a; return; end if;
  delete from public.acad_docs d where d.academy_id = a
     and ((split_part(d.path, '/', 2) = me::text and split_part(d.path, '/', 1) in ('athletes', 'logs', 'meals', 'inbox', 'staff'))
          or d.path like 'data/users/' || me::text || '/%');
  delete from public.acad_members where id = me;
end $$;

-- ---------- permissions ----------
revoke all on function public.acad_new_code(), public.acad_free_code(), public.acad_throttle() from public, anon, authenticated;
revoke all on function public.acad_norm(text), public.acad_me(uuid), public.acad_role(uuid), public.acad_level(uuid), public.acad_active(uuid),
  public.acad_can(uuid, text, boolean), public.acad_try_uuid(text), public.acad_jsonb_merge(jsonb, jsonb), public.acad_merge(uuid, text, jsonb),
  public.acad_enter(text), public.acad_join(text, text), public.acad_create_academy(text, text, text), public.acad_whoami(), public.acad_sign_out(),
  public.acad_add_member(uuid, text, text), public.acad_people(uuid), public.acad_member_names(uuid), public.acad_reset_code(uuid, uuid),
  public.acad_codes_list(uuid), public.acad_rotate_code(uuid, text), public.acad_disable_code(uuid, text), public.acad_set_display_name(uuid, text),
  public.acad_set_member_role(uuid, uuid, text), public.acad_remove_member(uuid, uuid), public.acad_delete_me(uuid)
  from public, anon;
grant execute on function public.acad_norm(text), public.acad_me(uuid), public.acad_role(uuid), public.acad_level(uuid), public.acad_active(uuid),
  public.acad_can(uuid, text, boolean), public.acad_try_uuid(text), public.acad_jsonb_merge(jsonb, jsonb), public.acad_merge(uuid, text, jsonb),
  public.acad_enter(text), public.acad_join(text, text), public.acad_create_academy(text, text, text), public.acad_whoami(), public.acad_sign_out(),
  public.acad_add_member(uuid, text, text), public.acad_people(uuid), public.acad_member_names(uuid), public.acad_reset_code(uuid, uuid),
  public.acad_codes_list(uuid), public.acad_rotate_code(uuid, text), public.acad_disable_code(uuid, text), public.acad_set_display_name(uuid, text),
  public.acad_set_member_role(uuid, uuid, text), public.acad_remove_member(uuid, uuid), public.acad_delete_me(uuid)
  to authenticated;

-- ---------- live updates and meal photos ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'acad_docs') then
    alter publication supabase_realtime add table public.acad_docs;
  end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('academy-meals', 'academy-meals', false, 1048576, array['image/jpeg'])
    on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];
    execute $p$create policy "academy meal photos read" on storage.objects for select to authenticated using (
      bucket_id = 'academy-meals'
      and public.acad_can(public.acad_try_uuid((storage.foldername(name))[1]), 'meals/' || (storage.foldername(name))[2] || '/items/photo', false))$p$;
    execute $p$create policy "academy meal photos add" on storage.objects for insert to authenticated with check (
      bucket_id = 'academy-meals'
      and public.acad_can(public.acad_try_uuid((storage.foldername(name))[1]), 'meals/' || (storage.foldername(name))[2] || '/items/photo', true))$p$;
    execute $p$create policy "academy meal photos remove" on storage.objects for delete to authenticated using (
      bucket_id = 'academy-meals'
      and public.acad_can(public.acad_try_uuid((storage.foldername(name))[1]), 'meals/' || (storage.foldername(name))[2] || '/items/photo', true))$p$;
  end if;
end $$;

notify pgrst, 'reload schema';
