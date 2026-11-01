-- Performance360 Academy, standalone edition (sign-in with an emailed one-time code; no Claude account).
-- Each academy is an isolated document store. Who may read or write each document is decided here, in
-- Postgres, from the member's role in that academy:
--   owner (owner + coach) > coach = physiotherapist > athlete
-- An athlete only ever reaches documents under their own id; staff reach every athlete in their academy;
-- payments and the owner's private documents are owner-only. Sign-in codes are checked on the server.

-- ---------- tables ----------
create table public.acad_academies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  owner_id uuid not null references auth.users (id) on delete cascade,
  plan text not null default 'trial' check (plan in ('trial', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz not null default now() + interval '30 days',
  paid_until timestamptz,
  created_at timestamptz not null default now()
);
create index acad_academies_owner_idx on public.acad_academies (owner_id);

create table public.acad_members (
  academy_id uuid not null references public.acad_academies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'coach', 'physio', 'athlete')),
  display_name text not null default '' check (char_length(display_name) <= 80),
  joined_at timestamptz not null default now(),
  primary key (academy_id, user_id)
);
create index acad_members_user_idx on public.acad_members (user_id);

create table public.acad_codes (
  academy_id uuid not null references public.acad_academies (id) on delete cascade,
  role text not null check (role in ('athlete', 'coach', 'physio')),
  code text not null unique check (code ~ '^[A-Z0-9]{8,12}$'),
  created_at timestamptz not null default now(),
  primary key (academy_id, role)
);

