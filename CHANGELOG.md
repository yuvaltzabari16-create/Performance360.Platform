# Changelog

All notable changes, newest first. Format: [Keep a Changelog](https://keepachangelog.com), grouped by theme.
The product has not been released publicly yet, so everything is under *Unreleased*.

## Unreleased

### Removed
- **Wearables**: the Wearables page and menu entry, WHOOP connection and mock, Fitbit / WHOOP file import, the daily WHOOP sync, the wearables card on the athlete page, the wearables CSV export, the assistant's recovery questions and the privacy-policy text about them are gone (ADR 0007). GPS import is unchanged. The database tables stay in place, unused, so no stored data is deleted.

### Changed
- **Live WHOOP is paused** until WHOOP responds to the developer application: the connect button is replaced by a "coming soon" note and the scheduled sync does nothing, even if keys are present, until `WHOOP_LIVE=1` is set. Importing a WHOOP or Fitbit export file is unaffected.
- **No outside AI service.** The workout generator and the chat assistant now run entirely inside the app. "Auto-build session" picks exercises from your own library by focus, region, level, equipment and injury area (English and Hebrew requests, "Another version" for variety) and prescribes sets, reps, rest and RPE from fixed templates. The assistant answers from a hand-written, role-specific knowledge base in English and Hebrew, declines to diagnose or clear anyone, and says plainly when it has no answer. `ANTHROPIC_API_KEY`, `AI_*` settings and the mock provider are gone; nothing you type leaves the app.
- **Assistant answers from your data.** Ask "show my workload / readiness / injuries / recovery" or "how am I doing" (athletes), or "who is at risk", "who has not checked in today", "which athletes have a high workload", "who is injured" (staff). Answers use the app's own thresholds and the rows the person's database permissions already allow (squad-scoped for coaches, wearables only when shared), say when there isn't enough data, and never diagnose or clear anyone.

### Added
- **Ready for Netlify**: `netlify.toml` plus two scheduled functions (`netlify/functions`) that run the daily notification-email and WHOOP jobs, and a Netlify setup section in docs/DEPLOYMENT.md.
- **Team subscriptions**: every team starts with a 14-day trial; payment happens on the payment provider's hosted page (Stripe Payment Link); a signed webhook records the subscription; the billing page shows the plan status and, for the director, the plans and a manage link. With `BILLING_REQUIRED=1`, a team whose trial and subscription ended can only open billing, settings and the data export. Setup in docs/DEPLOYMENT.md section 2c.
- **Sign in with Google**: a "Continue with Google" button on the sign-in and sign-up pages (off until `NEXT_PUBLIC_GOOGLE_LOGIN=1`; setup in docs/DEPLOYMENT.md). New Google accounts accept the terms and privacy policy first, then choose their account type; the "Sign in as" role choice and two-step verification apply to Google sign-ins as well. `NEXT_PUBLIC_PASSWORD_LOGIN=0` can hide the password form.
- **Settings, expanded**: grouped sections with a jump bar (profile, preferences, appearance, notifications, security, privacy and data, account). New: phone and job title, week start (Monday, Sunday or Saturday), 12 or 24-hour clock, the page to open after sign-in, text size, reduce motion, change email, consent record, wearable-sharing shortcut and a JSON export button next to the CSV downloads.
- **Professional icons**: text symbols and emoji (stars, arrows, check marks, play signs) are replaced by one set of outline icons in the app.
- **Quick actions**: a "+" tab in the phone tab bar and a "Quick actions" button in the sidebar open a sheet of one-tap actions for the role (add athlete, record a test, new program, log an injury, message, import GPS, daily check-in, ...). Only actions the login may do appear.
- **Dark mode and iOS design**: Auto / Light / Dark appearance (Settings, sidebar and sign-in pages; remembered, no flash) with the green kept in both; iOS-style large titles, grouped inset cards, translucent material bars, springy press feedback, switch toggles, tinted buttons and an iOS-style bottom tab bar with a "Menu" sheet on phones.
- **Director menu**: overview, athletes, squads, training schedule, injuries, messages, GPS and settings (plus My Team for invitations). Testing, readiness and wearables are removed from the director.
- **Professional consultant**: the chat assistant for every role now consults on sport science, training, load, rehabilitation principles and running a department (role-specific expertise, longer answers, Markdown formatting, copy button). Still no diagnosis and no clearance to play.
- **Exercise videos**: learning player with captions where available, looping, no end-screen suggestions and slow-motion speed buttons; cues as numbered steps and common mistakes as warnings.
- **New look**: soft light backdrop with green glow, floating rounded cards, a floating light sidebar with initials avatars, pill badges, gradient buttons, larger headings and a product preview on the landing page, in the Performance360 green. Styled from shared components, so every page follows.
- **Email notifications**: people who turn on email notifications get a daily email copy of new notifications (Resend; optional, needs `RESEND_API_KEY`, `MAIL_FROM`, `CRON_SECRET` and the service-role key). Hebrew mails are right to left; links stay inside the app.
- **Squads**: the director and head of performance split the roster into squads and assign coaches. A head coach or assistant coach then sees only the athletes of their squads (database-enforced, including roster lists, GPS, injuries, wearables and notifications). Teams without squads behave as before.
- **Staff alerts**: coach, physiotherapist and head-of-performance dashboards flag high or low workload ratio and low shared recovery.
- **Data export**: CSV downloads (athletes, tests, injuries, GPS, readiness, wearables) from the relevant pages and from Settings, limited to what the signed-in person can already see; spreadsheet formulas are defused.
- **Settings**: notification categories (injuries, messages, plans, team, connections), sign out on all devices, and a download hub.
- **Role logins**: choosing a login shows what it opens and where to sign up; dashboards and shortcuts differ for the physiotherapist and the head of performance.
- **Scheduled WHOOP sync**: optional daily job (`vercel.json`, needs `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`) through service-only database functions.
- **Uploads**: file content is checked against its type; renamed programs and mismatched files are refused (a plausibility check, not a virus scan).
- **Workload ratio**: the GPS page shows each athlete's 7-day load against their 28-day weekly average, flags ratios above 1.5 or below 0.8, and says "not enough history" under two weeks of data. Staff only.
- **AI chat assistant**: a floating help panel for every role (director, head coach, head of performance, physiotherapist, team staff, personal trainer, athlete) that explains how to use the app and answers training questions. It sees no player data, never diagnoses or clears anyone, and is rate limited per user (`AI_CHAT_REQUESTS_PER_HOUR`, default 40).
- **Wearables**: athletes connect WHOOP (OAuth, encrypted tokens, 30-day sync) or import WHOOP / Fitbit export files; recovery, HRV, resting heart rate, sleep and strain with charts; private until the athlete shares with staff and the director; disconnect and erase. Fitbit live link waits for Google Health API access.
- **Engineering**: CI (lint, types, unit, licenses, build, SQL tests), `npm run verify`, PR template, Dependabot,
  contributing guide, architecture notes, ADRs, generated roles matrix (`docs/ROLES.md`), known-issues register.
- **Legal and consent**: privacy policy and terms of use (English and Hebrew, draft until reviewed), required
  acceptance at sign-up recorded on the account, parent or guardian consent for athletes under 18 with warnings.
- **Deployment**: deployment guide, `/api/health`, operator environment variables.
- **Files**: attach documents and images (up to 5 MB) to messages, injuries, GPS sessions, athlete testing,
  athlete documents and training programs.
- **Roles**: five sign-in options checked against the account; director with a read-only club view of all
  information; physiotherapist with medical side, tests, rehab programs and GPS import; head of performance
  with training, testing and GPS; athletes see their own GPS results.
- **Messages**: private one-to-one messages between people who work together.
- **GPS and wearables**: CSV import (StatSports, Catapult, Polar, generic), distance, speed zones, high-speed
  and sprint metrics, accelerations, load, pitch heat maps, squad comparison, trends, labelled sample session.
- **Return to play**: injury timeline with six stages, staff injury board, athlete self-reporting, clearance by
  qualified roles with a written basis.
- **Dashboards**: one file per role, "Needs attention" for coaches, open injuries for athletes and directors.
- **AI workout assistant**, **training calendar**, **athlete "Today's workout"**, **Quick Assign**.
- **Security and compliance**: nonce-based CSP, https enforcement and HSTS, rate limiting, bot guard, two-factor
  authentication, idle sign-out, account deletion, autosave, accessibility statement, disclosures, license check,
  external-only payments.
- **Workout builder** with blocks and colour-coded prescription chips; **exercise library** of 347 exercises with videos.
- **Team accounts** with director and staff roles, single-use invitations and a consented athlete roster.
- **Phase 1 core**: sign-up and onboarding, athletes, coach codes, training planner, testing, readiness,
  notifications, English and Hebrew (RTL).

### Fixed
- Dependency advisory in `zod` (updated within the allowed range).

### Known issues
See `docs/KNOWN-ISSUES.md`.
