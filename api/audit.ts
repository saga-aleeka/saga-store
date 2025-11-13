// Serverless endpoint to manage audit logs
const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req: any, res: any) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured' })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // GET - Retrieve audit logs
    if (req.method === 'GET'){
      const { data, error } = await supabaseAdmin
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) {
        console.error('Failed to fetch audit logs:', error)
        return res.status(502).json({ error: 'supabase_fetch_failed', message: error.message })
      }

      return res.status(200).json({ data: data ?? [] })
    }

    // POST - Create audit log entry
    if (req.method === 'POST'){
      let body: any = req.body
      try{ if (!body && req.json) body = await req.json() }catch(e){}

      const insert = {
        user_initials: body?.user_initials ?? null,
        user_name: body?.user_name ?? null,
        entity_type: body?.entity_type,
        entity_id: body?.entity_id ?? null,
        action: body?.action,
        entity_name: body?.entity_name ?? null,
        changes: body?.changes ?? null,
        metadata: body?.metadata ?? null,
        description: body?.description ?? null
      }

      const { data, error } = await supabaseAdmin
        .from('audit_logs')
        .insert([insert])
        .select()

      if (error) {
        console.error('Failed to create audit log:', error)
        return res.status(502).json({ error: 'supabase_insert_failed', message: error.message })
      }

      return res.status(201).json({ data })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (err: any) {
    console.error('audit handler error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
