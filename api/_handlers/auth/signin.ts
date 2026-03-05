// Server-side signin endpoint that returns a token for valid initials
const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req: any, res: any){
  try{
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
    
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured' })
    }

    let body: any = req.body
    try{ if (!body && req.json) body = await req.json() }catch(e){}
    
    const initials = body?.initials
    if (!initials) return res.status(400).json({ error: 'missing_initials' })

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Look up user by initials (case-insensitive)
    const { data, error } = await supabaseAdmin
      .from('authorized_users')
      .select('token,initials,name')
      .ilike('initials', initials.trim())
      .limit(1)

    if (error) {
      console.error('signin lookup error', error)
      return res.status(500).json({ error: 'database_error' })
    }

    if (!data || data.length === 0) {
      return res.status(401).json({ error: 'invalid_initials' })
    }

    const user = data[0]
    return res.status(200).json({ 
      token: user.token,
      initials: user.initials,
      name: user.name
    })
  }catch(err:any){
    console.error('signin handler error', err)
    return res.status(500).json({ error: 'internal_server_error' })
  }
}
