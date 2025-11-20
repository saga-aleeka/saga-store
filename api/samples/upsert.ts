// Sample upsert endpoint - creates or updates samples without duplicates
const { createClient } = require('@supabase/supabase-js')
const { createAuditLog, getUserFromRequest } = require('../_audit_helper')

module.exports = async function handler(req: any, res: any){
  try{
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured' })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
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

    let body: any = req.body
    try{ if (!body && req.json) body = await req.json() }catch(e){}

    const { sample_id, container_id, position, data: sampleData } = body
    
    if (!sample_id) {
      return res.status(400).json({ error: 'sample_id_required' })
    }
    
    if (!container_id || !position) {
      return res.status(400).json({ error: 'container_id_and_position_required' })
    }

    // Normalize sample_id: trim whitespace and uppercase
    const normalizedSampleId = String(sample_id).trim().toUpperCase()
    
    if (!normalizedSampleId) {
      return res.status(400).json({ error: 'sample_id_required' })
    }

    console.log(`[UPSERT] Attempting to upsert sample: "${normalizedSampleId}" to container ${container_id} at position ${position}`)

    const now = new Date().toISOString()

    // Check if sample already exists (active, non-archived) in ANY container
    // Use exact match with explicit trim to ensure no false positives
    const { data: existingActive, error: fetchError } = await supabaseAdmin
      .from('samples')
      .select('*')
      .eq('sample_id', normalizedSampleId)
      .eq('is_archived', false)
      .order('created_at', { ascending: true })
      .limit(10)  // Get more to check for issues

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Fetch error:', fetchError)
      return res.status(500).json({ error: 'database_error' })
    }

    // Filter to ensure EXACT match (in case database has case-sensitivity issues)
    const exactMatches = (existingActive || []).filter(s => 
      String(s.sample_id).trim().toUpperCase() === normalizedSampleId
    )

    console.log(`[UPSERT] Found ${existingActive?.length || 0} potential matches, ${exactMatches.length} exact matches for "${normalizedSampleId}"`)
    if (exactMatches.length > 0) {
      console.log(`[UPSERT] Existing sample found:`, {
        id: exactMatches[0].id,
        sample_id: exactMatches[0].sample_id,
        container_id: exactMatches[0].container_id,
        position: exactMatches[0].position
      })
    }

    let result

    if (exactMatches.length > 0) {
      // Active sample exists - UPDATE it (move to new location)
      const sample = exactMatches[0]
      
      // Prevent moving to same position in same container
      if (sample.container_id === container_id && sample.position === position) {
        console.log(`[UPSERT] Sample "${normalizedSampleId}" already at target position, no change needed`)
        return res.status(200).json({ data: sample, action: 'unchanged' })
      }
      
      console.log(`[UPSERT] Moving sample "${normalizedSampleId}" from ${sample.container_id}/${sample.position} to ${container_id}/${position}`)
      
      const currentData = sample.data || {}
      const currentHistory = currentData.history || []

      const historyEvent = {
        when: now,
        action: 'moved',
        user: user || 'unknown',
        source: 'grid_edit',
        from_container: sample.container_id,
        from_position: sample.position,
        to_container: container_id,
        to_position: position
      }

      const updatedData = {
        ...currentData,
        ...sampleData,
        history: [...currentHistory, historyEvent]
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('samples')
        .update({
          container_id,
          position,
          data: updatedData,
          updated_at: now,
          is_checked_out: false,
          checked_out_at: null,
          checked_out_by: null,
          previous_container_id: null,
          previous_position: null
        })
        .eq('id', sample.id)
        .select()
        .single()

      if (updateError) {
        console.error('Update error:', updateError)
        return res.status(500).json({ error: 'update_failed', message: updateError.message })
      }

      console.log(`[UPSERT] Successfully moved sample "${normalizedSampleId}"`)
      
      // Log to audit
      await createAuditLog(supabaseAdmin, {
        userInitials: user,
        entityType: 'sample',
        entityId: updated.id,
        action: 'moved',
        entityName: normalizedSampleId,
        description: `Sample ${normalizedSampleId} moved`,
        metadata: {
          from_container: sample.container_id,
          from_position: sample.position,
          to_container: container_id,
          to_position: position,
          source: 'grid_edit'
        }
      })
      
      result = { data: updated, action: 'moved' }
    } else {
      // No active sample exists - INSERT new one
      // Archived samples with same ID are left untouched and can coexist
      const historyEvent = {
        when: now,
        action: 'inserted',
        user: user || 'unknown',
        source: 'grid_edit',
        to_container: container_id,
        to_position: position
      }

      const newData = {
        ...sampleData,
        history: [historyEvent]
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('samples')
        .insert({
          sample_id: normalizedSampleId,
          container_id,
          position,
          data: newData,
          is_archived: false,
          is_checked_out: false,
          checked_out_at: null,
          checked_out_by: null,
          previous_container_id: null,
          previous_position: null,
          created_at: now,
          updated_at: now
        })
        .select()
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        return res.status(500).json({ error: 'insert_failed', message: insertError.message })
      }

      console.log(`[UPSERT] Inserted new sample "${normalizedSampleId}" at ${container_id}/${position}`)
      
      // Log to audit
      await createAuditLog(supabaseAdmin, {
        userInitials: user,
        entityType: 'sample',
        entityId: inserted.id,
        action: 'created',
        entityName: normalizedSampleId,
        description: `Sample ${normalizedSampleId} created`,
        metadata: {
          container_id: container_id,
          position: position,
          source: 'grid_edit'
        }
      })
      
      result = { data: inserted, action: 'inserted' }
    }

    return res.status(200).json(result)
  }catch(err:any){
    console.error('sample upsert error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
