// Sets a permanent password for the signed-in user and clears the forced-change flag.
// The flag lives in app_metadata, which only the service role can write, so a user
// cannot skip the forced change by editing their own metadata from the browser.
const { createClient } = require('@supabase/supabase-js')
const { getRequestAuth } = require('./_auth_helper')
const { validatePasswordStrength } = require('./_password_helper')

module.exports = async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured', message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const auth = await getRequestAuth(req, supabaseAdmin)

    if (!auth.isAuthenticated || !auth.supabaseUser?.id) {
      return res.status(401).json({ error: 'not_authenticated' })
    }

    let body: any = req.body
    try { if (!body && req.json) body = await req.json() } catch (e) {}

    const newPassword = String(body?.new_password || '')
    const policyError = validatePasswordStrength(newPassword)
    if (policyError) return res.status(400).json({ error: 'weak_password', message: policyError })

    const currentUser = auth.supabaseUser

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(currentUser.id, {
      password: newPassword,
      app_metadata: {
        ...(currentUser.app_metadata || {}),
        must_change_password: false,
      },
      user_metadata: {
        ...(currentUser.user_metadata || {}),
        password_set: true,
      },
    })

    if (updateError) {
      return res.status(502).json({ error: 'password_update_failed', message: updateError.message })
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('change_password handler error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
