// Server-side sample management endpoint
// Handles sample updates, moves, and archiving with history tracking
const { createClient } = require('@supabase/supabase-js')
const { createAuditLog, getUserFromRequest } = require('../_audit_helper')
const { getRequestAuth } = require('../_auth_helper')

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

    const auth = await getRequestAuth(req, supabaseAdmin)
    const headerUser = getUserFromRequest(req)
    const user = headerUser.initials || auth.identity.initials || auth.identity.email || null

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

    if (!auth.isAuthenticated) {
      return res.status(401).json({ error: 'unauthorized' })
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
      const pendingAudits: any[] = []

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
        }

        // Queue audit (for both archive and unarchive)
        pendingAudits.push({
          userInitials: user,
          entityType: 'sample',
          entityId: sampleId,
          action: body.is_archived ? 'archived' : 'unarchived',
          entityName: current.sample_id,
          description: `Sample ${current.sample_id} ${body.is_archived ? 'archived' : 'unarchived'} from {container} ({position})`,
          metadata: {
            sample_id: current.sample_id,
            container_id: current.container_id || null,
            position: current.position || null,
            is_checked_out: current.is_checked_out || false,
            checked_out_by: current.checked_out_by || null
          }
        })
      }

      // Handle training status
      if ('is_training' in body) {
        updates.is_training = body.is_training

        // Queue audit
        pendingAudits.push({
          userInitials: user,
          entityType: 'sample',
          entityId: sampleId,
          action: body.is_training ? 'marked_training' : 'unmarked_training',
          entityName: current.sample_id,
          description: `Sample ${current.sample_id} ${body.is_training ? 'marked as training' : 'unmarked as training'} in {container} ({position})`,
          metadata: {
            sample_id: current.sample_id,
            container_id: current.container_id || null,
            position: current.position || null,
            is_checked_out: current.is_checked_out || false,
            checked_out_by: current.checked_out_by || null
          }
        })
      }

      // Handle explicit checkout/undo checkout actions
      if (body.action === 'checkout') {
        if (current.is_checked_out || !current.container_id || !current.position) {
          return res.status(409).json({ error: 'sample_not_checkout_eligible' })
        }

        const historyEvent = {
          when: now,
          action: 'checked_out',
          user: user || 'unknown',
          source: 'manual_edit',
          from_container: current.container_id,
          from_position: current.position
        }

        updates.is_checked_out = true
        updates.checked_out_at = now
        updates.checked_out_by = user || current.checked_out_by || 'unknown'
        updates.previous_container_id = current.container_id
        updates.previous_position = current.position
        updates.container_id = null
        updates.position = null
        updates.data = {
          ...currentData,
          history: [...(updates.data?.history || currentHistory), historyEvent]
        }

        pendingAudits.push({
          userInitials: user,
          entityType: 'sample',
          entityId: sampleId,
          action: 'checked_out',
          entityName: current.sample_id,
          description: `Sample ${current.sample_id} checked out from {container} ({position})`,
          metadata: {
            sample_id: current.sample_id,
            previous_container_id: current.container_id,
            previous_position: current.position,
            is_checked_out: true,
            checked_out_by: user || current.checked_out_by || 'unknown'
          }
        })
      }

      if (body.action === 'undo_checkout') {
        if (!current.is_checked_out || !current.previous_container_id || !current.previous_position) {
          return res.status(409).json({ error: 'sample_not_restore_eligible' })
        }

        const historyEvent = {
          when: now,
          action: 'checked_in',
          user: user || 'unknown',
          source: 'manual_edit',
          to_container: current.previous_container_id,
          to_position: current.previous_position
        }

        updates.container_id = current.previous_container_id
        updates.position = current.previous_position
        updates.is_checked_out = false
        updates.checked_out_at = null
        updates.checked_out_by = null
        updates.previous_container_id = null
        updates.previous_position = null
        updates.data = {
          ...currentData,
          history: [...(updates.data?.history || currentHistory), historyEvent]
        }

        pendingAudits.push({
          userInitials: user,
          entityType: 'sample',
          entityId: sampleId,
          action: 'checked_in',
          entityName: current.sample_id,
          description: `Sample ${current.sample_id} checked back in to {container} ({position})`,
          metadata: {
            sample_id: current.sample_id,
            container_id: current.previous_container_id,
            position: current.previous_position,
            is_checked_out: false
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

        // Queue audit
        pendingAudits.push({
          userInitials: user,
          entityType: 'sample',
          entityId: sampleId,
          action: 'moved',
          entityName: current.sample_id,
          description: `Sample ${current.sample_id} moved from {from_container} ({from_position}) > {to_container} ({to_position})`,
          metadata: {
            sample_id: current.sample_id,
            from_container: current.container_id || null,
            from_position: current.position || null,
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

      for (const audit of pendingAudits) {
        await createAuditLog(supabaseAdmin, audit)
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
          description: `Sample ${sample.sample_id} permanently deleted from {container} ({position})`,
          metadata: {
            sample_id: sample.sample_id,
            container_id: sample.container_id || null,
            position: sample.position || null,
            is_checked_out: sample.is_checked_out || false,
            checked_out_by: sample.checked_out_by || null,
            previous_container_id: sample.previous_container_id || null,
            previous_position: sample.previous_position || null
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
