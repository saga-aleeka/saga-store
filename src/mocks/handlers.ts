import * as msw from 'msw'
const rest = (msw as any).rest;

// seed data
const containers = [
  { id: 1, name: 'Freezer A1', location: 'Lab A / Shelf 1', type: 'cfDNA Tubes', temperature: '-80°C', layout: '9x9', used: 12, total: 81, archived: false, training: false, updated_at: '2025-10-31T19:37:00Z' },
  { id: 2, name: 'Rack B2', location: 'Storage B / Rack 2', type: 'MNC Tubes', temperature: '-20°C', layout: '5x5', used: 20, total: 25, archived: true, training: false, updated_at: '2025-09-01T12:00:00Z' },
  { id: 3, name: 'Shelf C', location: 'Cold Room / Shelf C', type: 'DTC Tubes', temperature: '4°C', layout: '8x12', used: 5, total: 96, archived: false, training: true, updated_at: '2025-10-15T08:00:00Z' },
  { id: 4, name: 'Box D', location: 'Vault / Box D', type: 'cfDNA Tubes', temperature: '-80°C', layout: '5x5', used: 0, total: 25, archived: false, training: false, updated_at: '2025-10-20T14:22:00Z' },
  { id: 5, name: 'Archive E', location: 'Long-term / Archive E', type: 'MNC Tubes', temperature: '-20°C', layout: '9x9', used: 81, total: 81, archived: true, training: false, updated_at: '2024-12-01T09:00:00Z' }
]

const samples = [
  { id: 'S-001', container_id: 1, position: 'A1', status: 'active', owner: 'alice', collected_at: '2025-10-30', thumb: null, updated_at: '2025-10-31T19:00:00Z' },
  { id: 'S-003', container_id: 1, position: 'A2', status: 'active', owner: 'bob', collected_at: '2025-10-29', thumb: null, updated_at: '2025-10-30T11:12:00Z' },
  { id: 'S-010', container_id: 1, position: 'B4', status: 'active', owner: 'carol', collected_at: '2025-10-25', thumb: null, updated_at: '2025-10-25T09:05:00Z' },
  { id: 'S-002', container_id: 2, position: 'B2', status: 'archived', owner: 'dave', collected_at: '2025-09-01', thumb: null, updated_at: '2025-09-01T12:01:00Z' },
  { id: 'S-021', container_id: 3, position: 'C1', status: 'active', owner: 'erin', collected_at: '2025-10-15', thumb: null, updated_at: '2025-10-15T08:10:00Z' },
  { id: 'S-022', container_id: 3, position: 'C2', status: 'active', owner: 'frank', collected_at: '2025-10-15', thumb: null, updated_at: '2025-10-15T08:12:00Z' },
  { id: 'S-099', container_id: 5, position: 'H9', status: 'archived', owner: 'gina', collected_at: '2024-11-30', thumb: null, updated_at: '2024-11-30T16:00:00Z' }
]

const audits = [
  { id: 1, type: 'create', target: 'container', target_id: 1, actor: 'alice', msg: 'Created container Freezer A1', at: '2025-10-30T10:00:00Z' },
  { id: 2, type: 'move', target: 'sample', target_id: 'S-002', actor: 'bob', msg: 'Moved S-002 to container 1', at: '2025-10-31T09:12:00Z' }
]

