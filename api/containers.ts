// Serverless endpoint to manage `containers` table in Supabase.
// Supports:
// - GET /api/containers[?archived=true] -> list containers (filters by archived)
// - GET /api/containers/:id -> get container with samples embedded
// - POST /api/containers -> create container (requires admin secret or valid bearer token)
// - PUT/PATCH /api/containers/:id -> update container (requires admin secret or valid bearer token)
const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req: any, res: any){
  try{
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    const ADMIN_SECRET = process.env.ADMIN_SECRET

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'server_misconfigured', message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Helper to validate admin credentials: either ADMIN_SECRET or a Bearer token that exists in authorized_users
    const providedSecret = req.headers['x-admin-secret'] || req.headers['x_admin_secret']
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || ''
    let isAdmin = false
    if (ADMIN_SECRET && providedSecret && String(providedSecret) === String(ADMIN_SECRET)) isAdmin = true
    const m = String(authHeader || '').match(/^Bearer\s+(.+)$/i)
    const clientToken = m ? m[1] : null
    if (!isAdmin && clientToken){
      const { data: found, error: chkError } = await supabaseAdmin
        .from('authorized_users')
        .select('*')
        .eq('token', clientToken)
        .limit(1)

      if (!chkError && found && found.length > 0) isAdmin = true
    }

    // GET list
    if (req.method === 'GET' && !req.url.match(/\/api\/containers\/[A-Za-z0-9_-]+$/)){
      const archived = req.query?.archived || (req.url && new URL(req.url, 'http://localhost').searchParams.get('archived'))
      
      let query = supabaseAdmin.from('containers').select('*')
      if (archived === 'true' || archived === true) {
        query = query.eq('archived', true)
      } else {
        query = query.eq('archived', false)
      }
      query = query.order('updated_at', { ascending: false })

      const { data, error } = await query
      if (error) return res.status(502).json({ error: 'supabase_list_failed', message: error.message })
      return res.status(200).json({ data: data ?? [] })
    }

    // GET single container with samples
    if (req.method === 'GET' && req.url && req.url.match(/\/api\/containers\/[A-Za-z0-9_-]+$/)){
      const parts = req.url.split('/')
      const id = parts[parts.length - 1]
      const { data, error } = await supabaseAdmin
        .from('containers')
        .select('*,samples(*)')
        .eq('id', id)
        .limit(1)

      if (error) return res.status(502).json({ error: 'supabase_container_fetch_failed', message: error.message })
      if (!data || data.length === 0) return res.status(404).json({ error: 'not_found' })
      return res.status(200).json({ data: data[0] })
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
        type: body?.type ?? null,
        training: body?.training ?? false
      }
      const { data, error } = await supabaseAdmin
        .from('containers')
        .insert([insert])
        .select()

      if (error) return res.status(502).json({ error: 'supabase_insert_failed', message: error.message })
      return res.status(201).json({ data })
    }

    // Update container
    if (req.method === 'PUT' || req.method === 'PATCH'){
      let body: any = req.body
      try{ if (!body && req.json) body = await req.json() }catch(e){}
      // Determine id from url
      const parts = req.url.split('/')
      const id = parts[parts.length - 1]
      if (!id) return res.status(400).json({ error: 'missing_id' })
      
      const { data, error } = await supabaseAdmin
        .from('containers')
        .update(body)
        .eq('id', id)
        .select()

      if (error) return res.status(502).json({ error: 'supabase_update_failed', message: error.message })
      return res.status(200).json({ data })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err:any){
    console.error('containers handler error', err)
    console.error('Error details:', { message: err?.message, stack: err?.stack, name: err?.name })
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
