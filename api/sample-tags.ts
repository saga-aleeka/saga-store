export {}
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

    let body: any = req.body
    try { if (!body && req.json) body = await req.json() } catch (e) {}

    const sampleId = body?.sample_id
    const tagId = body?.tag_id

    if (!sampleId || !tagId) {
      return res.status(400).json({ error: 'sample_id_and_tag_id_required' })
    }

    const { data: sample } = await supabaseAdmin
      .from('samples')
      .select('id, sample_id')
      .eq('id', sampleId)
      .single()

    const { data: tag } = await supabaseAdmin
      .from('tags')
      .select('id, name, color')
      .eq('id', tagId)
      .single()

    if (req.method === 'POST') {
      const { error } = await supabaseAdmin
        .from('sample_tags')
        .upsert({
          sample_id: sampleId,
          tag_id: tagId,
          created_by: user.initials || null
        }, { onConflict: 'sample_id,tag_id' })

      if (error) {
        console.error('Failed to add tag to sample:', error)
        return res.status(502).json({ error: 'supabase_insert_failed', message: error.message })
      }

      await createAuditLog(supabaseAdmin, {
        userInitials: user.initials,
        userName: user.name,
        entityType: 'sample',
        entityId: sample?.id || sampleId,
        action: 'tag_added',
        entityName: sample?.sample_id,
        metadata: {
          sample_id: sample?.sample_id,
          tag_id: tag?.id || tagId,
          tag_name: tag?.name,
          tag_color: tag?.color
        },
        description: tag?.name ? `Tag "${tag.name}" added` : 'Tag added'
      })

      return res.status(201).json({ success: true })
    }

    if (req.method === 'DELETE') {
      const { error } = await supabaseAdmin
        .from('sample_tags')
        .delete()
        .eq('sample_id', sampleId)
        .eq('tag_id', tagId)

      if (error) {
        console.error('Failed to remove tag from sample:', error)
        return res.status(502).json({ error: 'supabase_delete_failed', message: error.message })
      }

      await createAuditLog(supabaseAdmin, {
        userInitials: user.initials,
        userName: user.name,
        entityType: 'sample',
        entityId: sample?.id || sampleId,
        action: 'tag_removed',
        entityName: sample?.sample_id,
        metadata: {
          sample_id: sample?.sample_id,
          tag_id: tag?.id || tagId,
          tag_name: tag?.name,
          tag_color: tag?.color
        },
        description: tag?.name ? `Tag "${tag.name}" removed` : 'Tag removed'
      })

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (err: any) {
    console.error('sample-tags handler error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
