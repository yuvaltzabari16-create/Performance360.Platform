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
| `NEXT_PUBLIC_EMAIL_CODE_LOGIN` | for sign-in by email code | `1` shows "Email me a sign-in code" (after step 2b below). `NEXT_PUBLIC_PASSWORD_LOGIN=0` hides the email and password form |
| `NEXT_PUBLIC_GOOGLE_LOGIN` | optional | `1` shows "Continue with Google"; needs a Google Cloud OAuth client and the Google provider in Supabase |
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

### 2b. Sign in with an email code (no password, works with any mailbox)

The sign-in and sign-up pages can offer "Email me a sign-in code": the person types their email, receives a 6-digit one-time code and enters it. A new address creates an account when the code is entered; the person then accepts the terms and privacy policy and chooses their account type. The "Sign in as" role choice and two-step verification still apply.

1. Supabase → *Authentication* → *Emails* → *Templates*. Edit **Magic link** and **Confirm signup** so the message shows the code, for example: `Your Performance360 sign-in code is <strong>{{ .Token }}</strong>. It works once and expires in 10 minutes.` (Keep `{{ .ConfirmationURL }}` out of these two templates if you want code-only sign-in.)
2. *Authentication* → *Sign In / Providers* → *Email*: *Email OTP length* 6, *Email OTP expiration* 600 seconds.
3. *Authentication* → *SMTP settings*: a real mail service is required, because the built-in sender allows only a few emails per hour. Services such as Resend, Brevo or Postmark need the sending domain (or a verified sender) to be set up first; without it, mail only reaches your own address.
4. Set `NEXT_PUBLIC_EMAIL_CODE_LOGIN=1` in the host's Production variables and deploy again (read at build time). `NEXT_PUBLIC_PASSWORD_LOGIN=0` hides the password form.
5. Check once on the live site: the code arrives, a wrong code is rejected, a new address goes to the terms page and then to onboarding.

Google sign-in is still in the code (`NEXT_PUBLIC_GOOGLE_LOGIN=1`, needs a Google Cloud OAuth client and the Google provider in Supabase) but is off by default.

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
