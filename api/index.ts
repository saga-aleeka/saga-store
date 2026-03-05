// Consolidated API router for Vercel Hobby plan limits.
export {}

const envCheck = require('./_handlers/_env_check')
const adminUsers = require('./_handlers/admin_users')
const audit = require('./_handlers/audit')
const authSignin = require('./_handlers/auth/signin')
const authorizedUsers = require('./_handlers/authorized_users')
const backups = require('./_handlers/backups')
const containers = require('./_handlers/containers')
const containersById = require('./_handlers/containers/[id]')
const importHandler = require('./_handlers/import')
const sampleTags = require('./_handlers/sample-tags')
const samples = require('./_handlers/samples')
const samplesById = require('./_handlers/samples/[id]')
const samplesUpsert = require('./_handlers/samples/upsert')
const tags = require('./_handlers/tags')

module.exports = async function handler(req: any, res: any) {
  const url = new URL(req.url || '', 'http://localhost')
  const pathname = url.pathname

  if (pathname === '/api' || pathname === '/api/') {
    return res.status(200).json({ ok: true })
  }

  if (pathname === '/api/_env_check') return envCheck(req, res)
  if (pathname === '/api/auth/signin') return authSignin(req, res)
  if (pathname === '/api/authorized_users') return authorizedUsers(req, res)
  if (pathname === '/api/admin_users') return adminUsers(req, res)
  if (pathname === '/api/audit') return audit(req, res)
  if (pathname === '/api/tags') return tags(req, res)
  if (pathname === '/api/sample-tags') return sampleTags(req, res)
  if (pathname === '/api/import') return importHandler(req, res)

  if (pathname === '/api/backups') return backups(req, res)

  if (pathname === '/api/samples/upsert') return samplesUpsert(req, res)
  if (pathname === '/api/samples') return samples(req, res)
  if (pathname.startsWith('/api/samples/')) {
    const id = pathname.split('/')[3]
    req.query = { ...(req.query || {}), id }
    return samplesById(req, res)
  }

  if (pathname === '/api/containers') return containers(req, res)
  if (pathname.startsWith('/api/containers/')) {
    const id = pathname.split('/')[3]
    req.query = { ...(req.query || {}), id }
    return containersById(req, res)
  }

  return res.status(404).json({ error: 'not_found' })
}
