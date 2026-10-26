-- Terms acceptance on the account and guardian consent fields.

\set u1 '''cccc0000-0000-0000-0000-000000000001'''
\set u2 '''cccc0000-0000-0000-0000-000000000002'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:u1, 'accepted@consent.test', '{"terms_version": "2026-10"}'),
  (:u2, 'plain@consent.test', '{}');

select tests.check((select terms_version from public.profiles where id = :u1) = '2026-10', 'the accepted terms version is stored on the profile');
select tests.check((select terms_accepted_at is not null from public.profiles where id = :u1), 'the acceptance time is stored');
select tests.check((select terms_accepted_at is null and terms_version is null from public.profiles where id = :u2), 'no acceptance is recorded when none was given');

set role authenticated;
set request.jwt.claim.sub = :u1;
select tests.throws($$update public.profiles set terms_version = 'x' where id = auth.uid()$$) as edit_terms \gset
select tests.check(:'edit_terms'::boolean, 'users cannot rewrite their own acceptance record');
select public.complete_onboarding('personal_trainer', 'Consent Trainer');
\set aid '''cccc0000-0000-0000-0000-0000000000a1'''
insert into public.athletes (id, owner_coach_id, full_name, date_of_birth) values (:aid, :u1, 'Minor Athlete', '2014-05-05');
select tests.throws(format($$update public.athletes set guardian_consent_at = now() where id = %L$$, :'aid')) as half \gset
select tests.check(:'half'::boolean, 'consent time and source must be recorded together');
update public.athletes set guardian_name = 'Parent One', guardian_contact = '050-0000000', guardian_consent_at = now(), guardian_consent_source = 'staff_recorded' where id = :aid;
select tests.check((select guardian_consent_source from public.athletes where id = :aid) = 'staff_recorded', 'guardian consent is stored with its source');
select tests.throws(format($$update public.athletes set guardian_consent_source = 'robot' where id = %L$$, :'aid')) as bad_src \gset
select tests.check(:'bad_src'::boolean, 'unknown consent sources are rejected');
reset role;
