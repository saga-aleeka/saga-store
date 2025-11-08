// Serverless endpoint to manage `containers` table in Supabase.
// Supports:
// - GET /api/containers[?archived=true] -> list containers (filters by archived)
// - GET /api/containers/:id -> get container with samples embedded
// - POST /api/containers -> create container (requires admin secret or valid bearer token)
// - PUT/PATCH /api/containers/:id -> update container (requires admin secret or valid bearer token)

export default async function handler(req: any, res: any){
  try{
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    const ADMIN_SECRET = process.env.ADMIN_SECRET

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'server_misconfigured', message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })

    const supUrlBase = SUPABASE_URL.replace(/\/$/, '')
    const supHeaders = {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    // Helper to validate admin credentials: either ADMIN_SECRET or a Bearer token that exists in authorized_users
    const providedSecret = req.headers['x-admin-secret'] || req.headers['x_admin_secret']
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || ''
    let isAdmin = false
    if (ADMIN_SECRET && providedSecret && String(providedSecret) === String(ADMIN_SECRET)) isAdmin = true
    const m = String(authHeader || '').match(/^Bearer\s+(.+)$/i)
    const clientToken = m ? m[1] : null
    if (!isAdmin && clientToken){
      const chk = await fetch(`${supUrlBase}/rest/v1/authorized_users?select=*&token=eq.${encodeURIComponent(clientToken)}`, { method: 'GET', headers: supHeaders })
      if (chk.ok){
        const found = await chk.json()
        if (Array.isArray(found) && found.length > 0) isAdmin = true
      }
    }

    // GET list
    if (req.method === 'GET' && !req.url.match(/\/api\/containers\/[A-Za-z0-9_-]+$/)){
      const archived = req.query?.archived || (req.url && new URL(req.url, 'http://localhost').searchParams.get('archived'))
  // Map archived=true -> archived=eq.true, otherwise archived=eq.false
      let url = `${supUrlBase}/rest/v1/containers?select=*`
  if (archived === 'true' || archived === true) url += `&archived=eq.true`
  else url += `&archived=eq.false`
      url += `&order=updated_at.desc`
      const r = await fetch(url, { method: 'GET', headers: supHeaders })
      if (!r.ok) return res.status(502).json({ error: 'supabase_list_failed', status: r.status, body: await r.text() })
      const json = await r.json()
      return res.status(200).json({ data: json })
    }

    // GET single container with samples
    if (req.method === 'GET' && req.url && req.url.match(/\/api\/containers\/[A-Za-z0-9_-]+$/)){
      const parts = req.url.split('/')
      const id = parts[parts.length - 1]
      const url = `${supUrlBase}/rest/v1/containers?select=*,samples(*)&id=eq.${encodeURIComponent(id)}`
      const r = await fetch(url, { method: 'GET', headers: supHeaders })
      if (!r.ok) return res.status(502).json({ error: 'supabase_container_fetch_failed', status: r.status, body: await r.text() })
      const json = await r.json()
      if (!Array.isArray(json) || json.length === 0) return res.status(404).json({ error: 'not_found' })
      return res.status(200).json({ data: json[0] })
    }

    // For modifications require admin credentials
    if (!isAdmin) return res.status(401).json({ error: 'missing_admin_credentials' })

    // Create container
    if (req.method === 'POST'){
      let body: any = req.body
      try{ if (!body && req.json) body = await req.json() }catch(e){}
      const insert = {
        id: body?.id ?? undefined,
        name: body?.name ?? null,
        location: body?.location ?? null,
        layout: body?.layout ?? null,
        total: body?.total ?? null,
        used: body?.used ?? 0,
    archived: body?.archived ?? body?.is_archived ?? false,
        temperature: body?.temperature ?? null,
        type: body?.type ?? null
      }
      const r = await fetch(`${supUrlBase}/rest/v1/containers`, { method: 'POST', headers: { ...supHeaders, Prefer: 'return=representation' }, body: JSON.stringify(insert) })
      const text = await r.text()
      let json: any = null
      try{ json = JSON.parse(text) }catch(e){ json = text }
      if (!r.ok) return res.status(502).json({ error: 'supabase_insert_failed', status: r.status, body: json })
      return res.status(201).json({ data: json })
    }

    // Update container
    if (req.method === 'PUT' || req.method === 'PATCH'){
      let body: any = req.body
      try{ if (!body && req.json) body = await req.json() }catch(e){}
      // Determine id from url
      const parts = req.url.split('/')
      const id = parts[parts.length - 1]
      if (!id) return res.status(400).json({ error: 'missing_id' })
      // Leave `archived` property as-is (Supabase column is `archived`)
      const r = await fetch(`${supUrlBase}/rest/v1/containers?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { ...supHeaders, Prefer: 'return=representation' }, body: JSON.stringify(body) })
      const text = await r.text()
      let json: any = null
      try{ json = JSON.parse(text) }catch(e){ json = text }
      if (!r.ok) return res.status(502).json({ error: 'supabase_update_failed', status: r.status, body: json })
      return res.status(200).json({ data: json })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err:any){
    console.error('containers handler error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
