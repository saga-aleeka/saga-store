// Temporary-password generation and shared password rules.
const crypto = require('crypto')

// Ambiguous glyphs (0/O/1/l/I) are excluded so passwords survive being read aloud or retyped.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%^&*-_=+'

const TEMP_PASSWORD_LENGTH = 16

function pick(chars) {
  return chars[crypto.randomInt(0, chars.length)]
}

function generateTempPassword(length = TEMP_PASSWORD_LENGTH) {
  const target = Math.max(Number(length) || TEMP_PASSWORD_LENGTH, 12)
  const all = UPPER + LOWER + DIGITS + SYMBOLS
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)]

  while (chars.length < target) chars.push(pick(all))

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1)
    const tmp = chars[i]
    chars[i] = chars[j]
    chars[j] = tmp
  }

  return chars.join('')
}

// Mirrors src/lib/passwordPolicy.ts so the rules cannot drift between client and server.
function validatePasswordStrength(password) {
  const value = String(password || '')
  if (value.length < 8) return 'Password must be at least 8 characters'
  if (!/[a-z]/.test(value)) return 'Password must contain a lowercase letter'
  if (!/[A-Z]/.test(value)) return 'Password must contain an uppercase letter'
  if (!/\d/.test(value)) return 'Password must contain a number'
  if (!/[^A-Za-z0-9]/.test(value)) return 'Password must contain a symbol'
  return null
}

async function findUserByEmail(supabaseAdmin, email) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return null

  let page = 1
  const perPage = 200

  while (page <= 50) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const batch = data?.users || []
    const match = batch.find((user) => String(user?.email || '').trim().toLowerCase() === normalized)
    if (match) return match
    if (batch.length < perPage) break
    page += 1
  }

  return null
}

module.exports = {
  generateTempPassword,
  validatePasswordStrength,
  findUserByEmail,
}
