// Lightweight debug endpoint to report presence of important environment variables
// Does NOT return secret values — only booleans indicating presence. Useful for preview debugging.
const { checkSupabaseProjectRefLock } = require('./_runtime_guard')

module.exports = async function handler(req: any, res: any){
  try{
    // Only allow GET
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

    const present = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      ADMIN_SECRET: !!process.env.ADMIN_SECRET,
      EXPECTED_SUPABASE_PROJECT_REF: !!process.env.EXPECTED_SUPABASE_PROJECT_REF
    }

    const runtimeGuard = checkSupabaseProjectRefLock()

    return res.status(200).json({ ok: true, present, runtimeGuard })
  }catch(err:any){
    console.error('env_check error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
