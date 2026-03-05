// Serverless endpoint to list samples from Supabase.
// GET /api/samples[?container_id=X&archived=true] -> list all samples with optional filters
const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req: any, res: any) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ 
        error: 'server_misconfigured', 
        message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' 
      })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Only support GET
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    // Parse query parameters
    const container_id = req.query?.container_id || 
      (req.url && new URL(req.url, 'http://localhost').searchParams.get('container_id'))
    const archived = req.query?.archived || 
      (req.url && new URL(req.url, 'http://localhost').searchParams.get('archived'))

    // Build query
    let query = supabaseAdmin.from('samples').select('*')
    
    if (container_id) {
      query = query.eq('container_id', container_id)
    }
    
    if (archived === 'true' || archived === true) {
      query = query.eq('is_archived', true)
    } else {
      query = query.eq('is_archived', false)
    }
    
    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      return res.status(502).json({ 
        error: 'supabase_query_failed', 
        message: error.message 
      })
    }

    return res.status(200).json({ data: data ?? [] })
  } catch (err: any) {
    console.error('samples handler error', err)
    return res.status(500).json({ 
      error: 'internal_server_error', 
      message: String(err?.message || err) 
    })
  }
}
