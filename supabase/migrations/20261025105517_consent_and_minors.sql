-- Consent: terms and privacy acceptance on the account, and parent / guardian consent for minors.
--
--   * profiles.terms_version / terms_accepted_at record which version of the terms and privacy policy
--     the person accepted and when. They are filled when the account is created (sign-up form) and are
--     not user-writable afterwards.
--   * athletes gets the guardian's name and contact, when consent was given and by whom it was recorded
--     (a staff member, or the athlete declaring it). An athlete under 18 without recorded consent is
--     flagged in the app.

alter table public.profiles
  add column terms_version text,
  add column terms_accepted_at timestamptz;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_terms text := nullif(left(new.raw_user_meta_data ->> 'terms_version', 20), '');
begin
  insert into public.profiles (id, email, full_name, locale, terms_version, terms_accepted_at)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'locale' = 'he' then 'he' else 'en' end,
    v_terms,
    case when v_terms is not null then now() end
  )
  on conflict (id) do nothing;
  return new;
end $$;

alter table public.athletes
  add column guardian_name text check (guardian_name is null or char_length(guardian_name) <= 120),
  add column guardian_contact text check (guardian_contact is null or char_length(guardian_contact) <= 200),
  add column guardian_consent_at timestamptz,
  add column guardian_consent_source text check (guardian_consent_source in ('staff_recorded', 'athlete_declared')),
  add constraint athletes_guardian_consent_complete check (
    (guardian_consent_at is null) = (guardian_consent_source is null));

notify pgrst, 'reload schema';
