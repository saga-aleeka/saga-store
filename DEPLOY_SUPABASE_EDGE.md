# Deploying to Supabase Edge Functions — step-by-step

This guide shows how to deploy the server-side import endpoint and the DB migration(s) to Supabase so your Admin Dashboard can call the production endpoint securely. It focuses on the minimal, secure setup for the `api/import` behavior already added to this repo.

Summary
- Goal: run `samples_upsert_v1` from a server-side endpoint that validates client tokens (the initials-based tokens stored in `authorized_users`).
- Approach: deploy a Supabase Edge Function (named `import`) and configure required secrets. Run the SQL migration to create the `authorized_users` table.

Environments & secret names (exact)
- SUPABASE_URL
  - Example: `https://xyzabc.supabase.co`
  - The project URL. Use the value shown in your Supabase Project Settings → API.
- SUPABASE_SERVICE_ROLE_KEY
  - The server-only (service_role) key from Supabase Project Settings → API. This MUST NOT be exposed to clients.
- ADMIN_SECRET
  - A short admin secret used by admin-only endpoints (e.g., `api/admin/users.ts`). Set to any unguessable string.
- VITE_API_BASE (frontend build-time)
  - The client-side API base used by the frontend. For example, if you host Edge Functions at `https://<project>.supabase.co/functions/v1`, set `VITE_API_BASE=https://<project>.supabase.co/functions/v1` (or to your app's host that proxies `/api/*` to the functions).
- VITE_SUPABASE_ANON_KEY (optional client key)
  - If your frontend needs to call Supabase client APIs directly (not required for imports), set this as your anon key in the frontend deployment only.

High-level steps
1. Prepare the function code (adapt `api/import.ts` for Supabase Edge).  
2. Add secrets to the Supabase project (service role key, admin secret, SUPABASE_URL).  
3. Deploy the Edge Function.  
4. Run the DB migrations (create `authorized_users` table).  
5. Configure frontend environment (VITE_API_BASE) and test.

Detailed instructions

Prerequisites
- Install the Supabase CLI: `npm install -g supabase` (or follow the official install docs).  
- Authenticate: `supabase login`  
- Optionally link this repo to your project: `supabase link --project-ref <project-ref>` (the project ref is visible in the Supabase dashboard URL or CLI list).

1) Prepare the Edge Function
- Supabase Edge Functions run on Deno — environment access uses `Deno.env.get('NAME')`. The Express-style `api/import.ts` added to this repo is a good canonical source but will need two small changes to run as an Edge Function:
  - Replace `process.env.SUPABASE_URL` / `process.env.SUPABASE_SERVICE_ROLE_KEY` with `Deno.env.get('SUPABASE_URL')` and `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`.
  - Replace the `(req,res)` style handler with the Deno `Request` handler returning a `Response` object.

  Minimal example wrapper (in `functions/import/index.ts`):

  ```ts
  export default async function handler(req: Request){
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 })

      const auth = req.headers.get('authorization') || ''
      const m = auth.match(/^Bearer\s+(.+)$/i)
      if (!m) return new Response(JSON.stringify({ error: 'missing_authorization' }), { status: 401 })
      const clientToken = m[1]

      // Look up authorized_users via the Supabase REST API (service role key)
      const checkUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/authorized_users?select=*&token=eq.${encodeURIComponent(clientToken)}`
      const supHeaders = {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }

      const checkResp = await fetch(checkUrl, { method: 'GET', headers: supHeaders as any })
      if (!checkResp.ok) return new Response(JSON.stringify({ error: 'supabase_lookup_failed' }), { status: 500 })
      const found = await checkResp.json()
      if (!Array.isArray(found) || found.length === 0) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })

      const body = await req.json().catch(() => ({}))
      const items = Array.isArray(body) ? body : (body.items ?? [])
      if (!Array.isArray(items)) return new Response(JSON.stringify({ error: 'invalid_payload' }), { status: 400 })

      // Call RPC
      const rpcUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/samples_upsert_v1`
      const rpcResp = await fetch(rpcUrl, { method: 'POST', headers: supHeaders as any, body: JSON.stringify(items) })
      const rpcText = await rpcResp.text()
      const rpcJson = (() => { try { return JSON.parse(rpcText) } catch { return rpcText } })()
      if (!rpcResp.ok) return new Response(JSON.stringify({ error: 'rpc_failed', body: rpcJson }), { status: 502 })

      return new Response(JSON.stringify({ data: rpcJson }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    } catch (err) {
      return new Response(JSON.stringify({ error: 'internal_server_error', message: String(err) }), { status: 500 })
    }
  }
  ```

  - Save the function under `functions/import/index.ts` in this codebase (the Supabase CLI will look for `functions/`).
  - If you prefer to keep the `api/import.ts` file for Vercel-style deployments, you can keep both; the function code above should be a small adaptation.

