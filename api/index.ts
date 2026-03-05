// Consolidated API router for Vercel Hobby plan limits.
export {}

const loadHandler = (path: string) => {
  try {
    return require(path)
  } catch (err: any) {
    return { __loadError: err }
  }
}

const respondLoadError = (res: any, err: any) => {
  const message = err?.message || String(err)
  return res.status(500).json({ error: 'handler_load_failed', message })
}

module.exports = async function handler(req: any, res: any) {
  const url = new URL(req.url || '', 'http://localhost')
  const pathname = url.pathname

  if (pathname === '/api' || pathname === '/api/') {
    return res.status(200).json({ ok: true })
  }

  if (pathname === '/api/_env_check') {
    const handler = loadHandler('./_handlers/_env_check')
    if (handler.__loadError) return respondLoadError(res, handler.__loadError)
    return handler(req, res)
  }
  if (pathname === '/api/auth/signin') {
    const handler = loadHandler('./_handlers/auth/signin')
    if (handler.__loadError) return respondLoadError(res, handler.__loadError)
    return handler(req, res)
  }
  if (pathname === '/api/authorized_users') {
    const handler = loadHandler('./_handlers/authorized_users')
    if (handler.__loadError) return respondLoadError(res, handler.__loadError)
    return handler(req, res)
  }
  if (pathname === '/api/admin_users') {
    const handler = loadHandler('./_handlers/admin_users')
    if (handler.__loadError) return respondLoadError(res, handler.__loadError)
    return handler(req, res)
  }
  if (pathname === '/api/audit') {
    const handler = loadHandler('./_handlers/audit')
    if (handler.__loadError) return respondLoadError(res, handler.__loadError)
    return handler(req, res)
  }
  if (pathname === '/api/tags') {
    const handler = loadHandler('./_handlers/tags')
    if (handler.__loadError) return respondLoadError(res, handler.__loadError)
    return handler(req, res)
  }
  if (pathname === '/api/sample-tags') {
    const handler = loadHandler('./_handlers/sample-tags')
    if (handler.__loadError) return respondLoadError(res, handler.__loadError)
    return handler(req, res)
  }
  if (pathname === '/api/import') {
    const handler = loadHandler('./_handlers/import')
    if (handler.__loadError) return respondLoadError(res, handler.__loadError)
    return handler(req, res)
  }

  if (pathname === '/api/backups') {
    const handler = loadHandler('./_handlers/backups')
    if (handler.__loadError) return respondLoadError(res, handler.__loadError)
    return handler(req, res)
  }

  if (pathname === '/api/samples/upsert') {
    const handler = loadHandler('./_handlers/samples/upsert')
    if (handler.__loadError) return respondLoadError(res, handler.__loadError)
    return handler(req, res)
  }
  if (pathname === '/api/samples') {
    const handler = loadHandler('./_handlers/samples')
    if (handler.__loadError) return respondLoadError(res, handler.__loadError)
    return handler(req, res)
  }
  if (pathname.startsWith('/api/samples/')) {
    const handler = loadHandler('./_handlers/samples/[id]')
    if (handler.__loadError) return respondLoadError(res, handler.__loadError)
    const id = pathname.split('/')[3]
    req.query = { ...(req.query || {}), id }
    return handler(req, res)
  }

  if (pathname === '/api/containers') {
    const handler = loadHandler('./_handlers/containers')
    if (handler.__loadError) return respondLoadError(res, handler.__loadError)
    return handler(req, res)
  }
  if (pathname.startsWith('/api/containers/')) {
    const handler = loadHandler('./_handlers/containers/[id]')
    if (handler.__loadError) return respondLoadError(res, handler.__loadError)
    const id = pathname.split('/')[3]
    req.query = { ...(req.query || {}), id }
    return handler(req, res)
  }

  return res.status(404).json({ error: 'not_found' })
}
