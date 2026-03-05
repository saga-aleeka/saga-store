// Server-side listing of authorized users. Uses the service role key so this
// handler can read the table regardless of RLS. This endpoint intentionally
// does NOT return tokens.
const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req:any, res:any){
  try{
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!SUPABASE_URL) return res.status(500).json({ error: 'server_misconfigured', message: 'Missing SUPABASE_URL' })
    if (!SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'server_misconfigured', message: 'Missing SUPABASE_SERVICE_ROLE_KEY' })

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data, error } = await supabaseAdmin
      .from('authorized_users')
      .select('id,initials,name,created_at')
      .order('initials', { ascending: true })

    if (error) return res.status(502).json({ error: 'supabase_error', message: error.message })

    return res.status(200).json({ data: data ?? [] })
  }catch(err:any){
    console.error('authorized_users handler error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