create table public.acad_join_attempts (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index acad_join_attempts_idx on public.acad_join_attempts (user_id, at);

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
alter table public.acad_codes enable row level security;
alter table public.acad_join_attempts enable row level security;
alter table public.acad_docs enable row level security;

-- ---------- access helpers ----------
create or replace function public.acad_role(a uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select m.role from public.acad_members m where m.academy_id = a and m.user_id = auth.uid()
$$;

create or replace function public.acad_level(a uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select case public.acad_role(a) when 'owner' then 3 when 'coach' then 2 when 'physio' then 2 when 'athlete' then 1 else 0 end
$$;

-- An academy can be changed while its trial runs or its subscription is paid. Reading always works,
-- so an academy whose subscription lapsed can still see and export its records.
create or replace function public.acad_active(a uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select (x.plan = 'trial' and x.trial_ends_at > now())
                       or (x.plan = 'active' and (x.paid_until is null or x.paid_until > now()))
                     from public.acad_academies x where x.id = a), false)
$$;

-- The rule table. Levels: 1 athlete, 2 coach/physio, 3 owner. "Own" documents are those whose second
-- path segment is the viewer's id (athletes/<id>, meals/<id>/items/<meal> ...); for those the
-- more generous of the two levels applies.
create or replace function public.acad_can(a uuid, p text, w boolean) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  lvl int := public.acad_level(a);
  me text := auth.uid()::text;
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
    when 'data' then
      -- data/users/<id>/... is private to that person, even from the owner
      return s[2] = 'users' and s[3] = me;
    else pr := 2; pw := 3;
  end case;
  if sr is not null and s[2] = me then
    return lvl >= least(case when w then pw else pr end, case when w then sw else sr end);
  end if;
  return lvl >= case when w then pw else pr end;
end $$;

create or replace function public.acad_try_uuid(t text) returns uuid
language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

-- ---------- document policies ----------
create policy acad_docs_read on public.acad_docs for select to authenticated
  using (public.acad_can(academy_id, path, false));
create policy acad_docs_insert on public.acad_docs for insert to authenticated
  with check (public.acad_can(academy_id, path, true));
create policy acad_docs_update on public.acad_docs for update to authenticated
  using (public.acad_can(academy_id, path, true)) with check (public.acad_can(academy_id, path, true));
create policy acad_docs_delete on public.acad_docs for delete to authenticated
  using (public.acad_can(academy_id, path, true));

create or replace function public.acad_docs_stamp() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger acad_docs_stamp before insert or update on public.acad_docs
  for each row execute function public.acad_docs_stamp();

revoke all on public.acad_academies, public.acad_members, public.acad_codes, public.acad_join_attempts, public.acad_docs from anon, authenticated;
grant select, delete on public.acad_docs to authenticated;
grant insert (academy_id, path, data) on public.acad_docs to authenticated;
grant update (academy_id, path, data) on public.acad_docs to authenticated;

-- Deep merge used by partial updates: nested objects merge, a null value removes the key.
create or replace function public.acad_jsonb_merge(a jsonb, b jsonb) returns jsonb
language plpgsql immutable as $$
declare k text; v jsonb; r jsonb := coalesce(a, '{}'::jsonb);
begin
  for k, v in select * from jsonb_each(coalesce(b, '{}'::jsonb)) loop
    if v = 'null'::jsonb then
      r := r - k;
    elsif jsonb_typeof(v) = 'object' and jsonb_typeof(r -> k) = 'object' then
      r := jsonb_set(r, array[k], public.acad_jsonb_merge(r -> k, v));
    elsif jsonb_typeof(v) = 'object' then
      r := jsonb_set(r, array[k], jsonb_strip_nulls(v));
    else
      r := jsonb_set(r, array[k], v);
    end if;
  end loop;
  return r;
end $$;

-- Partial update of one document. Runs as the caller, so the update policy applies; a document the
-- caller may not change, or that does not exist, raises P0002.
create or replace function public.acad_merge(a uuid, p text, patch jsonb) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if patch is null or jsonb_typeof(patch) <> 'object' then
    raise exception 'patch must be an object' using errcode = '22023';
  end if;
  update public.acad_docs set data = public.acad_jsonb_merge(data, patch) where academy_id = a and path = p;
  if not found then raise exception 'document not found' using errcode = 'P0002'; end if;
end $$;

-- ---------- codes ----------
create or replace function public.acad_new_code() returns text
language plpgsql volatile set search_path = public, pg_temp as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea := decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex');
  out text := '';
begin
  for i in 0..9 loop
    out := out || substr(alphabet, (get_byte(b, i * 3) % 31) + 1, 1);
  end loop;
  return out;
end $$;

create or replace function public.acad_set_code(a uuid, r text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare c text;
begin
  loop
    c := public.acad_new_code();
    begin
      insert into public.acad_codes (academy_id, role, code) values (a, r, c)
        on conflict (academy_id, role) do update set code = excluded.code, created_at = now();
      return c;
    exception when unique_violation then
      -- the same code exists in another academy; draw again
    end;
  end loop;
end $$;
revoke all on function public.acad_set_code(uuid, text) from public, anon, authenticated;

-- ---------- what the signed-in person belongs to ----------
create or replace function public.acad_my_academies()
returns table (id uuid, name text, role text, display_name text, plan text, trial_ends_at timestamptz, paid_until timestamptz, active boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select x.id, x.name, m.role, m.display_name, x.plan, x.trial_ends_at, x.paid_until, public.acad_active(x.id)
    from public.acad_members m join public.acad_academies x on x.id = m.academy_id
   where m.user_id = auth.uid()
   order by m.joined_at
$$;

-- ---------- open a new academy (owner) ----------
create or replace function public.acad_create_academy(p_name text, p_display text, p_sport text default '')
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); aid uuid; nm text := btrim(coalesce(p_name, '')); dn text := left(btrim(coalesce(p_display, '')), 80);
begin
  if uid is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if char_length(nm) < 2 or char_length(nm) > 80 then raise exception 'academy name must be 2 to 80 characters' using errcode = '22023'; end if;
  if (select count(*) from public.acad_academies where owner_id = uid) >= 3 then
    raise exception 'too_many_academies' using errcode = 'P0001';
  end if;
  insert into public.acad_academies (name, owner_id) values (nm, uid) returning id into aid;
  insert into public.acad_members (academy_id, user_id, role, display_name) values (aid, uid, 'owner', dn);
  perform public.acad_set_code(aid, 'athlete');
  perform public.acad_set_code(aid, 'coach');
  perform public.acad_set_code(aid, 'physio');
  insert into public.acad_docs (academy_id, path, data) values
    (aid, 'academy/settings', jsonb_build_object('name', nm, 'sport', left(coalesce(p_sport, ''), 40), 'currency', 'ILS',
      'weekStart', 'sun', 'timezone', 'Asia/Jerusalem', 'defaultMinutes', 60, 'groups', '[]'::jsonb, 'mealComments', true, 'retentionMonths', 24)),
    (aid, 'staff/' || uid::text, jsonb_build_object('name', dn, 'role', 'coach', 'owner', true, 'title', 'Head coach', 'joined', now()));
  return aid;
end $$;

-- ---------- join with a role code (athlete, coach, physiotherapist) ----------
create or replace function public.acad_join(p_code text, p_display text)
returns table (academy_id uuid, role text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  dn text := left(btrim(coalesce(p_display, '')), 80);
  hit record; cur text;
begin
  if uid is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if (select count(*) from public.acad_join_attempts j where j.user_id = uid and j.at > now() - interval '15 minutes') >= 8 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  insert into public.acad_join_attempts (user_id) values (uid);
  select k.academy_id as aid, k.role as r into hit from public.acad_codes k where k.code = c;
  -- a wrong code returns no rows (not an error) so the attempt above is kept and counts toward the limit
  if not found then return; end if;
  if not public.acad_active(hit.aid) then raise exception 'academy_inactive' using errcode = 'P0001'; end if;
  select m.role into cur from public.acad_members m where m.academy_id = hit.aid and m.user_id = uid;
  if found then
    if cur = hit.r then academy_id := hit.aid; role := cur; return next; return; end if;
    raise exception 'already_member_%', cur using errcode = 'P0001';
  end if;
  insert into public.acad_members (academy_id, user_id, role, display_name) values (hit.aid, uid, hit.r, dn);
  if hit.r in ('coach', 'physio') then
    insert into public.acad_docs (academy_id, path, data)
    values (hit.aid, 'staff/' || uid::text, jsonb_build_object('name', dn, 'role', hit.r, 'joined', now(),
            'agreed', jsonb_build_object('at', now())))
    on conflict on constraint acad_docs_pkey do update set data = public.acad_jsonb_merge(public.acad_docs.data, excluded.data);
  end if;
  delete from public.acad_join_attempts j where j.user_id = uid and j.at < now() - interval '1 day';
  academy_id := hit.aid; role := hit.r; return next;
end $$;

-- ---------- codes for the settings page ----------
create or replace function public.acad_codes_list(a uuid) returns table (role text, code text)
language sql stable security definer set search_path = public, pg_temp as $$
  select k.role, k.code from public.acad_codes k
   where k.academy_id = a
     and (public.acad_level(a) = 3 or (public.acad_level(a) = 2 and k.role = 'athlete'))
   order by array_position(array['athlete', 'coach', 'physio'], k.role)
$$;

create or replace function public.acad_rotate_code(a uuid, r text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.acad_level(a) < 3 then raise exception 'owner only' using errcode = '42501'; end if;
  if r not in ('athlete', 'coach', 'physio') then raise exception 'unknown role' using errcode = '22023'; end if;
  return public.acad_set_code(a, r);
end $$;

create or replace function public.acad_disable_code(a uuid, r text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.acad_level(a) < 3 then raise exception 'owner only' using errcode = '42501'; end if;
  delete from public.acad_codes where academy_id = a and role = r;
end $$;

-- ---------- members ----------
create or replace function public.acad_member_names(a uuid) returns table (user_id uuid, role text, display_name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.user_id, m.role, m.display_name from public.acad_members m
   where m.academy_id = a
     and (public.acad_level(a) >= 2 or m.user_id = auth.uid() or m.role <> 'athlete')
$$;

create or replace function public.acad_set_display_name(a uuid, p_display text) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.acad_members set display_name = left(btrim(coalesce(p_display, '')), 80)
   where academy_id = a and user_id = auth.uid()
$$;

create or replace function public.acad_set_member_role(a uuid, u uuid, r text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.acad_level(a) < 3 then raise exception 'owner only' using errcode = '42501'; end if;
  if r not in ('coach', 'physio') then raise exception 'staff can be coach or physio' using errcode = '22023'; end if;
  update public.acad_members set role = r where academy_id = a and user_id = u and role in ('coach', 'physio');
  if not found then raise exception 'not a staff member' using errcode = 'P0002'; end if;
  update public.acad_docs set data = data || jsonb_build_object('role', r) where academy_id = a and path = 'staff/' || u::text;
end $$;

-- Owner removes anyone but themself; coaches and physiotherapists may remove athletes.
create or replace function public.acad_remove_member(a uuid, u uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r text;
begin
  select m.role into r from public.acad_members m where m.academy_id = a and m.user_id = u;
  if not found then return; end if;
  if u = auth.uid() then raise exception 'use leave or delete account' using errcode = '22023'; end if;
  if not (public.acad_level(a) = 3 or (public.acad_level(a) = 2 and r = 'athlete')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.acad_members where academy_id = a and user_id = u;
  if r in ('coach', 'physio') then delete from public.acad_docs where academy_id = a and path = 'staff/' || u::text; end if;
end $$;

-- Delete the signed-in account: academies they own (with all their records), their own records in
-- other academies, their memberships, and the sign-in itself.
create or replace function public.acad_delete_my_account() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); me text := auth.uid()::text;
begin
  if uid is null then raise exception 'sign in first' using errcode = '28000'; end if;
  delete from public.acad_academies where owner_id = uid;
  delete from public.acad_docs d
   using public.acad_members m
   where m.user_id = uid and d.academy_id = m.academy_id
     and (split_part(d.path, '/', 2) = me and split_part(d.path, '/', 1) in ('athletes', 'logs', 'meals', 'inbox', 'staff')
          or d.path like 'data/users/' || me || '/%');
  delete from public.acad_members where user_id = uid;
  delete from public.acad_join_attempts where user_id = uid;
  delete from auth.users where id = uid;
end $$;

create or replace function public.acad_delete_academy(a uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.acad_level(a) < 3 then raise exception 'owner only' using errcode = '42501'; end if;
  delete from public.acad_academies where id = a;
end $$;

revoke all on function public.acad_role(uuid), public.acad_level(uuid), public.acad_active(uuid), public.acad_can(uuid, text, boolean),
  public.acad_my_academies(), public.acad_create_academy(text, text, text), public.acad_join(text, text), public.acad_codes_list(uuid),
  public.acad_rotate_code(uuid, text), public.acad_disable_code(uuid, text), public.acad_member_names(uuid), public.acad_set_display_name(uuid, text),
  public.acad_set_member_role(uuid, uuid, text), public.acad_remove_member(uuid, uuid), public.acad_delete_my_account(), public.acad_delete_academy(uuid),
  public.acad_merge(uuid, text, jsonb), public.acad_new_code()
  from public, anon;
grant execute on function public.acad_role(uuid), public.acad_level(uuid), public.acad_active(uuid), public.acad_can(uuid, text, boolean),
  public.acad_my_academies(), public.acad_create_academy(text, text, text), public.acad_join(text, text), public.acad_codes_list(uuid),
  public.acad_rotate_code(uuid, text), public.acad_disable_code(uuid, text), public.acad_member_names(uuid), public.acad_set_display_name(uuid, text),
  public.acad_set_member_role(uuid, uuid, text), public.acad_remove_member(uuid, uuid), public.acad_delete_my_account(), public.acad_delete_academy(uuid),
  public.acad_merge(uuid, text, jsonb), public.acad_jsonb_merge(jsonb, jsonb), public.acad_try_uuid(text)
  to authenticated;

-- ---------- live updates ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.acad_docs;
  end if;
end $$;

-- ---------- meal photos (private storage) ----------
-- Files live at academy-meals/<academy id>/<athlete id>/<meal id>.jpg and follow the same rule as the
-- meal documents: the athlete and the academy's staff can see them, nobody else.
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
