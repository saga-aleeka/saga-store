// Serverless signin endpoint used by the client fallback when authorized_users proxy is not available.
// Accepts POST { initials } and returns { token, initials, name } for the matched authorized_users row.
// This endpoint uses the SUPABASE_SERVICE_ROLE_KEY to query the table server-side.

module.exports = async function handler(req: any, res: any){
  try{
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'server_misconfigured' })

    let body: any = req.body
    try{ if (!body && req.json) body = await req.json() }catch(e){}
    const initials = String((body && body.initials) || '').trim()
    if (!initials) return res.status(400).json({ error: 'missing_initials' })

    const supUrlBase = SUPABASE_URL.replace(/\/$/, '')
    const headers = {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Accept': 'application/json'
    }

  // Use case-insensitive match so users can enter lowercase/uppercase initials.
  // Limit the returned fields to the token and basic info and limit to 1 row.
  const url = `${supUrlBase}/rest/v1/authorized_users?select=token,initials,name&initials=ilike.${encodeURIComponent(initials)}&limit=1`
  const r = await fetch(url, { method: 'GET', headers })
    if (!r.ok) return res.status(502).json({ error: 'supabase_lookup_failed', status: r.status, body: await r.text() })
    const json = await r.json()
    if (!Array.isArray(json) || json.length === 0) {
      // helpful debug log for server logs
      console.warn('signin: initials not found', { initials })
      return res.status(401).json({ error: 'initials_not_found' })
    }
    // pick first match
    const row = json[0]
    // return token and basic info for client-side auth
    return res.status(200).json({ token: row.token, initials: row.initials, name: row.name })
  }catch(err:any){
    console.error('signin handler error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
