# Changelog

All notable changes, newest first. Format: [Keep a Changelog](https://keepachangelog.com), grouped by theme.
The product has not been released publicly yet, so everything is under *Unreleased*.

## Unreleased

### Added
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
