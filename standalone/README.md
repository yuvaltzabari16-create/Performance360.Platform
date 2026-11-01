# Performance360 Academy — standalone web app

One-file website (`site/index.html`) on Supabase. Everyone signs in with their email and a one-time code; no Claude, Google or password.

## Roles
| Sign-in | How someone gets it |
|---|---|
| Owner + Coach | Opens a new academy from the sign-in screen (30-day free trial) |
| Coach | Coach code from the owner (Settings → Access & roles) |
| Physiotherapist | Physiotherapist code from the owner |
| Athlete | Athlete code from the owner or any coach |

All access rules live in Postgres (`supabase/migrations/20261101120000_academy_standalone.sql`), tested by `supabase/sql-tests/99_academy_standalone_test.sql` (`npm run test:db`).

## Set up once
1. **Database**: run the migration above in Supabase → SQL Editor.
2. **Email codes**: Supabase → Authentication → Email Templates. In both **Magic Link** and **Confirm signup**, put the code in the message, e.g. `Your Performance360 sign-in code: {{ .Token }}`.
3. **Email sending** (needed before selling): Authentication → SMTP Settings → connect your own email provider (Resend, Postmark, SendGrid...). Supabase's built-in sender only allows a few emails per hour.
4. **Publish**: drag the `site` folder (or `performance360-academy-site.zip`) onto Netlify → Deploys. `_headers` adds the security headers.

## Selling: subscriptions
New academies get 30 days free. When a trial ends, records become read-only until you mark the academy as paid (SQL Editor):
```sql
-- see all academies
select id, name, plan, trial_ends_at, paid_until, created_at from public.acad_academies order by created_at desc;
-- an academy paid for one year
update public.acad_academies set plan = 'active', paid_until = now() + interval '1 year' where name = 'Academy name';
```

## Configuration
The `P360_CONFIG` block at the top of `site/index.html`: Supabase address and public key, `supportEmail` (shown on trial and subscription notices and in the Terms), `vendorName` (your business name in the Terms), `siteUrl`.

## Build
`python3 standalone/src/build.py standalone/site/index.html standalone/src/config.json` (after `npm install`). `MOCK=1` builds a test copy against an in-memory backend.
