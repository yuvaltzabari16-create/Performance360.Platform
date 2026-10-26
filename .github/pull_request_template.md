## What and why

<!-- One or two sentences: the user-facing change and the reason. -->

## Checklist

- [ ] `npm run verify` passes locally (lint, types, unit, licenses, SQL tests)
- [ ] New or changed behavior has a test (unit, SQL, or e2e as fits)
- [ ] Data access: every new table has RLS enabled and policies; writes go through audited functions; SQL tests cover who can and cannot read or write
- [ ] Migration is a **new** file in `supabase/migrations` (applied migrations are never edited); statements containing `DELETE` are also listed in `supabase/manual/`
- [ ] New text exists in English **and** Hebrew; layout checked in RTL
- [ ] Permissions changed? `npm run docs:roles` was run and `docs/ROLES.md` is committed
- [ ] New environment variable? Added to `.env.example` and `docs/DEPLOYMENT.md`
- [ ] No secrets, personal data or real athlete data in code, tests or screenshots

## Screenshots / notes for the reviewer
