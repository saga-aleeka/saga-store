// Dynamic route handler for /api/containers/:id
// Handles GET, PUT, PATCH, DELETE for a specific container
const { createClient } = require('@supabase/supabase-js')
const { createAuditLog, getUserFromRequest } = require('../_audit_helper')

module.exports = async function handler(req: any, res: any){
  try{
    console.log('containers/[id] handler called:', req.method, req.url, req.query)
    
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    const ADMIN_SECRET = process.env.ADMIN_SECRET

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured', message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get ID from query parameter (Vercel passes it as req.query.id)
    const id = req.query?.id

    if (!id) {
      return res.status(400).json({ error: 'missing_id' })
    }

    // Helper to validate admin credentials
    const providedSecret = req.headers['x-admin-secret'] || req.headers['x_admin_secret']
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || ''
    let isAdmin = false
    if (ADMIN_SECRET && providedSecret && String(providedSecret) === String(ADMIN_SECRET)) isAdmin = true
    const m = String(authHeader || '').match(/^Bearer\s+(.+)$/i)
    const clientToken = m ? m[1] : null
    
    console.log('Auth check:', { hasSecret: !!providedSecret, hasToken: !!clientToken, tokenLength: clientToken?.length })
    
    if (!isAdmin && clientToken && clientToken.length > 0 && clientToken !== 'null' && clientToken !== 'undefined'){
      try {
        const { data: found, error: chkError } = await supabaseAdmin
          .from('authorized_users')
          .select('*')
          .eq('token', clientToken)
          .limit(1)

        if (chkError) {
          console.error('Token check Supabase error:', chkError.message)
        } else if (found && found.length > 0) {
          isAdmin = true
          console.log('Token validated successfully')
        }
      } catch (tokenCheckError: any) {
        console.error('Token validation error:', tokenCheckError)
      }
    }

    // GET single container with samples
    if (req.method === 'GET'){
      const { data, error } = await supabaseAdmin
        .from('containers')
        .select('*,samples!samples_container_id_fkey(*)')
        .eq('id', id)
        .limit(1)

      if (error) return res.status(502).json({ error: 'supabase_container_fetch_failed', message: error.message })
      if (!data || data.length === 0) return res.status(404).json({ error: 'not_found' })
      return res.status(200).json({ data: data[0] })
    }

    // For modifications require admin credentials
    if (!isAdmin) {
      console.log('Not admin, rejecting request')
      return res.status(401).json({ error: 'missing_admin_credentials' })
    }

    // Update container
    if (req.method === 'PUT' || req.method === 'PATCH'){
      let body: any = req.body
      try{ if (!body && req.json) body = await req.json() }catch(e){}
      
      console.log('Updating container:', id, 'with body:', JSON.stringify(body))
      
      // Get original data for audit log
      const { data: original } = await supabaseAdmin
        .from('containers')
        .select('*')
        .eq('id', id)
        .single()
      
      const { data, error } = await supabaseAdmin
        .from('containers')
        .update(body)
        .eq('id', id)
        .select()

      if (error) {
        console.error('Update error:', error)
        return res.status(502).json({ error: 'supabase_update_failed', message: error.message })
      }
      
      // Create audit log
      const user = getUserFromRequest(req)
      console.log('User from update request:', user)
      if (data && data[0] && original) {
        console.log('Creating audit log for container update:', data[0].id)
        const changes: any = {}
        const changedFields: string[] = []
        
        // Track what changed
        if (original.name !== data[0].name) {
          changes.name = { from: original.name, to: data[0].name }
          changedFields.push('name')
        }
        if (original.location !== data[0].location) {
          changes.location = { from: original.location, to: data[0].location }
          changedFields.push('location')
        }
        if (original.archived !== data[0].archived) {
          changes.archived = { from: original.archived, to: data[0].archived }
          changedFields.push(data[0].archived ? 'archived' : 'unarchived')
        }
        if (original.layout !== data[0].layout) {
          changes.layout = { from: original.layout, to: data[0].layout }
          changedFields.push('layout')
        }
        if (original.temperature !== data[0].temperature) {
          changes.temperature = { from: original.temperature, to: data[0].temperature }
          changedFields.push('temperature')
        }
        if (original.type !== data[0].type) {
          changes.type = { from: original.type, to: data[0].type }
          changedFields.push('type')
        }
        if (original.training !== data[0].training) {
          changes.training = { from: original.training, to: data[0].training }
          changedFields.push('training')
        }
        if (original.cold_storage_id !== data[0].cold_storage_id) {
          changes.cold_storage_id = { from: original.cold_storage_id, to: data[0].cold_storage_id }
          changedFields.push('cold_storage_id')
        }
        if (original.rack_id !== data[0].rack_id) {
          changes.rack_id = { from: original.rack_id, to: data[0].rack_id }
          changedFields.push('rack_id')
        }
        if (original.rack_position !== data[0].rack_position) {
          changes.rack_position = { from: original.rack_position, to: data[0].rack_position }
          changedFields.push('rack_position')
        }
        
        const action = data[0].archived && !original.archived ? 'archived' : 
                      !data[0].archived && original.archived ? 'unarchived' : 'updated'
        
        await createAuditLog(supabaseAdmin, {
          userInitials: user.initials,
          userName: user.name,
          entityType: 'container',
          entityId: data[0].id,
          action,
          entityName: data[0].name,
          changes,
          metadata: {
            location: data[0].location,
            layout: data[0].layout,
            temperature: data[0].temperature,
            type: data[0].type,
            cold_storage_id: data[0].cold_storage_id,
            rack_id: data[0].rack_id,
            rack_position: data[0].rack_position
          },
          description: `Updated container "${data[0].name}": ${changedFields.join(', ')}`
        })
      }
      
      console.log('Update successful')
      return res.status(200).json({ data })
    }

    // Delete container
    if (req.method === 'DELETE'){
      // Get container info before deletion for audit log
      const { data: containerData } = await supabaseAdmin
        .from('containers')
        .select('*')
        .eq('id', id)
        .single()

      // Get sample count before deletion
      const { data: samples } = await supabaseAdmin
        .from('samples')
        .select('id')
        .eq('container_id', id)

      // Delete samples first
      const { error: samplesError } = await supabaseAdmin
        .from('samples')
        .delete()
        .eq('container_id', id)

      if (samplesError) {
        console.error('Delete samples error:', samplesError)
        return res.status(502).json({ error: 'supabase_delete_samples_failed', message: samplesError.message })
      }

      // Then delete the container
      const { error } = await supabaseAdmin
        .from('containers')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Delete container error:', error)
        return res.status(502).json({ error: 'supabase_delete_failed', message: error.message })
      }

      // Create audit log
      const user = getUserFromRequest(req)
      console.log('User from delete request:', user)
      if (containerData) {
        console.log('Creating audit log for container deletion:', id)
        await createAuditLog(supabaseAdmin, {
          userInitials: user.initials,
          userName: user.name,
          entityType: 'container',
          entityId: id,
          action: 'deleted',
          entityName: containerData.name,
          metadata: {
            location: containerData.location,
            layout: containerData.layout,
            samples_deleted: samples?.length || 0
          },
          description: `Deleted container "${containerData.name}" with ${samples?.length || 0} samples`
        })
      }

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err:any){
    console.error('containers/[id] error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
