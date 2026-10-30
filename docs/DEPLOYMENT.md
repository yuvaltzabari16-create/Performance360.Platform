# Deploying Performance360

Hosting: Netlify or Vercel for the Next.js app (section 2 for Vercel, section 2a for Netlify), Supabase for the database and sign-in. Follow the steps in order.
Nothing here needs code changes.

## 1. Supabase (already created: project `ioimovfpzgohjzwkshev`)

1. **Migrations.** `supabase/migrations/*.sql` have been applied to the live project, except the three
   functions that contain a `DELETE` statement. Run `supabase/manual/pending_delete_functions.sql` once in
   *SQL editor → Run* (safe to repeat). Without it the Delete account, Delete GPS session and Remove file
   buttons fail.
2. **Authentication → URL configuration.** Site URL = your production address
   (e.g. `https://app.example.com`). Redirect URLs: `https://app.example.com/auth/callback`.
3. **Authentication → Sign in / Providers → Email.** Keep *Confirm email* on. Set the minimum password length
   to 8 or more and turn on leaked-password protection.
4. **Authentication → Multi-factor.** Make sure TOTP is enabled (the app offers it in Settings → Security).
5. **Authentication → SMTP settings.** Add a real mail server (the built-in one is limited to a few emails
   per hour and is not for production). Customize the confirmation and reset email templates.
6. **Database → Backups.** Turn on daily backups (paid plans) or schedule exports, and do one test restore.
7. Run the Supabase **Security Advisor** and fix anything it lists.

## 2. Vercel

1. *Add New → Project*, import the GitHub repository, branch `main` (or the release branch).
2. Framework preset *Next.js*; build command `npm run build`; node 20 or newer.
3. Environment variables (Production):

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Publishable (anon) key |
| `NEXT_PUBLIC_SITE_URL` | yes | The production address, used in invitation and email links |
| `OPERATOR_NAME`, `OPERATOR_ADDRESS`, `OPERATOR_EMAIL`, `PRIVACY_EMAIL` | before launch | Shown on /privacy and /terms |
| `LEGAL_REVIEWED` | after legal review | `1` removes the draft notice |
| `ACCESSIBILITY_COORDINATOR`, `ACCESSIBILITY_EMAIL`, `ACCESSIBILITY_PHONE` | before launch | Israeli accessibility statement contact |
| `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` | optional | Switch on the daily notification-email job (`vercel.json` on Vercel, `netlify/functions` on Netlify). Without them the route answers 404 |
| `RESEND_API_KEY` + `MAIL_FROM` | optional | Daily email copies of notifications for people who turned them on (also needs `CRON_SECRET` and the service-role key) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | recommended | Cloudflare Turnstile on public forms |
| `BOT_GUARD_SECRET` | recommended | Random string; signs the form time-trap token |
| `PAYMENT_PLANS`, `PAYMENT_ALLOWED_HOSTS` | when selling | Hosted checkout only; see `.env.example` and section 2c |
| `BILLING_REQUIRED` | when selling | `1` closes the app for a team whose trial and subscription have ended (billing, settings and data export stay open) |
| `STRIPE_WEBHOOK_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` | when selling | Lets Stripe tell the app who paid (section 2c). Without them the webhook answers 404 |
| `BILLING_PORTAL_URL` | optional | Stripe customer portal link for "Manage subscription" |
| `NEXT_PUBLIC_GOOGLE_LOGIN` | for Google sign-in | `1` shows "Continue with Google" (after step 2b below). `NEXT_PUBLIC_PASSWORD_LOGIN=0` hides the email and password form |
| `RATE_LIMIT_*` | optional | Defaults are sensible |

   Never set `RATE_LIMIT_DISABLED` or `BOT_GUARD_MIN_MS` in production (tests only).
4. Domain: add the domain in *Settings → Domains*; HTTPS is automatic and the app redirects http to https
   and sends HSTS.
5. Note: the rate limiter keeps counters in memory per server instance. For several instances or heavy
   traffic, put the platform's firewall / rate limiting in front, or move the counters to a shared store.

### 2a. Netlify (instead of Vercel)

The repository already carries `netlify.toml` (build command, Next.js runtime, Node 22) and a scheduled function in `netlify/functions` that replaces the Vercel cron job.