2) Add secrets to Supabase (CLI or dashboard)

  Option A — CLI (recommended for automation):

  ```bash
  # log in and optionally link project
  supabase login
  supabase link --project-ref <PROJECT_REF>

  # set required secrets
  supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>" \
    ADMIN_SECRET="<A_RANDOM_ADMIN_SECRET>" \
    SUPABASE_URL="https://<project>.supabase.co"
  ```

  Option B — Dashboard (manual):
  - Open your Supabase project → Settings → API and copy the Project URL and Service Role key.
  - Open Project → Settings → Environment Variables / Secrets (or Functions → Secrets) and add `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET`, and `SUPABASE_URL`.

3) Deploy the Edge Function

  ```bash
  # from the repository root
  supabase functions deploy import --project-ref <PROJECT_REF>
  ```

  - After deploy, the function will be reachable at:  
    `https://<project>.supabase.co/functions/v1/import`

4) Run the DB migration(s)

  You must create the `authorized_users` table in your database so the import endpoint can validate tokens.

  Option A — Quick (Dashboard SQL editor):
  - Open Supabase → SQL Editor → New query. Paste the contents of `db/migrations/2025-11-01-create-authorized-users.sql` and run it.

  Option B — Using psql (if you have a DB connection string):
  ```bash
  psql "<DB_CONNECTION_STRING>" -f db/migrations/2025-11-01-create-authorized-users.sql
  ```

  Option C — Supabase CLI migrations (if you maintain migrations via the CLI):
  - See `supabase db` docs — you can push or run migrations from your migrations folder. If you want, I can add a short script for this repo.

5) Configure your frontend build (Vite)

  - Set `VITE_API_BASE` in your frontend deployment environment variables so the built app knows where to call the API.
    - If you want the frontend to call Edge Functions directly, set:
      ```env
      VITE_API_BASE=https://<project>.supabase.co/functions/v1
      ```
    - If you host the frontend somewhere else and proxy `/api/*` to the functions, set `VITE_API_BASE` to the frontend's origin (and make sure your proxy maps `/api/import` → `https://<project>.supabase.co/functions/v1/import`).

  - Optionally set `VITE_SUPABASE_ANON_KEY` if the client will use Supabase client libraries for read-only data.

Testing the deployed function

  Example curl (replace placeholders):

  ```bash
  curl -X POST "https://<project>.supabase.co/functions/v1/import" \
    -H "Authorization: Bearer <USER_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '[{"sample_id":"S-1","container_id":"<container_uuid>","position":"A1"}]'
  ```

  Expected response: `200` and a JSON body containing RPC per-sample results in `data`.

Security & notes
- The `SUPABASE_SERVICE_ROLE_KEY` MUST NOT be stored in client code or exposed to the browser. Use Supabase secrets (dashboard or CLI) so the key is only available to Edge Functions.
- Keep `ADMIN_SECRET` secret; use it to protect any admin-only endpoints (e.g., `api/admin/users.ts`).
- The function validates that the client token exists in `authorized_users` before calling the service-role RPC. If you want tighter control, add additional checks (e.g., check `is_admin` or `allowed_actions`).
- If you prefer Vercel/Netlify, you can reuse the same `api/import.ts` without Deno changes — those platforms accept the Node-style handler.

Optional: automated migration & deploy script (example)

```bash
# set vars
export PROJECT_REF=<your-project-ref>
export SERVICE_ROLE_KEY=<service-role-key>
export ADMIN_SECRET=$(openssl rand -hex 16)
export SUPABASE_URL=https://<project>.supabase.co

# link and set secrets
supabase link --project-ref $PROJECT_REF
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" ADMIN_SECRET="$ADMIN_SECRET" SUPABASE_URL="$SUPABASE_URL"

# deploy function (from repo root where functions/ exists)
supabase functions deploy import --project-ref $PROJECT_REF

# run migration via dashboard or psql
```

If you'd like, I can also:
- Add a `functions/import/index.ts` file adapted from the repository `api/import.ts` and a quick `Makefile` / script to deploy and run migrations.  
- Add a Vitest integration test that runs locally against a mocked Supabase REST API to verify the Edge handler behavior.

---

If you want me to create the Edge Function file in this repo (I can adapt `api/import.ts` to Deno), say "Create function file" and I'll add it and show the exact `supabase functions deploy` command I used. 
