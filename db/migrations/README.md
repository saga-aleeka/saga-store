This folder contains SQL migrations for manual application against the Postgres (Supabase) database.

To apply the migration locally (safe CONCURRENTLY approach):

IMPORTANT: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block. Ensure you run the SQL directly (not wrapped in BEGIN/COMMIT) and avoid active long-running transactions.

- This migration creates three indexes using CONCURRENTLY:
  - `idx_samples_container_id` on `samples(container_id)`
  - `idx_samples_sample_id` on `samples(sample_id)`
  - `idx_samples_sample_id_lower` on `lower(sample_id)` to support fast case-insensitive searches
- `IF NOT EXISTS` ensures the statements are safe to re-run.
- Building indexes concurrently avoids heavy locks on writes but can take longer and needs free resources.
- If CONCURRENTLY fails due to concurrent activity, identify and stop blocking sessions or run during a maintenance window.
1) Quick pre-check to ensure there are no active transactions that will block:

```bash
# Replace with your database URL
export SUPABASE_DB_URL=postgresql://postgres:password@localhost:5432/postgres

# List active (non-idle) sessions for the current DB - ensure nothing long-running will block
psql "$SUPABASE_DB_URL" -c "SELECT pid, usename, state, query_start, query FROM pg_stat_activity WHERE datname = current_database() AND state <> 'idle' ORDER BY query_start DESC;"
```

If the output shows no active long-running queries, proceed.

2) Run the CONCURRENTLY migration (runs each CREATE INDEX CONCURRENTLY statement in the file):

```bash
psql "$SUPABASE_DB_URL" -f db/migrations/2025-10-08-add-samples-indexes-concurrently.sql
```

3) Using Supabase CLI (alternative):

```bash
# These are shell commands, NOT SQL. Do NOT paste them into a psql prompt.
# Configure a named remote for the Supabase CLI (only needed once)
supabase db remote set prod --project-ref <project-ref>

# Run the SQL file against that remote. The CLI will execute the file; ensure it does not wrap the file in a transaction.
supabase db remote run --file db/migrations/2025-10-08-add-samples-indexes-concurrently.sql --remote prod
```

Important troubleshooting note:
- The error you saw ("syntax error at or near 'supabase'") happens when you paste shell/CLI commands into a psql (SQL) prompt. The `supabase` lines are shell commands and must be run in your shell (bash/zsh/PowerShell), not inside psql. If you accidentally pasted them into psql, exit with `\q` and run them from your terminal.

Notes:
- This migration creates three indexes using CONCURRENTLY.
- `IF NOT EXISTS` ensures the statements are safe to re-run.
- Building indexes concurrently avoids heavy locks on writes but can take longer and needs free resources.
- If CONCURRENTLY fails due to concurrent activity, identify and stop blocking sessions or run during a maintenance window.
- This migration creates three indexes using CONCURRENTLY:
  - `idx_samples_container_id` on `samples(container_id)`
  - `idx_samples_sample_id` on `samples(sample_id)`
  - `idx_samples_sample_id_lower` on `lower(sample_id)` to support fast case-insensitive searches
- `IF NOT EXISTS` ensures the statements are safe to re-run.
- Building indexes concurrently avoids heavy locks on writes but can take longer and needs free resources.
- If CONCURRENTLY fails due to concurrent activity, identify and stop blocking sessions or run during a maintenance window.