export const handlers = [
  // containers list
  rest.get('/api/containers', (req, res, ctx) => {
    const archived = req.url.searchParams.get('archived') === 'true'
    const list = containers.filter(c => !!c.archived === archived)
    return res(ctx.status(200), ctx.json({ data: list }))
  }),

  rest.get('/api/containers/:id', (req, res, ctx) => {
    const idParam = String(req.params.id)
    const c = containers.find(x => String(x.id) === idParam)
    if (!c) return res(ctx.status(404), ctx.json({ error: 'not_found' }))
    const contained = samples.filter(s => String(s.container_id) === idParam)
    return res(ctx.status(200), ctx.json({ data: { ...c, samples: contained } }))
  }),

  // samples list
  rest.get('/api/samples', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ data: samples }))
  }),

  // audit events
  rest.get('/api/audit', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ data: audits }))
  }),

  // import (mass import) - accept and echo
  rest.post('/api/import', async (req, res, ctx) => {
    const payload = await req.json()
    // pretend we created items and an audit record
    const imported = Array.isArray(payload.items) ? payload.items.map((it, idx) => ({ ...it, id: `new-${Date.now()}-${idx}` })) : []
    audits.unshift({ id: audits.length + 1, type: 'import', target: 'samples', target_id: null, actor: 'alice', msg: `Imported ${imported.length} samples`, at: new Date().toISOString() })
    return res(ctx.status(201), ctx.json({ data: imported }))
  }),

  // backups
  rest.get('/api/backups', (req, res, ctx) => {
    const backups = [
      { id: 'bkp-2025-10-30', created_at: '2025-10-30T01:00:00Z', size: '12MB' }
    ]
    return res(ctx.status(200), ctx.json({ data: backups }))
  }),

  // authorized users - proxy to Supabase authorized_users table when Vite env is set
  // This removes any hard-coded/dev users and lets the app read the real table in dev
  rest.get('/api/authorized_users', async (req, res, ctx) => {
    // Vite env vars are available as import.meta.env at build/run time
    const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || ''
    const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      // Not configured: return empty list (removes dev users)
      // Frontend should handle no authorized users gracefully.
      // Keep a console message to help developers configure env vars.
      // eslint-disable-next-line no-console
      console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set; returning empty authorized_users')
      return res(ctx.status(200), ctx.json({ data: [] }))
    }

    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/authorized_users?select=*&order=initials.asc`
    const headers: Record<string,string> = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json'
    }

    try {
      const r = await fetch(url, { method: 'GET', headers })
      if (!r.ok) {
        const txt = await r.text()
        return res(ctx.status(502), ctx.json({ error: 'supabase_fetch_failed', status: r.status, body: txt }))
      }
      const json = await r.json()
      return res(ctx.status(200), ctx.json({ data: json }))
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('authorized_users proxy error', err)
      return res(ctx.status(500), ctx.json({ error: 'proxy_error' }))
    }
  }),

  rest.post('/api/backups/restore', async (req, res, ctx) => {
    const body = await req.json()
    audits.unshift({ id: audits.length + 1, type: 'restore', target: 'backup', target_id: body.id, actor: 'alice', msg: `Restored backup ${body.id}`, at: new Date().toISOString() })
    return res(ctx.status(200), ctx.json({ ok: true }))
  })

  ,
  // update container
  rest.put('/api/containers/:id', async (req, res, ctx) => {
    const idParam = String(req.params.id)
    const body = await req.json()
    const idx = containers.findIndex(c => String(c.id) === idParam)
    if (idx === -1) return res(ctx.status(404), ctx.json({ error: 'not_found' }))
    // update allowed fields
  const allowed = ['name','location','type','temperature','layout','used','total','archived','training']
    for (const k of Object.keys(body)){
      if (allowed.includes(k)) {
        // @ts-ignore
        containers[idx][k] = body[k]
      }
    }
    audits.unshift({ id: audits.length + 1, type: 'update', target: 'container', target_id: idParam, actor: 'alice', msg: `Updated container ${idParam}`, at: new Date().toISOString() })
    return res(ctx.status(200), ctx.json({ data: containers[idx] }))
  })

  ,
  // create container
  rest.post('/api/containers', async (req, res, ctx) => {
    const body = await req.json()
    // use provided id if present (allow string ids), otherwise generate numeric id
    let id: any = body.id ?? null
    if (id === null || id === undefined){
      const numericIds = containers.map(c=> typeof c.id === 'number' ? c.id : 0)
      id = Math.max(0, ...numericIds) + 1
    }
    const newContainer = {
      id,
      name: body.name ?? `Container ${id}`,
      location: body.location ?? '',
      type: body.type ?? 'Sample Type',
      temperature: body.temperature ?? '-80°C',
      layout: body.layout ?? '9x9',
      used: body.used ?? 0,
      total: body.total ?? 81,
      archived: !!body.archived,
      training: !!body.training,
      updated_at: new Date().toISOString()
    }
    containers.unshift(newContainer)
    audits.unshift({ id: audits.length + 1, type: 'create', target: 'container', target_id: id, actor: 'alice', msg: `Created container ${id}`, at: new Date().toISOString() })
    return res(ctx.status(201), ctx.json({ data: newContainer }))
  })

  ,
  // move a sample to another container
  rest.post('/api/samples/:id/move', async (req, res, ctx) => {
    const sid = String(req.params.id)
    const body = await req.json()
    const sidx = samples.findIndex(s => s.id === sid)
    if (sidx === -1) return res(ctx.status(404), ctx.json({ error: 'not_found' }))
    const target = body.target_container_id
    samples[sidx].container_id = target
    audits.unshift({ id: audits.length + 1, type: 'move', target: 'sample', target_id: sid, actor: 'alice', msg: `Moved ${sid} to container ${target}`, at: new Date().toISOString() })
    return res(ctx.status(200), ctx.json({ data: samples[sidx] }))
  })

  ,
  // simple update sample
  rest.put('/api/samples/:id', async (req, res, ctx) => {
    const sid = String(req.params.id)
    const body = await req.json()
    const sidx = samples.findIndex(s => s.id === sid)
    if (sidx === -1) return res(ctx.status(404), ctx.json({ error: 'not_found' }))
    for (const k of Object.keys(body)){
      // @ts-ignore
      samples[sidx][k] = body[k]
    }
    audits.unshift({ id: audits.length + 1, type: 'update', target: 'sample', target_id: sid, actor: 'alice', msg: `Updated sample ${sid}`, at: new Date().toISOString() })
    return res(ctx.status(200), ctx.json({ data: samples[sidx] }))
  })
]
