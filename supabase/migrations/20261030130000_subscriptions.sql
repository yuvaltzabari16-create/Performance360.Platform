-- Subscriptions for teams (organizations). Payment itself happens on the payment provider's hosted page; this only
-- records what the provider tells the server through a signed webhook.
--
--   * organizations.trial_ends_at: every team starts with a 14-day trial (existing teams get 14 days from now).
--   * org_subscriptions: one row per team with the provider ids, the status and the end of the paid period.
--     Team members can read their own team's row; nobody can write it from the app. Only the service role,
--     through billing_apply(), which the webhook route calls after checking the provider's signature.
--   * org_has_access(): the single rule for "may this team use the app": an active or trialing subscription,
--     a failed payment within a 7-day grace period, or no subscription yet and the trial still running.
--   * org_billing(): what the billing page shows the signed-in team member.

alter table public.organizations add column trial_ends_at timestamptz not null default now() + interval '14 days';

create table public.org_subscriptions (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  provider text not null default 'stripe' check (provider in ('stripe')),
  customer_id text check (char_length(customer_id) <= 100),
  subscription_id text check (char_length(subscription_id) <= 100),
  plan_id text check (char_length(plan_id) <= 100),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'paused')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
create index org_subscriptions_customer_idx on public.org_subscriptions (customer_id);
create index org_subscriptions_subscription_idx on public.org_subscriptions (subscription_id);

alter table public.org_subscriptions enable row level security;
revoke all on public.org_subscriptions from anon, authenticated;
grant select on public.org_subscriptions to authenticated;
create policy org_subscriptions_select on public.org_subscriptions for select to authenticated using (org_id = public.my_org_id());

create or replace function public.org_has_access(p_org uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when s.org_id is not null then
      s.status in ('active', 'trialing')
      or (s.status = 'past_due' and coalesce(s.current_period_end, s.updated_at) + interval '7 days' > now())
    else now() < o.trial_ends_at
  end
  from public.organizations o
  left join public.org_subscriptions s on s.org_id = o.id
  where o.id = p_org
$$;
revoke execute on function public.org_has_access(uuid) from public, anon;
grant execute on function public.org_has_access(uuid) to authenticated, service_role;

create or replace function public.org_billing()
returns table (org_id uuid, org_name text, trial_ends_at timestamptz, status text, plan_id text, current_period_end timestamptz, has_access boolean, is_director boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select o.id, o.name, o.trial_ends_at, s.status, s.plan_id, s.current_period_end,
         coalesce(public.org_has_access(o.id), false), public.is_org_director(o.id)
    from public.organizations o
    left join public.org_subscriptions s on s.org_id = o.id
   where o.id = public.my_org_id()
$$;
revoke execute on function public.org_billing() from public, anon;
grant execute on function public.org_billing() to authenticated;

-- Called only by the webhook route (service role). The team is found by id when the checkout carries it, otherwise
-- by the provider's customer or subscription id saved earlier. Returns 'applied' or 'unknown_org'.
create or replace function public.billing_apply(
  p_org uuid, p_customer text, p_subscription text, p_plan text, p_status text, p_period_end timestamptz)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_org uuid := p_org;
begin
  if p_status not in ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'paused') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  if v_org is null and p_subscription is not null then
    select org_id into v_org from public.org_subscriptions where subscription_id = p_subscription;
  end if;
  if v_org is null and p_customer is not null then
    select org_id into v_org from public.org_subscriptions where customer_id = p_customer;
  end if;
  if v_org is null or not exists (select 1 from public.organizations where id = v_org) then return 'unknown_org'; end if;
  insert into public.org_subscriptions (org_id, customer_id, subscription_id, plan_id, status, current_period_end, updated_at)
  values (v_org, p_customer, p_subscription, p_plan, p_status, p_period_end, now())
  on conflict (org_id) do update set
    customer_id = coalesce(excluded.customer_id, org_subscriptions.customer_id),
    subscription_id = coalesce(excluded.subscription_id, org_subscriptions.subscription_id),
    plan_id = coalesce(excluded.plan_id, org_subscriptions.plan_id),
    status = excluded.status,
    current_period_end = coalesce(excluded.current_period_end, org_subscriptions.current_period_end),
    updated_at = now();
  return 'applied';
end $$;
revoke execute on function public.billing_apply(uuid, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.billing_apply(uuid, text, text, text, text, timestamptz) to service_role;

notify pgrst, 'reload schema';
