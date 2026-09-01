// Serverless endpoint to manage Supabase Auth users.
// - GET /api/admin_users    -> list auth users with profile metadata
// - POST /api/admin_users   -> create a dormant auth user and set metadata/roles
// - PATCH /api/admin_users  -> update user metadata/roles
// - DELETE /api/admin_users -> delete auth user by id
const { createClient } = require('@supabase/supabase-js')
const { getRequestAuth, hasAdminSecret, isAdminAuth } = require('./_auth_helper')

function parseRoles(value) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean)
  }

  return String(value)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function toUnique(values) {
  return Array.from(new Set(values))
}

function mapAuthUser(user) {
  const appMeta = user?.app_metadata || {}
  const userMeta = user?.user_metadata || {}
  const roles = toUnique([
    ...parseRoles(appMeta.roles),
    ...parseRoles(appMeta.role),
    ...parseRoles(userMeta.roles),
    ...parseRoles(userMeta.role),
  ])

  const status = user?.banned_until
    ? 'banned'
    : user?.last_sign_in_at
      ? 'active'
      : user?.invited_at
        ? 'invited'
        : 'pending'

  return {
    id: user?.id,
    email: user?.email || null,
    full_name: userMeta.full_name || userMeta.name || null,
    initials: userMeta.initials || userMeta.preferred_initials || null,
    roles,
    status,
    created_at: user?.created_at || null,
    updated_at: user?.updated_at || null,
    invited_at: user?.invited_at || null,
    confirmed_at: user?.confirmed_at || null,
    last_sign_in_at: user?.last_sign_in_at || null,
    banned_until: user?.banned_until || null,
    is_sso_user: !!user?.is_sso_user,
    is_anonymous: !!user?.is_anonymous,
    raw_app_meta_data: appMeta,
    raw_user_meta_data: userMeta,
  }
}

async function listAllAuthUsers(supabaseAdmin) {
  const users = []
  let page = 1
  const perPage = 200

  while (page <= 50) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const batch = data?.users || []
    users.push(...batch)
    if (batch.length < perPage) break
    page += 1
  }

  return users
}

module.exports = async function handler(req: any, res: any){
  try{
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    const ADMIN_SECRET = process.env.ADMIN_SECRET

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'server_misconfigured', message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const auth = await getRequestAuth(req, supabaseAdmin)
    const isAdmin = hasAdminSecret(req, ADMIN_SECRET) || isAdminAuth(auth)
    if (!isAdmin) return res.status(401).json({ error: 'missing_admin_credentials' })

    if (req.method === 'GET'){
      const users = await listAllAuthUsers(supabaseAdmin)
      const mapped = users.map(mapAuthUser).sort((a, b) => String(a.email || '').localeCompare(String(b.email || '')))
      return res.status(200).json({ data: mapped })
    }

    // POST/DELETE/PATCH also require admin credentials.

    if (req.method === 'POST'){
      let body: any = req.body
      try{ if (!body && req.json) body = await req.json() }catch(e){}
      const email = String(body?.email || '').trim().toLowerCase()
      if (!email) return res.status(400).json({ error: 'missing_email' })

      const roles = toUnique(parseRoles(body?.roles || body?.role || 'user'))
      const fullName = body?.full_name ?? body?.name ?? null
      const initials = body?.initials ?? null
      const userMeta = {
        ...(body?.user_metadata || {}),
        full_name: fullName,
        initials,
        password_set: false,
      }

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        app_metadata: { roles },
        user_metadata: userMeta,
      })

      if (createError) {
        const code = /already|exists/i.test(String(createError.message || '')) ? 409 : 502
        return res.status(code).json({ error: 'supabase_create_failed', message: createError.message })
      }

      const createdUser = created?.user
      if (!createdUser?.id) {
        return res.status(502).json({ error: 'supabase_create_failed', message: 'Create response missing user id' })
      }

      return res.status(201).json({ data: mapAuthUser(createdUser) })
    }

    if (req.method === 'PATCH'){
      let body: any = req.body
      try{ if (!body && req.json) body = await req.json() }catch(e){}
      const id = String(body?.id || '').trim()
      if (!id) return res.status(400).json({ error: 'missing_id' })

      const { data: existingData, error: existingError } = await supabaseAdmin.auth.admin.getUserById(id)
      if (existingError || !existingData?.user) {
        return res.status(404).json({ error: 'user_not_found', message: existingError?.message || 'User not found' })
      }

      const existingUser = existingData.user
      const nextRoles = body?.roles || body?.role
      const roles = nextRoles !== undefined
        ? toUnique(parseRoles(nextRoles))
        : toUnique(parseRoles(existingUser.app_metadata?.roles || existingUser.app_metadata?.role))

      const nextUserMeta = {
        ...(existingUser.user_metadata || {}),
        ...(body?.user_metadata || {}),
      }

      if (Object.prototype.hasOwnProperty.call(body || {}, 'full_name') || Object.prototype.hasOwnProperty.call(body || {}, 'name')) {
        nextUserMeta.full_name = body?.full_name ?? body?.name ?? null
      }
      if (Object.prototype.hasOwnProperty.call(body || {}, 'initials')) {
        nextUserMeta.initials = body?.initials ?? null
      }

      const updatePayload: any = {
        app_metadata: {
          ...(existingUser.app_metadata || {}),
          roles,
        },
        user_metadata: nextUserMeta,
      }

      if (Object.prototype.hasOwnProperty.call(body || {}, 'email')) {
        updatePayload.email = String(body?.email || '').trim().toLowerCase()
      }
      if (Object.prototype.hasOwnProperty.call(body || {}, 'banned_until')) {
        updatePayload.ban_duration = body?.banned_until ? '876000h' : 'none'
      }

      const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload)
      if (updateError) return res.status(502).json({ error: 'supabase_update_failed', message: updateError.message })
      return res.status(200).json({ data: mapAuthUser(updated?.user || existingUser) })
    }

    if (req.method === 'DELETE'){
      let body: any = req.body
      try{ if (!body && req.json) body = await req.json() }catch(e){}
      const id = String(body?.id || '').trim()
      if (!id) return res.status(400).json({ error: 'missing_id', message: 'provide id' })

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id)
      if (deleteError) return res.status(502).json({ error: 'supabase_delete_failed', message: deleteError.message })
      return res.status(200).json({ success: true, id })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err:any){
    console.error('admin_users handler error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
