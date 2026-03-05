// Consolidated API router for Vercel Hobby plan limits.
const envCheckHandler = require('./_handlers/_env_check')
const authSigninHandler = require('./_handlers/auth/signin')
const authorizedUsersHandler = require('./_handlers/authorized_users')
const adminUsersHandler = require('./_handlers/admin_users')
const auditHandler = require('./_handlers/audit')
const tagsHandler = require('./_handlers/tags')
const sampleTagsHandler = require('./_handlers/sample-tags')
const importHandler = require('./_handlers/import')
const backupsHandler = require('./_handlers/backups')
const samplesUpsertHandler = require('./_handlers/samples/upsert')
const samplesHandler = require('./_handlers/samples')
const samplesByIdHandler = require('./_handlers/samples/[id]')
const containersHandler = require('./_handlers/containers')
const containersByIdHandler = require('./_handlers/containers/[id]')

module.exports = async function handler(req: any, res: any) {
  const url = new URL(req.url || '', 'http://localhost')
  const pathname = url.pathname

  if (pathname === '/api' || pathname === '/api/') {
    return res.status(200).json({ ok: true })
  }

  if (pathname === '/api/_env_check') return envCheckHandler(req, res)
  if (pathname === '/api/auth/signin') return authSigninHandler(req, res)
  if (pathname === '/api/authorized_users') return authorizedUsersHandler(req, res)
  if (pathname === '/api/admin_users') return adminUsersHandler(req, res)
  if (pathname === '/api/audit') return auditHandler(req, res)
  if (pathname === '/api/tags') return tagsHandler(req, res)
  if (pathname === '/api/sample-tags') return sampleTagsHandler(req, res)
  if (pathname === '/api/import') return importHandler(req, res)
  if (pathname === '/api/backups') return backupsHandler(req, res)
  if (pathname === '/api/samples/upsert') return samplesUpsertHandler(req, res)
  if (pathname === '/api/samples') return samplesHandler(req, res)
  if (pathname.startsWith('/api/samples/')) {
    const id = pathname.split('/')[3]
    req.query = { ...(req.query || {}), id }
    return samplesByIdHandler(req, res)
  }
  if (pathname === '/api/containers') return containersHandler(req, res)
  if (pathname.startsWith('/api/containers/')) {
    const id = pathname.split('/')[3]
    req.query = { ...(req.query || {}), id }
    return containersByIdHandler(req, res)
  }

  return res.status(404).json({ error: 'not_found' })
}
