# Performance360 Academy — standalone web app

One-file website (`site/index.html`) on Supabase. Everyone signs in with one personal code (8 letters and numbers); no email, password, Claude or Google account.

## Roles
| Person | How they get their personal code |
|---|---|
| Owner + Coach | Opens a new academy on the sign-in screen (30-day free trial) and is shown their code |
| Coach / Physiotherapist | The owner adds them (Staff → Add) and sends the code, or they enter the shared coach/physio join code and type their name |
| Athlete | The owner or a coach adds them (My athletes → Add athlete), or they enter the shared athlete join code |

A lost or leaked code is replaced in Settings → Access & roles; the old one stops working and that person is signed out everywhere. Each phone stays signed in after the first time.

All access rules live in Postgres (`supabase/migrations/20261102090000_academy_code_login.sql`), tested by `supabase/sql-tests/99_academy_standalone_test.sql` (`npm run test:db`).

## Set up once
1. **Database**: run the migration above in Supabase → SQL Editor.
2. **Turn on code sign-in**: Supabase → Authentication → Sign In / Providers → enable **Allow anonymous sign-ins** (each phone gets an invisible device sign-in, which the personal code links to a person). Turning on CAPTCHA there is recommended once you sell widely.
3. **Publish**: drag the `site` folder (or `performance360-academy-site.zip`) onto Netlify → Deploys. `_headers` adds the security headers.

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
