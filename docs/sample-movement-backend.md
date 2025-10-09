# Sample Movement Backend Behaviour

The current UI renders sample movement history using only data cached in
`localStorage`. The `createAuditLog` helper writes every audit entry into the
`saga-audit-logs` key, and movements are derived from those cached logs along
with any `saga-containers`/`samples-<container>` keys. There is no network call
or Supabase RPC that persists movement events to the backend, so the backend has
no data to return.

Key locations:

- `src/components/AuditTrail.tsx` lines 94-123 store audit events locally.
- Lines 171-241 of the same file rebuild the "movements" list purely from local
  storage.

To persist movements you would need to add API routes or Supabase table writes
when `createAuditLog` (or the movement-producing actions) execute, and then
fetch from that backend store instead of relying solely on the browser cache.