1. *Add new project → Import an existing project → GitHub*, pick the repository and branch `main`. Leave the build settings as they are: they come from `netlify.toml`.
2. *Project configuration → Environment variables*: add the variables from the table in section 2 (at least the three required ones). `NEXT_PUBLIC_SITE_URL` is the Netlify address or your own domain. The `NEXT_PUBLIC_*` values are read at build time, so deploy again after changing them.
3. Supabase → *Authentication → URL configuration*: the same address as Site URL, and `<address>/auth/callback` in Redirect URLs.
4. Domain: *Domain management → Add a domain*; follow the DNS records Netlify shows.
5. The scheduled function needs `CRON_SECRET` (any long random string) and `SUPABASE_SERVICE_ROLE_KEY`. Without them they do nothing.
6. After the first deploy: `<address>/api/health` answers `ok`, then sign up and sign in once.

### 2b. Sign in with Google (Gmail accounts)

1. Google Cloud console → *APIs & Services* → *OAuth consent screen* (type External; app name, support email, your domain, privacy and terms links: `<site>/privacy`, `<site>/terms`). Publish it to *In production*; "Testing" only allows the test users you list.
2. *Credentials* → *Create credentials* → *OAuth client ID* → *Web application*. Authorised redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback` (shown in Supabase under Authentication → Providers → Google).
3. Supabase → *Authentication* → *Providers* → *Google*: enable, paste the client ID and client secret.
4. Supabase → *Authentication* → *URL Configuration*: Site URL is the production address and `<site>/auth/callback` is in the Redirect URLs.
5. Set `NEXT_PUBLIC_GOOGLE_LOGIN=1` in the host's Production variables and redeploy (the flag is read at build time).

A first Google sign-in creates the account, asks the person to accept the terms and privacy policy, then continues to onboarding where they choose their account type. Two-step verification still applies on later sign-ins.

### 2c. Monthly subscriptions for teams (Stripe)

Payment happens only on Stripe's hosted pages; the app never sees card data. Every new team gets a 14-day trial.

1. Stripe → *Product catalogue*: create the product and a recurring monthly price. Create a *Payment Link* for it (turn on "Let customers adjust..." only if you want that; allow promotion codes if you like). Copy the link.
2. Put the plans in `PAYMENT_PLANS`, for example `[{"id":"team","name":"Team","description":"Per team, per month","checkoutUrl":"https://buy.stripe.com/..."}]`, and `PAYMENT_ALLOWED_HOSTS=buy.stripe.com`. The billing page adds the team id (`client_reference_id`) and the director's email to the link, so Stripe reports which team paid.
3. Stripe → *Developers* → *Webhooks* → add endpoint `<site>/api/billing/webhook` with the events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and add `SUPABASE_SERVICE_ROLE_KEY`.
4. Stripe → *Settings* → *Billing* → *Customer portal*: turn it on and copy the login link into `BILLING_PORTAL_URL`.
5. Apply the migration `20261030130000_subscriptions.sql` on the live Supabase project, then set `BILLING_REQUIRED=1` and redeploy.
6. Test with Stripe's test mode first: pay with a test card, check the status on `/billing` changes to active, cancel in the portal, and check access closes when the period ends.

Rules the database applies: an active or trialing subscription has access; a failed payment keeps access for 7 days; a canceled or unpaid subscription, or an ended trial with no subscription, closes the team's pages except billing, settings and data export. Athletes and independent trainers (accounts without a team) are not gated.

## 3. After the first deploy

- `GET /api/health` returns `{"status":"ok","configured":true}`.
- Create the first account through the Team sign-up path and check: confirmation email arrives, sign-in
  works, two-factor setup works, `/privacy` and `/terms` show the operator details.
- Check the headers (CSP, HSTS) with an online scanner and re-run the accessibility check on the public pages.
- Add an uptime monitor on `/api/health` and error monitoring (e.g. Sentry) before real users arrive.
- Run `npm run check:licenses` after any dependency change.

## 4. Before inviting real athletes

- Legal texts reviewed by a lawyer, then `LEGAL_REVIEWED=1`.
- Israeli Privacy Protection Law: confirm with counsel whether the database must be registered and whether
  a data protection officer is required (health data is sensitive information).
- Decide how long data is kept after an account is deleted and after a club leaves.
- Parent / guardian consent is recorded in the app; make sure clubs know they must collect it first.
