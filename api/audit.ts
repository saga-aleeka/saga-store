// Placeholder audit endpoint - returns empty array for now
// This can be enhanced later to track audit events
const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured' })
    }

    // Return empty audit trail for now
    // In the future, this could query an audit_log table
    return res.status(200).json({ data: [] })
  } catch (err: any) {
    console.error('audit handler error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
