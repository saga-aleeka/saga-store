// Sample upsert endpoint - creates or updates samples without duplicates
const { createClient } = require('@supabase/supabase-js')

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

    const now = new Date().toISOString()

    // Check if sample already exists (active, non-archived) in ANY container
    const { data: existingActive, error: fetchError } = await supabaseAdmin
      .from('samples')
      .select('*')
      .eq('sample_id', sample_id.toUpperCase())
      .eq('is_archived', false)
      .order('created_at', { ascending: true })
      .limit(1)

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Fetch error:', fetchError)
      return res.status(500).json({ error: 'database_error' })
    }

    let result

    if (existingActive && existingActive.length > 0) {
      // Active sample exists - UPDATE it (move to new location)
      const sample = existingActive[0]
      
      // Prevent moving to same position in same container
      if (sample.container_id === container_id && sample.position === position) {
        return res.status(200).json({ data: sample, action: 'unchanged' })
      }
      
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
          updated_at: now
        })
        .eq('id', sample.id)
        .select()
        .single()

      if (updateError) {
        console.error('Update error:', updateError)
        return res.status(500).json({ error: 'update_failed', message: updateError.message })
      }

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
          sample_id: sample_id.toUpperCase(),
          container_id,
          position,
          data: newData,
          is_archived: false,
          created_at: now,
          updated_at: now
        })
        .select()
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        return res.status(500).json({ error: 'insert_failed', message: insertError.message })
      }

      result = { data: inserted, action: 'inserted' }
    }

    return res.status(200).json(result)
  }catch(err:any){
    console.error('sample upsert error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
