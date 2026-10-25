# Supabase: migrations and tests

- `migrations/` — the schema history, applied in file-name order. **Never edit a migration that has been
  applied anywhere; add a new file.** A fresh database built from these files must equal production.
- `sql-tests/` — SQL tests (`*_test.sql`) that run after the migrations in a throwaway Postgres:
  `npm run test:db`. They prove who can and cannot read or write each kind of data. Add one for every change
  to tables, policies or functions.
- `manual/` — SQL that must be run by a person in the Supabase SQL editor. Today:
  `pending_delete_functions.sql` (functions containing a `DELETE`, which the assistant's database connection
  cannot confirm). Run it once, then remove it from this list in `docs/KNOWN-ISSUES.md`.
- `data/` — generated reference data (exercise library) used by the generator scripts in `scripts/`.

## Conventions

- Timestamped names `YYYYMMDDHHMMSS_topic.sql`. Applied migrations on the live project carry the time they
  were applied, so repo names are aligned with them when that differs.
- Every table: `enable row level security` in the same migration (an event trigger also enforces it), explicit
  policies, `revoke insert, update, delete … from anon, authenticated` when writes go through functions.
- Functions: `security definer set search_path = public, pg_temp`, `revoke execute … from public, anon`,
  `grant execute … to authenticated` only for what the app calls. Internal helpers get no grant.
- Table names must not collide with objects on the live project: check `list_tables` first (the project also
  holds tables from another prototype, e.g. `messages`, which is why ours is `direct_messages`).

## Live project status (15 migrations applied)

| Migration | Live |
| --- | --- |
| core, reference_data, training_functions, hardening, exercise_library, teams | applied |
| messages_return_to_play, revoke_rls_auto_enable_execute | applied (written by another session; not in this repo) |
| injuries, role_scoping, gps, director_and_messages, role_access_v2, attachments_and_physio_gps, consent_and_minors | applied (repo file names carry the live version numbers) |
| `delete_account` (`delete_my_account`) | **pending: run `manual/pending_delete_functions.sql`** |
| `delete_gps_session`, `remove_attachment` | **pending: same file** |
