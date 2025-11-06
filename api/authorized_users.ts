// Lightweight proxy to list authorized users (no tokens returned).
// Used by the client as the first lookup (MSW provides this in dev).
export default async function handler(req:any, res:any){
  try{
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!SUPABASE_URL) return res.status(500).json({ error: 'server_misconfigured', message: 'Missing SUPABASE_URL' })

    const supUrlBase = SUPABASE_URL.replace(/\/$/, '')
    // Prefer anon key for read-only listing if available, otherwise fall back to service role key
    const key = SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY
    if (!key) return res.status(500).json({ error: 'server_misconfigured', message: 'Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY' })

    const headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Accept': 'application/json'
    }

    const url = `${supUrlBase}/rest/v1/authorized_users?select=id,initials,name,created_at&order=initials.asc`
    const r = await fetch(url, { method: 'GET', headers })
    if (!r.ok) return res.status(502).json({ error: 'supabase_fetch_failed', status: r.status, body: await r.text() })
    const json = await r.json()
    return res.status(200).json({ data: json })
  }catch(err:any){
    console.error('authorized_users proxy error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
