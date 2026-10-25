# ADR 0001: Next.js and Supabase

Status: accepted

The product needs per-role access to sensitive data, sign-in with optional two-factor, and fast iteration by a
small team. We chose Next.js (server actions keep secrets and logic on the server) with Supabase (Postgres,
Auth, row-level security) rather than porting the earlier Base44 prototype. Consequences: one deployable app,
SQL migrations as the schema history, and a database that can enforce access on its own.
