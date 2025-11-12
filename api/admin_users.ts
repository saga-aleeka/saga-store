// Serverless endpoint to manage authorized_users table.
// - GET /api/admin_users  -> list users (does NOT return tokens)
// - POST /api/admin_users -> create a user (requires x-admin-secret header)
// - DELETE /api/admin_users -> delete a user by id/initials/token (requires x-admin-secret header)
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any){
  try{
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    const ADMIN_SECRET = process.env.ADMIN_SECRET

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'server_misconfigured', message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    if (req.method === 'GET'){
      // list users but DO NOT include tokens in the response for safety
      const { data, error } = await supabaseAdmin
        .from('authorized_users')
        .select('id,initials,name,created_at')
        .order('initials', { ascending: true })

      if (error) return res.status(502).json({ error: 'supabase_list_failed', message: error.message })
      return res.status(200).json({ data: data ?? [] })
    }

    // For POST/DELETE/PATCH require admin credentials.
    // Accept either the ADMIN_SECRET header or an Authorization: Bearer <token>
    const providedSecret = req.headers['x-admin-secret'] || req.headers['x_admin_secret']
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || ''
    let isAdmin = false
    if (ADMIN_SECRET && providedSecret && String(providedSecret) === String(ADMIN_SECRET)) isAdmin = true
    // If Authorization Bearer token provided, validate it exists in authorized_users
    const m = String(authHeader || '').match(/^Bearer\s+(.+)$/i)
    const clientToken = m ? m[1] : null
    if (!isAdmin && clientToken) {
      // check token exists
      const { data: found, error: chkError } = await supabaseAdmin
        .from('authorized_users')
        .select('*')
        .eq('token', clientToken)
        .limit(1)

      if (!chkError && found && found.length > 0) isAdmin = true
    }
    if (!isAdmin) return res.status(401).json({ error: 'missing_admin_credentials' })

    if (req.method === 'POST'){
      let body: any = req.body
      try{ if (!body && req.json) body = await req.json() }catch(e){}
      const initials = body?.initials
      const name = body?.name
      if (!initials) return res.status(400).json({ error: 'missing_initials' })

      const insertBody = { initials: String(initials).trim(), name: name ?? null }
      const { data, error } = await supabaseAdmin
        .from('authorized_users')
        .insert([insertBody])
        .select()

      if (error) return res.status(502).json({ error: 'supabase_insert_failed', message: error.message })
      // return the created row(s) including token
      return res.status(201).json({ data })
    }

    if (req.method === 'PATCH'){
      let body: any = req.body
      try{ if (!body && req.json) body = await req.json() }catch(e){}
      const { id, initials, updates } = body || {}
      if (!id && !initials) return res.status(400).json({ error: 'missing_identifier', message: 'provide id or initials' })
      
      let query = supabaseAdmin.from('authorized_users').update(updates || {})
      if (id) query = query.eq('id', id)
      else if (initials) query = query.eq('initials', initials)
      
      const { data, error } = await query.select()

      if (error) return res.status(502).json({ error: 'supabase_update_failed', message: error.message })
      return res.status(200).json({ data })
    }

    if (req.method === 'DELETE'){
      let body: any = req.body
      try{ if (!body && req.json) body = await req.json() }catch(e){}
      const { id, initials, token } = body || {}
      if (!id && !initials && !token) return res.status(400).json({ error: 'missing_identifier', message: 'provide id or initials or token' })
      
      let query = supabaseAdmin.from('authorized_users').delete()
      if (id) query = query.eq('id', id)
      else if (initials) query = query.eq('initials', initials)
      else if (token) query = query.eq('token', token)
      
      const { data, error } = await query.select()

      if (error) return res.status(502).json({ error: 'supabase_delete_failed', message: error.message })
      return res.status(200).json({ data })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err:any){
    console.error('admin_users handler error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
