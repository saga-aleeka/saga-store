// Serverless endpoint to accept imports from authenticated clients (initials-token)
// Validates the client-provided token against `authorized_users` using the Supabase
// service role key, then calls the `samples_upsert_v1` RPC with the provided items.
// This file is intended to run on Vercel/Netlify/Supabase Edge Functions or similar.
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any){
  try{
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'server_misconfigured', message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Extract client token from Authorization header
    const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || ''
    const m = String(auth).match(/^Bearer\s+(.+)$/i)
    if (!m) return res.status(401).json({ error: 'missing_authorization' })
    const clientToken = m[1]

    // Validate client token exists in authorized_users
    const { data: found, error: checkError } = await supabaseAdmin
      .from('authorized_users')
      .select('*')
      .eq('token', clientToken)
      .limit(1)

    if (checkError) return res.status(500).json({ error: 'supabase_lookup_failed', message: checkError.message })
    if (!found || found.length === 0) return res.status(401).json({ error: 'unauthorized' })

    // parse body: accept { items: [...] } or a raw array
    let body: any = req.body
    try{ if (!body && req.json) body = await req.json() }catch(e){}
    if (!body) body = {}
    let items = body.items ?? body
    // if items is an object with items property that's not an array, fail
    if (!Array.isArray(items)) return res.status(400).json({ error: 'invalid_payload', message: 'expected array of items or { items: [...] }' })

    // Call the Supabase RPC (samples_upsert_v1 takes a jsonb array)
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('samples_upsert_v1', items)

    if (rpcError) return res.status(502).json({ error: 'rpc_failed', message: rpcError.message })

    return res.status(200).json({ data: rpcData })
  }catch(err:any){
    console.error('import handler error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
