function normalizeRoles(value: any): string[] {
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

export function getUserRoles(user: any): string[] {
  if (!user) return []

  const merged = [
    ...normalizeRoles(user?.roles),
    ...normalizeRoles(user?.role),
    ...normalizeRoles(user?.app_metadata?.roles),
    ...normalizeRoles(user?.app_metadata?.role),
    ...normalizeRoles(user?.user_metadata?.roles),
    ...normalizeRoles(user?.user_metadata?.role),
  ]

  return Array.from(new Set(merged))
}

function getConfiguredAdminEmails(): string[] {
  const raw = ((import.meta as any).env?.VITE_ADMIN_EMAILS as string) || ''
  return normalizeRoles(raw)
}

export function isAdminUser(user: any): boolean {
  const roles = getUserRoles(user)
  if (roles.includes('admin') || roles.includes('owner')) return true

  const email = String(user?.email || '').trim().toLowerCase()
  if (!email) return false

  const adminEmails = getConfiguredAdminEmails()
  return adminEmails.includes(email)
}
