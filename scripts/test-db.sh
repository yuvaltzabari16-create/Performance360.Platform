#!/usr/bin/env bash
# Spins up a throwaway local Postgres, applies the stub + all migrations, then runs
# the SQL tests in supabase/sql-tests (files named *_test.sql). Fails on the first error.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
cleanup() { "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
if [ "$(id -u)" = "0" ]; then RUN=(runuser -u postgres --); chown -R postgres "$WORK"; else RUN=(); fi
"${RUN[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start >/dev/null
PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -o /dev/null)
"${PSQL[@]}" -f "$ROOT/supabase/sql-tests/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "migrate: $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
for f in "$ROOT"/supabase/sql-tests/*_test.sql; do echo "test:    $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
echo "all database tests passed"
