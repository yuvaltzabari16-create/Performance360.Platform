-- Personal preferences that follow the person across devices: phone, job title, week start, time format and
-- the page to open after sign-in. Stored as one small validated JSON object on the person's own profile row.

alter table public.profiles add column preferences jsonb not null default '{}'::jsonb;
alter table public.profiles add constraint profiles_preferences_shape
  check (jsonb_typeof(preferences) = 'object' and pg_column_size(preferences) < 2000);

grant update (preferences) on public.profiles to authenticated;

notify pgrst, 'reload schema';
