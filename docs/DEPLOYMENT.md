# Deploying Performance360

Hosting: Vercel for the Next.js app, Supabase for the database and sign-in. Follow the steps in order.
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
| `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` | optional | Switch on the scheduled WHOOP sync (`vercel.json` runs it daily; Vercel's free plan allows one run a day). Without them the route answers 404 and athletes use "Sync now" |
| `RESEND_API_KEY` + `MAIL_FROM` | optional | Daily email copies of notifications for people who turned them on (also needs `CRON_SECRET` and the service-role key) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | recommended | Cloudflare Turnstile on public forms |
| `BOT_GUARD_SECRET` | recommended | Random string; signs the form time-trap token |
| `PAYMENT_PLANS`, `PAYMENT_ALLOWED_HOSTS` | when selling | Hosted checkout only; see `.env.example` |
| `WEARABLE_TOKEN_KEY` | for wearables | 32 random bytes in base64 (`openssl rand -base64 32`); encrypts stored device tokens. Do not rotate without asking athletes to reconnect |
| `WHOOP_LIVE`, `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET` | for live WHOOP, after WHOOP approves the app | Leave unset until then: athletes see "coming soon" and can still import a WHOOP export file, and the scheduled sync does nothing. Set `WHOOP_LIVE=1` once approved. Keys from the WHOOP developer dashboard; redirect URI `<site>/api/wearables/whoop/callback`; scopes `offline read:recovery read:sleep read:cycles` |
| `NEXT_PUBLIC_GOOGLE_LOGIN` | for Google sign-in | `1` shows "Continue with Google" (after step 2b below). `NEXT_PUBLIC_PASSWORD_LOGIN=0` hides the email and password form |
| `RATE_LIMIT_*` | optional | Defaults are sensible |

   Never set `WEARABLES_MOCK`, `RATE_LIMIT_DISABLED` or `BOT_GUARD_MIN_MS` in production (tests only).
4. Domain: add the domain in *Settings → Domains*; HTTPS is automatic and the app redirects http to https
   and sends HSTS.
5. Note: the rate limiter keeps counters in memory per server instance. For several instances or heavy
   traffic, put the platform's firewall / rate limiting in front, or move the counters to a shared store.

### 2b. Sign in with Google (Gmail accounts)

1. Google Cloud console → *APIs & Services* → *OAuth consent screen* (type External; app name, support email, your domain, privacy and terms links: `<site>/privacy`, `<site>/terms`). Publish it to *In production*; "Testing" only allows the test users you list.
2. *Credentials* → *Create credentials* → *OAuth client ID* → *Web application*. Authorised redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback` (shown in Supabase under Authentication → Providers → Google).
3. Supabase → *Authentication* → *Providers* → *Google*: enable, paste the client ID and client secret.
4. Supabase → *Authentication* → *URL Configuration*: Site URL is the production address and `<site>/auth/callback` is in the Redirect URLs.
5. Set `NEXT_PUBLIC_GOOGLE_LOGIN=1` in the host's Production variables and redeploy (the flag is read at build time).

A first Google sign-in creates the account, asks the person to accept the terms and privacy policy, then continues to onboarding where they choose their account type. Two-step verification still applies on later sign-ins.

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
