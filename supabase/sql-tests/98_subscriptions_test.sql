-- Team subscriptions: trial, access rule, who can read the record, and that only the service role can write it.

\set dir '''98980000-0000-0000-0000-000000000001'''
\set oth '''98980000-0000-0000-0000-000000000002'''
insert into auth.users (id, email, raw_user_meta_data) values (:dir, 'dir@sub.test', '{}'), (:oth, 'other@sub.test', '{}');

set role authenticated;
set request.jwt.claim.sub = :dir;
select public.create_organization('Paid FC', null, 'Dir Sub');
select org_id as org from public.org_billing() \gset
select tests.check((select has_access and is_director and status is null from public.org_billing()), 'a new team has access through its trial and the director is recognised');
select tests.check((select trial_ends_at > now() + interval '13 days' from public.org_billing()), 'the trial lasts about 14 days');
select tests.throws($$select public.billing_apply(null, 'cus_x', 'sub_x', 'pro', 'active', now())$$) as app_try \gset
select tests.check(:'app_try'::boolean, 'a signed-in person cannot write billing records');
select tests.throws(format($$insert into public.org_subscriptions (org_id, status) values (%L, 'active')$$, :'org')) as ins_try \gset
select tests.check(:'ins_try'::boolean, 'nobody can insert a subscription row from the app');
reset role;

-- The webhook (service role) records a paid subscription.
set role service_role;
select public.billing_apply(:'org'::uuid, 'cus_1', 'sub_1', 'pro', 'active', now() + interval '30 days') as r1 \gset
select public.billing_apply(null, 'cus_unknown', 'sub_unknown', 'pro', 'active', null) as r2 \gset
select public.billing_apply(null, 'cus_1', null, null, 'past_due', null) as r3 \gset
do $$ begin
  perform public.billing_apply(null, 'cus_1', null, null, 'bogus', null);
  raise exception 'an unknown status was accepted';
exception when sqlstate '22023' then null; end $$;
reset role;
select tests.check(:'r1' = 'applied', 'the service role records a subscription');
select tests.check(:'r2' = 'unknown_org', 'an event for a team we do not know is reported, not stored');
select tests.check(:'r3' = 'applied', 'a later event finds the team by the provider customer id');
select tests.check((select status = 'past_due' and plan_id = 'pro' and current_period_end is not null from public.org_subscriptions where org_id = :'org'), 'the update kept the plan and the period end it did not repeat');

-- Reading: members of the team see it, others do not.
set role authenticated;
set request.jwt.claim.sub = :dir;
select tests.check((select count(*) = 1 from public.org_subscriptions), 'a team member sees their own team''s subscription');
set request.jwt.claim.sub = :oth;
select tests.check((select count(*) = 0 from public.org_subscriptions), 'someone outside the team sees no subscription');
select tests.check((select count(*) = 0 from public.org_billing()), 'someone outside the team gets no billing summary');
reset role;

-- The access rule.
select tests.check(public.org_has_access(:'org'::uuid), 'a past-due payment keeps access during the 7-day grace period');
update public.org_subscriptions set current_period_end = now() - interval '10 days', updated_at = now() - interval '10 days' where org_id = :'org';
select tests.check(not public.org_has_access(:'org'::uuid), 'a payment that stayed past due for more than 7 days ends access');
update public.org_subscriptions set status = 'active', current_period_end = now() + interval '5 days' where org_id = :'org';
select tests.check(public.org_has_access(:'org'::uuid), 'an active subscription has access');
update public.org_subscriptions set status = 'canceled' where org_id = :'org';
select tests.check(not public.org_has_access(:'org'::uuid), 'a canceled subscription has no access');
delete from public.org_subscriptions where org_id = :'org';
update public.organizations set trial_ends_at = now() - interval '1 day' where id = :'org';
select tests.check(not public.org_has_access(:'org'::uuid), 'a team without a subscription and with an ended trial has no access');
