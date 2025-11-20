// Server-side sample management endpoint
// Handles sample updates, moves, and archiving with history tracking
const { createClient } = require('@supabase/supabase-js')
const { createAuditLog, getUserFromRequest } = require('../_audit_helper')

module.exports = async function handler(req: any, res: any){
  try{
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured' })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Extract sample ID from URL path
    const pathParts = req.url?.split('/') || []
    const sampleId = pathParts[pathParts.length - 1]?.split('?')[0]
    
    if (!sampleId || sampleId === 'samples') {
      return res.status(400).json({ error: 'sample_id_required' })
    }

    // Validate auth token
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || ''
    const m = String(authHeader).match(/^Bearer\s+(.+)$/i)
    const token = m ? m[1] : null
    
    let user = null
    if (token) {
      const { data: users } = await supabaseAdmin
        .from('authorized_users')
        .select('initials')
        .eq('token', token)
        .limit(1)
      
      if (users && users.length > 0) {
        user = users[0].initials
      }
    }

    if (req.method === 'GET') {
      // Get sample details
      const { data, error } = await supabaseAdmin
        .from('samples')
        .select('*')
        .eq('id', sampleId)
        .single()

      if (error) return res.status(404).json({ error: 'sample_not_found' })
      return res.status(200).json({ data })
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      // Update sample
      let body: any = req.body
      try{ if (!body && req.json) body = await req.json() }catch(e){}

      // Get current sample
      const { data: current, error: fetchError } = await supabaseAdmin
        .from('samples')
        .select('*')
        .eq('id', sampleId)
        .single()

      if (fetchError) return res.status(404).json({ error: 'sample_not_found' })

      // Prepare update with history
      const now = new Date().toISOString()
      const currentData = current.data || {}
      const currentHistory = currentData.history || []

      const updates: any = {
        updated_at: now
      }

      // Handle archiving
      if ('is_archived' in body) {
        updates.is_archived = body.is_archived
        
        if (body.is_archived) {
          const historyEvent = {
            when: now,
            action: 'archived',
            user: user || 'unknown',
            source: 'manual_edit'
          }
          updates.data = {
            ...currentData,
            history: [...currentHistory, historyEvent]
          }
          
          // Log to audit
          await createAuditLog(supabaseAdmin, {
            userInitials: user,
            entityType: 'sample',
            entityId: sampleId,
            action: body.is_archived ? 'archived' : 'unarchived',
            entityName: current.sample_id,
            description: `Sample ${current.sample_id} ${body.is_archived ? 'archived' : 'unarchived'}`,
            metadata: {
              container_id: current.container_id,
              position: current.position
            }
          })
        }
      }

      // Handle training status
      if ('is_training' in body) {
        updates.is_training = body.is_training
        
        // Log to audit
        await createAuditLog(supabaseAdmin, {
          userInitials: user,
          entityType: 'sample',
          entityId: sampleId,
          action: body.is_training ? 'marked_training' : 'unmarked_training',
          entityName: current.sample_id,
          description: `Sample ${current.sample_id} ${body.is_training ? 'marked as training' : 'unmarked as training'}`,
          metadata: {
            container_id: current.container_id,
            position: current.position
          }
        })
      }

      // Handle position/container movement
      if (body.container_id || body.position) {
        const historyEvent: any = {
          when: now,
          action: 'moved',
          user: user || 'unknown',
          source: 'manual_edit',
          from_container: current.container_id,
          from_position: current.position
        }

        if (body.container_id) {
          updates.container_id = body.container_id
          historyEvent.to_container = body.container_id
        }

        if (body.position) {
          updates.position = body.position
          historyEvent.to_position = body.position
        }

        updates.data = {
          ...currentData,
          history: [...currentHistory, historyEvent]
        }
        
        // Log to audit
        await createAuditLog(supabaseAdmin, {
          userInitials: user,
          entityType: 'sample',
          entityId: sampleId,
          action: 'moved',
          entityName: current.sample_id,
          description: `Sample ${current.sample_id} moved`,
          metadata: {
            from_container: current.container_id,
            from_position: current.position,
            to_container: body.container_id || current.container_id,
            to_position: body.position || current.position
          }
        })
      }

      // Handle other data updates
      if (body.data) {
        updates.data = {
          ...currentData,
          ...body.data,
          history: updates.data?.history || currentHistory
        }
      }

      // Perform update
      const { data, error } = await supabaseAdmin
        .from('samples')
        .update(updates)
        .eq('id', sampleId)
        .select()
        .single()

      if (error) {
        console.error('Sample update error:', error)
        return res.status(500).json({ error: 'update_failed', message: error.message })
      }

      return res.status(200).json({ data })
    }

    if (req.method === 'DELETE') {
      // Get sample info before deletion for audit log
      const { data: sample } = await supabaseAdmin
        .from('samples')
        .select('*')
        .eq('id', sampleId)
        .single()
      
      // Hard delete (use with caution)
      const { error } = await supabaseAdmin
        .from('samples')
        .delete()
        .eq('id', sampleId)

      if (error) {
        return res.status(500).json({ error: 'delete_failed', message: error.message })
      }
      
      // Log to audit
      if (sample) {
        await createAuditLog(supabaseAdmin, {
          userInitials: user,
          entityType: 'sample',
          entityId: sampleId,
          action: 'deleted',
          entityName: sample.sample_id,
          description: `Sample ${sample.sample_id} permanently deleted`,
          metadata: {
            container_id: sample.container_id,
            position: sample.position
          }
        })
      }

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err:any){
    console.error('samples handler error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
