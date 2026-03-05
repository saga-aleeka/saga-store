const { createClient } = require('@supabase/supabase-js')
const { createAuditLog, getUserFromRequest } = require('./_audit_helper')

module.exports = async function handler(req: any, res: any) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured' })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const user = getUserFromRequest(req)

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('tags')
        .select('id, name, color, created_at, updated_at')
        .order('name', { ascending: true })

      if (error) {
        console.error('Failed to fetch tags:', error)
        return res.status(502).json({ error: 'supabase_fetch_failed', message: error.message })
      }

      return res.status(200).json({ data: data ?? [] })
    }

    let body: any = req.body
    try { if (!body && req.json) body = await req.json() } catch (e) {}

    if (req.method === 'POST') {
      const name = String(body?.name || '').trim()
      const color = String(body?.color || '#94a3b8').trim() || '#94a3b8'

      if (!name) return res.status(400).json({ error: 'name_required' })

      const { data: created, error } = await supabaseAdmin
        .from('tags')
        .insert({ name, color, created_by: user.initials || null })
        .select('id, name, color, created_at, updated_at')
        .single()

      if (error) {
        console.error('Failed to create tag:', error)
        return res.status(502).json({ error: 'supabase_insert_failed', message: error.message })
      }

      await createAuditLog(supabaseAdmin, {
        userInitials: user.initials,
        userName: user.name,
        entityType: 'tag',
        entityId: created.id,
        action: 'created',
        entityName: created.name,
        metadata: { tag_id: created.id, tag_name: created.name, color: created.color }
      })

      return res.status(201).json({ data: created })
    }

    if (req.method === 'PUT') {
      const tagId = body?.id
      const name = String(body?.name || '').trim()
      const color = String(body?.color || '').trim()

      if (!tagId) return res.status(400).json({ error: 'id_required' })

      const { data: before } = await supabaseAdmin
        .from('tags')
        .select('id, name, color')
        .eq('id', tagId)
        .single()

      const updates: any = {}
      if (name) updates.name = name
      if (color) updates.color = color
      updates.updated_at = new Date().toISOString()

      const { data: updated, error } = await supabaseAdmin
        .from('tags')
        .update(updates)
        .eq('id', tagId)
        .select('id, name, color, created_at, updated_at')
        .single()

      if (error) {
        console.error('Failed to update tag:', error)
        return res.status(502).json({ error: 'supabase_update_failed', message: error.message })
      }

      await createAuditLog(supabaseAdmin, {
        userInitials: user.initials,
        userName: user.name,
        entityType: 'tag',
        entityId: updated.id,
        action: 'updated',
        entityName: updated.name,
        changes: { before, after: updated },
        metadata: { tag_id: updated.id, tag_name: updated.name, color: updated.color }
      })

      return res.status(200).json({ data: updated })
    }

    if (req.method === 'DELETE') {
      const tagId = body?.id || req.query?.id
      if (!tagId) return res.status(400).json({ error: 'id_required' })

      const { data: existing } = await supabaseAdmin
        .from('tags')
        .select('id, name, color')
        .eq('id', tagId)
        .single()

      const { error } = await supabaseAdmin
        .from('tags')
        .delete()
        .eq('id', tagId)

      if (error) {
        console.error('Failed to delete tag:', error)
        return res.status(502).json({ error: 'supabase_delete_failed', message: error.message })
      }

      if (existing) {
        await createAuditLog(supabaseAdmin, {
          userInitials: user.initials,
          userName: user.name,
          entityType: 'tag',
          entityId: existing.id,
          action: 'deleted',
          entityName: existing.name,
          metadata: { tag_id: existing.id, tag_name: existing.name, color: existing.color }
        })
      }

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (err: any) {
    console.error('tags handler error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
