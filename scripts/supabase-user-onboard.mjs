#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue

    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
      continue
    }

    args[key] = next
    i += 1
  }
  return args
}

function parseRoles(value) {
  if (!value) return []
  return String(value)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function toInitials(email) {
  const local = String(email || '').split('@')[0] || ''
  const cleaned = local.replace(/[^A-Za-z0-9]/g, '')
  return cleaned ? cleaned.slice(0, 4).toUpperCase() : 'USER'
}

async function findUserByEmail(supabaseAdmin, email) {
  const target = String(email || '').trim().toLowerCase()
  let page = 1
  const perPage = 200

  while (page <= 50) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`listUsers failed: ${error.message}`)

    const users = data?.users || []
    const match = users.find((u) => String(u.email || '').trim().toLowerCase() === target)
    if (match) return match

    if (users.length < perPage) break
    page += 1
  }

  return null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help || args.h) {
    console.log(`\nSupabase user onboarding utility\n\nUsage:\n  node scripts/supabase-user-onboard.mjs --email user@company.com --name \"Jane Doe\" --roles user\n\nOptional flags:\n  --password <password>          Create user with a password if missing\n  --create-if-missing            Allow creating user when not found\n  --roles <csv>                  Example: user OR admin,owner\n  --name <full name>             Stored in user_metadata.full_name\n  --initials <initials>          Stored in user_metadata.initials\n  --email-confirmed              Mark created users as email confirmed\n  --dry-run                      Show what would happen without making changes\n  --help                         Show this help\n\nEnvironment variables required:\n  SUPABASE_URL\n  SUPABASE_SERVICE_ROLE_KEY\n`)
    return
  }

  const email = String(args.email || '').trim().toLowerCase()
  if (!email) {
    throw new Error('Missing required flag: --email')
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const roles = parseRoles(args.roles || 'user')
  const fullName = args.name ? String(args.name).trim() : null
  const initials = args.initials ? String(args.initials).trim().toUpperCase() : toInitials(email)
  const dryRun = !!args['dry-run']

  let user = await findUserByEmail(supabaseAdmin, email)

  if (!user) {
    const canCreate = !!args['create-if-missing'] || !!args.password
    if (!canCreate) {
      throw new Error('User not found. Pass --create-if-missing and --password to create.')
    }

    if (!args.password) {
      throw new Error('Creating a user requires --password')
    }

    if (dryRun) {
      console.log(`[dry-run] Would create user ${email}`)
      console.log(`[dry-run] app_metadata.roles=${JSON.stringify(roles)}`)
      console.log(`[dry-run] user_metadata=${JSON.stringify({ full_name: fullName, initials })}`)
      return
    }

    const createPayload = {
      email,
      password: String(args.password),
      email_confirm: !!args['email-confirmed'],
      app_metadata: { roles },
      user_metadata: {
        full_name: fullName,
        initials,
      },
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser(createPayload)
    if (createError) throw new Error(`createUser failed: ${createError.message}`)

    user = created?.user
    if (!user) throw new Error('User was created but response did not include user object')
    console.log(`Created user ${email} (${user.id})`)
  }

  const existingRoles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : []
  const existingUserMeta = user.user_metadata || {}

  const mergedRoles = Array.from(new Set([...existingRoles.map((r) => String(r).toLowerCase()), ...roles]))
  const nextUserMeta = {
    ...existingUserMeta,
    full_name: fullName || existingUserMeta.full_name || existingUserMeta.name || null,
    initials: initials || existingUserMeta.initials || null,
  }

  if (dryRun) {
    console.log(`[dry-run] Found user ${email} (${user.id})`)
    console.log(`[dry-run] Would update app_metadata.roles=${JSON.stringify(mergedRoles)}`)
    console.log(`[dry-run] Would update user_metadata=${JSON.stringify(nextUserMeta)}`)
    return
  }

  const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata || {}),
      roles: mergedRoles,
    },
    user_metadata: nextUserMeta,
  })

  if (updateError) throw new Error(`updateUserById failed: ${updateError.message}`)

  const finalUser = updated?.user
  const finalRoles = finalUser?.app_metadata?.roles || mergedRoles
  console.log(`Updated user ${email} (${user.id})`)
  console.log(`Roles: ${JSON.stringify(finalRoles)}`)
  console.log(`Initials: ${nextUserMeta.initials || ''}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
