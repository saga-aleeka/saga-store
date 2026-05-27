function getHeader(req, name) {
  return req?.headers?.[name] || req?.headers?.[name.toLowerCase()] || req?.headers?.[name.toUpperCase()] || null
}

function extractBearerToken(req) {
  const authHeader = getHeader(req, 'authorization') || ''
  const m = String(authHeader).match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  const token = String(m[1] || '').trim()
  if (!token || token === 'null' || token === 'undefined') return null
  return token
}

function toInitialsFromEmail(email) {
  const local = String(email || '').split('@')[0] || ''
  const cleaned = local.replace(/[^A-Za-z0-9]/g, '')
  if (!cleaned) return null
  return cleaned.slice(0, 4).toUpperCase()
}

function parseRoles(value) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v || '').trim().toLowerCase())
      .filter(Boolean)
  }
  return String(value)
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
}

function getUserRoles(user) {
  const roles = [
    ...parseRoles(user?.app_metadata?.roles),
    ...parseRoles(user?.app_metadata?.role),
    ...parseRoles(user?.user_metadata?.roles),
    ...parseRoles(user?.user_metadata?.role),
    ...parseRoles(user?.roles),
    ...parseRoles(user?.role),
  ]

  return Array.from(new Set(roles))
}

function getAdminRolesFromEnv() {
  const raw = process.env.ADMIN_ROLES || 'admin,owner'
  const parsed = parseRoles(raw)
  return parsed.length > 0 ? parsed : ['admin', 'owner']
}

function getAdminEmailsFromEnv() {
  const raw = process.env.ADMIN_EMAILS || ''
  return parseRoles(raw)
}

function isEmailInList(email, list) {
  if (!email) return false
  const normalized = String(email).trim().toLowerCase()
  return list.includes(normalized)
}

function buildIdentity(user) {
  const md = user?.user_metadata || {}
  const email = user?.email || null
  const initials = md.initials || md.preferred_initials || toInitialsFromEmail(email)
  const name = md.full_name || md.name || email || null
  const roles = getUserRoles(user)

  return {
    userId: user?.id || null,
    email,
    initials: initials || null,
    name,
    roles,
    role: roles[0] || null,
  }
}

async function getRequestAuth(req, supabaseAdmin) {
  const token = extractBearerToken(req)
  if (!token) {
    return {
      token: null,
      isAuthenticated: false,
      supabaseUser: null,
      identity: { userId: null, email: null, initials: null, name: null, roles: [], role: null },
    }
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data?.user) {
      return {
        token,
        isAuthenticated: false,
        supabaseUser: null,
        identity: { userId: null, email: null, initials: null, name: null, roles: [], role: null },
      }
    }

    return {
      token,
      isAuthenticated: true,
      supabaseUser: data.user,
      identity: buildIdentity(data.user),
    }
  } catch (err) {
    return {
      token,
      isAuthenticated: false,
      supabaseUser: null,
      identity: { userId: null, email: null, initials: null, name: null, roles: [], role: null },
    }
  }
}

function hasAdminSecret(req, adminSecret) {
  if (!adminSecret) return false
  const providedSecret = getHeader(req, 'x-admin-secret') || getHeader(req, 'x_admin_secret')
  return !!providedSecret && String(providedSecret) === String(adminSecret)
}

function isAdminAuth(auth) {
  if (!auth?.isAuthenticated) return false

  const roles = Array.isArray(auth?.identity?.roles) ? auth.identity.roles : []
  const adminRoles = getAdminRolesFromEnv()
  if (roles.some((role) => adminRoles.includes(role))) return true

  const adminEmails = getAdminEmailsFromEnv()
  return isEmailInList(auth?.identity?.email, adminEmails)
}

module.exports = {
  extractBearerToken,
  getRequestAuth,
  hasAdminSecret,
  getUserRoles,
  isAdminAuth,
}
