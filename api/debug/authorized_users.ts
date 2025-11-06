// Temporary debug endpoint to return authorized_users INCLUDING token.
// Access is protected: caller MUST provide header `x-admin-secret: <ADMIN_SECRET>`.
// This endpoint is intended for short-lived debugging only and should be removed
// after use. It uses the SUPABASE_SERVICE_ROLE_KEY server key to read the table.

export default async function handler(req:any, res:any){
  try{
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

    const ADMIN_SECRET = process.env.ADMIN_SECRET
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    // verify admin secret
    const provided = req.headers['x-admin-secret'] || req.headers['x_admin_secret']
    if (!ADMIN_SECRET || !provided || String(provided) !== String(ADMIN_SECRET)){
      return res.status(401).json({ error: 'missing_admin_secret' })
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'server_misconfigured', message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })

    const supUrlBase = SUPABASE_URL.replace(/\/$/, '')
    const headers = {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Accept': 'application/json'
    }

    const url = `${supUrlBase}/rest/v1/authorized_users?select=*&order=initials.asc`
    const r = await fetch(url, { method: 'GET', headers })
    if (!r.ok){
      const txt = await r.text().catch(()=>null)
      return res.status(502).json({ error: 'supabase_fetch_failed', status: r.status, body: txt })
    }
    const json = await r.json()
    // return full rows including token
    return res.status(200).json({ data: json })
  }catch(err:any){
    console.error('debug authorized_users error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
