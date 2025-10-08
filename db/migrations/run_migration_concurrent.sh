#!/usr/bin/env bash
# Helper script: pre-check for active sessions and run the CONCURRENTLY migration file
# Usage: ./db/migrations/run_migration_concurrent.sh <DATABASE_URL>

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <DATABASE_URL>"
  exit 2
fi

DB_URL="$1"
MIGRATION_FILE="$(dirname "$0")/2025-10-08-add-samples-indexes-concurrently.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "Migration file not found: $MIGRATION_FILE"
  exit 3
fi

echo "Checking active sessions..."
psql "$DB_URL" -c "SELECT pid, usename, state, query_start, query FROM pg_stat_activity WHERE datname = current_database() AND state <> 'idle' ORDER BY query_start DESC;"

read -p "If the above shows blocking/long-running queries, cancel them before proceeding. Continue? [y/N] " yn
case "$yn" in
  [Yy]* ) ;;
  * ) echo "Aborting."; exit 1;;
esac

echo "Running migration: $MIGRATION_FILE"
psql "$DB_URL" -f "$MIGRATION_FILE"

echo "Migration completed."
