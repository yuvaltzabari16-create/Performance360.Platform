-- Academy payments and athlete nutrition.
--
-- Payments: the academy director tracks what each roster athlete owes and has paid (fees, camps, kit).
--   * Only directors of the academy read or change its payments. Staff and athletes do not see them.
--   * A payment belongs to an athlete on the academy's active roster.
--   * Status is derived: paid when paid_on is set, overdue when unpaid after the due date, otherwise due.
--   * Writes go through functions so every change is audited.
--
-- Nutrition: athletes log their meals (with an optional photo) and staff who work with them read the log
-- and can leave one comment per meal.
--   * The athlete adds, edits and deletes their own meals.
--   * Professionals of the athlete (personal coaches and academy staff, squad-scoped) read them and comment.
--   * The director does not see meals: it is personal health information, not running the academy.
--   * Meal photos are attachments of kind 'meal' (images only), readable by the same people as the meal.

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table public.athlete_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  description text not null check (char_length(trim(description)) between 1 and 120),
  amount numeric(10, 2) not null check (amount > 0 and amount < 1000000),
  currency text not null default 'ILS' check (currency in ('ILS', 'USD', 'EUR', 'GBP')),
  due_date date not null,
  paid_on date,
  method text check (method in ('cash', 'bank_transfer', 'card', 'app', 'cheque', 'other')),
  note text check (char_length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index athlete_payments_org_idx on public.athlete_payments (org_id, due_date desc);
create index athlete_payments_athlete_idx on public.athlete_payments (athlete_id);
alter table public.athlete_payments enable row level security;
revoke insert, update, delete on public.athlete_payments from anon, authenticated;

create policy payments_select on public.athlete_payments for select to authenticated
  using (public.is_org_director(org_id) or public.is_platform_admin());

-- The caller's academy, when the caller is its director; raises otherwise.
create or replace function public.director_org_or_fail()
returns uuid language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_org uuid := public.my_org_id();
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if v_org is null or not public.is_org_director(v_org) then raise exception 'not allowed' using errcode = '42501'; end if;
  return v_org;
end $$;

create or replace function public.on_academy_roster(p_org uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.organization_athletes where org_id = p_org and athlete_id = p_athlete and status = 'active')
$$;

create or replace function public.record_payment(
  p_athlete uuid, p_description text, p_amount numeric, p_currency text, p_due date,
  p_paid_on date default null, p_method text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid := public.director_org_or_fail();
  v_id uuid;
begin
  if not public.on_academy_roster(v_org, p_athlete) then raise exception 'athlete not on the roster' using errcode = '42501'; end if;
  insert into public.athlete_payments (org_id, athlete_id, description, amount, currency, due_date, paid_on, method, note)
  values (v_org, p_athlete, trim(p_description), p_amount, coalesce(p_currency, 'ILS'), coalesce(p_due, current_date),
          p_paid_on, case when p_paid_on is null then null else p_method end, nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;
  perform public.write_audit('payment.recorded', 'athlete_payment', v_id::text, jsonb_build_object('athlete', p_athlete, 'amount', p_amount));
  return v_id;
end $$;

-- One charge for every athlete on the active roster (for example a monthly fee). Returns how many were created.
create or replace function public.charge_roster(p_description text, p_amount numeric, p_currency text, p_due date)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid := public.director_org_or_fail();
  v_count integer;
begin
  insert into public.athlete_payments (org_id, athlete_id, description, amount, currency, due_date)
  select v_org, oa.athlete_id, trim(p_description), p_amount, coalesce(p_currency, 'ILS'), coalesce(p_due, current_date)
  from public.organization_athletes oa
  join public.athletes a on a.id = oa.athlete_id and a.status = 'active'
  where oa.org_id = v_org and oa.status = 'active';
  get diagnostics v_count = row_count;
  perform public.write_audit('payment.roster_charged', 'organization', v_org::text, jsonb_build_object('count', v_count, 'amount', p_amount));
  return v_count;
end $$;

-- Marks a payment paid (with date and method) or, with p_paid_on null, back to unpaid.
create or replace function public.set_payment_paid(p_id uuid, p_paid_on date, p_method text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid := public.director_org_or_fail();
begin
  update public.athlete_payments
     set paid_on = p_paid_on, method = case when p_paid_on is null then null else p_method end, updated_at = now()
   where id = p_id and org_id = v_org;
  if not found then raise exception 'not allowed' using errcode = '42501'; end if;
  perform public.write_audit(case when p_paid_on is null then 'payment.unpaid' else 'payment.paid' end, 'athlete_payment', p_id::text);
end $$;

create or replace function public.delete_payment(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid := public.director_org_or_fail();
begin
  delete from public.athlete_payments where id = p_id and org_id = v_org;
  if not found then raise exception 'not allowed' using errcode = '42501'; end if;
  perform public.write_audit('payment.deleted', 'athlete_payment', p_id::text);
end $$;

revoke execute on function public.director_org_or_fail(), public.on_academy_roster(uuid, uuid),
  public.record_payment(uuid, text, numeric, text, date, date, text, text), public.charge_roster(text, numeric, text, date),
  public.set_payment_paid(uuid, date, text), public.delete_payment(uuid) from public, anon;
grant execute on function public.record_payment(uuid, text, numeric, text, date, date, text, text), public.charge_roster(text, numeric, text, date),
  public.set_payment_paid(uuid, date, text), public.delete_payment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Nutrition
-- ---------------------------------------------------------------------------
create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on delete cascade,
  eaten_on date not null default current_date,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'pre_training', 'post_training')),
  description text not null check (char_length(trim(description)) between 1 and 1000),
  calories integer check (calories between 0 and 10000),
  protein_g numeric(6, 1) check (protein_g between 0 and 1000),
  carbs_g numeric(6, 1) check (carbs_g between 0 and 2000),
  fat_g numeric(6, 1) check (fat_g between 0 and 1000),
  water_ml integer check (water_ml between 0 and 10000),
  photo_id uuid references public.attachments (id) on delete set null,
  coach_comment text check (char_length(coach_comment) <= 1000),
  commented_by uuid references auth.users (id) on delete set null,
  commented_at timestamptz,
  created_at timestamptz not null default now()
);
create index meal_logs_athlete_idx on public.meal_logs (athlete_id, eaten_on desc);
alter table public.meal_logs enable row level security;
revoke update on public.meal_logs from anon, authenticated;
grant update (eaten_on, meal_type, description, calories, protein_g, carbs_g, fat_g, water_ml) on public.meal_logs to authenticated;

create policy meals_select on public.meal_logs for select to authenticated
  using (public.is_own_athlete_record(athlete_id) or public.is_athlete_professional(athlete_id) or public.is_platform_admin());
create policy meals_insert on public.meal_logs for insert to authenticated
  with check (public.is_own_athlete_record(athlete_id) and photo_id is null and coach_comment is null);
create policy meals_update on public.meal_logs for update to authenticated
  using (public.is_own_athlete_record(athlete_id)) with check (public.is_own_athlete_record(athlete_id));
create policy meals_delete on public.meal_logs for delete to authenticated
  using (public.is_own_athlete_record(athlete_id));

-- Staff who work with the athlete leave (or clear, with an empty text) a comment on a meal.
create or replace function public.comment_on_meal(p_meal uuid, p_comment text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_athlete uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select athlete_id into v_athlete from public.meal_logs where id = p_meal;
  if v_athlete is null or not public.is_athlete_professional(v_athlete) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.meal_logs
     set coach_comment = nullif(trim(coalesce(p_comment, '')), ''),
         commented_by = case when nullif(trim(coalesce(p_comment, '')), '') is null then null else auth.uid() end,
         commented_at = case when nullif(trim(coalesce(p_comment, '')), '') is null then null else now() end
   where id = p_meal;
end $$;

-- The athlete sets (or clears) the photo of their own meal; the photo must be a 'meal' file of that meal.
create or replace function public.set_meal_photo(p_meal uuid, p_attachment uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.meal_logs m where m.id = p_meal and public.is_own_athlete_record(m.athlete_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_attachment is not null and not exists (select 1 from public.attachments where id = p_attachment and kind = 'meal' and ref_id = p_meal) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.meal_logs set photo_id = p_attachment where id = p_meal;
end $$;

-- Meal photos are removed with their meal.
create or replace function public.meal_logs_after_delete()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.attachments where kind = 'meal' and ref_id = old.id;
  return old;
end $$;
create trigger meal_logs_after_delete after delete on public.meal_logs for each row execute function public.meal_logs_after_delete();

revoke execute on function public.comment_on_meal(uuid, text), public.set_meal_photo(uuid, uuid), public.meal_logs_after_delete() from public, anon;
grant execute on function public.comment_on_meal(uuid, text), public.set_meal_photo(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Meal photos as attachments
-- ---------------------------------------------------------------------------
alter table public.attachments drop constraint attachments_kind_check;
alter table public.attachments add constraint attachments_kind_check
  check (kind in ('message', 'injury', 'gps', 'test', 'athlete', 'training', 'meal'));

create or replace function public.can_view_attachment(p_kind text, p_ref uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select case p_kind
    when 'message' then exists (select 1 from public.direct_messages m where m.id = p_ref and auth.uid() in (m.sender_id, m.recipient_id))
    when 'injury' then exists (select 1 from public.injuries i where i.id = p_ref
                               and (public.can_access_athlete(i.athlete_id) or public.director_sees_athlete(i.athlete_id)))
    when 'gps' then public.can_view_gps_session(p_ref)
    when 'training' then public.can_view_program(p_ref)
    when 'meal' then exists (select 1 from public.meal_logs m where m.id = p_ref
                             and (public.is_own_athlete_record(m.athlete_id) or public.is_athlete_professional(m.athlete_id)))
    else p_athlete is not null and (public.can_access_athlete(p_athlete) or public.director_sees_athlete(p_athlete))
  end
$$;

create or replace function public.can_attach(p_kind text, p_ref uuid, p_athlete uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select case p_kind
    when 'message' then exists (select 1 from public.direct_messages m where m.id = p_ref and m.sender_id = auth.uid())
    when 'injury' then exists (select 1 from public.injuries i where i.id = p_ref
                               and (public.is_athlete_professional(i.athlete_id) or public.is_own_athlete_record(i.athlete_id)))
    when 'gps' then exists (select 1 from public.gps_sessions g where g.id = p_ref and g.owner_id = auth.uid())
    when 'training' then public.owns_program(p_ref)
    when 'test' then p_athlete is not null and public.is_athlete_professional(p_athlete)
    when 'athlete' then p_athlete is not null and (public.is_athlete_professional(p_athlete) or public.is_own_athlete_record(p_athlete))
    when 'meal' then exists (select 1 from public.meal_logs m where m.id = p_ref and public.is_own_athlete_record(m.athlete_id))
    else false
  end
$$;

create or replace function public.add_attachment(p_kind text, p_ref uuid, p_athlete uuid, p_name text, p_data bytea)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '[\\/:*?"<>|\x00-\x1f]', '_', 'g');
  v_ext text := lower(substring(v_name from '\.([A-Za-z0-9]+)$'));
  v_mime text;
  v_athlete uuid := p_athlete;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_kind = 'injury' then select athlete_id into v_athlete from public.injuries where id = p_ref; end if;
  if p_kind = 'meal' then select athlete_id into v_athlete from public.meal_logs where id = p_ref; end if;
  if not public.can_attach(p_kind, p_ref, v_athlete) then raise exception 'not allowed' using errcode = '42501'; end if;
  v_mime := case v_ext
    when 'pdf' then 'application/pdf' when 'png' then 'image/png' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg'
    when 'webp' then 'image/webp' when 'gif' then 'image/gif' when 'csv' then 'text/csv' when 'txt' then 'text/plain'
    when 'doc' then 'application/msword' when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    when 'xls' then 'application/vnd.ms-excel' when 'xlsx' then 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    when 'ppt' then 'application/vnd.ms-powerpoint' when 'pptx' then 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    else null end;
  if v_mime is null then raise exception 'file type not allowed'; end if;
  if p_kind = 'meal' and v_mime not in ('image/png', 'image/jpeg', 'image/webp') then raise exception 'file type not allowed'; end if;
  if p_data is null or octet_length(p_data) not between 1 and 5242880 then raise exception 'file size not allowed'; end if;
  insert into public.attachments (kind, ref_id, athlete_id, file_name, mime_type, size_bytes, data)
  values (p_kind, p_ref, case when p_kind in ('message', 'gps', 'training') then null else v_athlete end,
          left(v_name, 200), v_mime, octet_length(p_data), p_data)
  returning id into v_id;
  perform public.write_audit('attachment.added', 'attachment', v_id::text, jsonb_build_object('kind', p_kind));
  return v_id;
end $$;
