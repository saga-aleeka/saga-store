// Issues a new temporary password for a user and returns it to the admin to relay.
// - POST { id }    -> reset by user id
// - POST { email } -> reset by email
// Requires admin/owner credentials.
const { createClient } = require('@supabase/supabase-js')
const { getRequestAuth, hasAdminSecret, isAdminAuth } = require('./_auth_helper')
const { generateTempPassword, findUserByEmail } = require('./_password_helper')

module.exports = async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    const ADMIN_SECRET = process.env.ADMIN_SECRET

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured', message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const auth = await getRequestAuth(req, supabaseAdmin)
    const isAdmin = hasAdminSecret(req, ADMIN_SECRET) || isAdminAuth(auth)
    if (!isAdmin) return res.status(401).json({ error: 'missing_admin_credentials' })

    let body: any = req.body
    try { if (!body && req.json) body = await req.json() } catch (e) {}

    const id = String(body?.id || '').trim()
    const email = String(body?.email || '').trim().toLowerCase()

    let targetUser: any = null
    if (id) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(id)
      if (error || !data?.user) return res.status(404).json({ error: 'user_not_found' })
      targetUser = data.user
    } else if (email) {
      targetUser = await findUserByEmail(supabaseAdmin, email)
      if (!targetUser?.id) return res.status(404).json({ error: 'user_not_found' })
    } else {
      return res.status(400).json({ error: 'missing_id_or_email' })
    }

    const tempPassword = generateTempPassword()

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      password: tempPassword,
      app_metadata: {
        ...(targetUser.app_metadata || {}),
        must_change_password: true,
      },
      user_metadata: {
        ...(targetUser.user_metadata || {}),
        password_set: false,
      },
    })

    if (updateError) {
      return res.status(502).json({ error: 'password_reset_failed', message: updateError.message })
    }

    return res.status(200).json({
      success: true,
      data: {
        id: targetUser.id,
        email: targetUser.email,
        temp_password: tempPassword,
      },
    })
  } catch (err: any) {
    console.error('password_reset handler error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
