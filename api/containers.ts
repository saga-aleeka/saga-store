// Serverless endpoint to manage `containers` table in Supabase.
// Supports:
// - GET /api/containers[?archived=true] -> list containers (filters by archived)
// - GET /api/containers/:id -> get container with samples embedded
// - POST /api/containers -> create container (requires admin secret or valid bearer token)
// - PUT/PATCH /api/containers/:id -> update container (requires admin secret or valid bearer token)
// - DELETE /api/containers/:id -> delete container and its samples (requires admin secret or valid bearer token)
const { createClient } = require('@supabase/supabase-js')
const { createAuditLog, getUserFromRequest } = require('./_audit_helper')

module.exports = async function handler(req: any, res: any){
  try{
    console.log('containers handler called:', req.method, req.url)
    
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    const ADMIN_SECRET = process.env.ADMIN_SECRET

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'server_misconfigured', message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Helper to validate admin credentials: either ADMIN_SECRET or a Bearer token that exists in authorized_users
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
        // Continue without admin access
      }
    }

    // GET list
    if (req.method === 'GET' && !req.url.match(/\/api\/containers\/[A-Za-z0-9_-]+$/)){
      const archived = req.query?.archived || (req.url && new URL(req.url, 'http://localhost').searchParams.get('archived'))
      
      let query = supabaseAdmin.from('containers').select('*')
      if (archived === 'true' || archived === true) {
        query = query.eq('archived', true)
      } else {
        query = query.eq('archived', false)
      }
      query = query.order('updated_at', { ascending: false })

      const { data, error } = await query
      if (error) return res.status(502).json({ error: 'supabase_list_failed', message: error.message })
      return res.status(200).json({ data: data ?? [] })
    }

    // GET single container with samples
    if (req.method === 'GET' && req.url && req.url.match(/\/api\/containers\/[A-Za-z0-9_-]+$/)){
      const parts = req.url.split('/')
      const id = parts[parts.length - 1]
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
    if (!isAdmin) return res.status(401).json({ error: 'missing_admin_credentials' })

    // Create container
    if (req.method === 'POST'){
      let body: any = req.body
      try{ if (!body && req.json) body = await req.json() }catch(e){}
      
      console.log('Creating container with body:', JSON.stringify(body))
      
      const insert = {
        id: body?.id ?? undefined,
        name: body?.name ?? null,
        location: body?.location ?? null,
        cold_storage_id: body?.cold_storage_id ?? null,
        rack_id: body?.rack_id ?? null,
        rack_position: body?.rack_position ?? null,
        layout: body?.layout ?? null,
        total: body?.total ?? null,
        used: body?.used ?? 0,
        archived: body?.archived ?? body?.is_archived ?? false,
        temperature: body?.temperature ?? null,
        type: body?.type ?? null,
        training: body?.training ?? false
      }
      
      console.log('Insert object:', JSON.stringify(insert))
      
      const { data, error } = await supabaseAdmin
        .from('containers')
        .insert([insert])
        .select()

      console.log('Insert result:', { hasData: !!data, error: error?.message })

      if (error) {
        console.error('Supabase insert error:', error)
        return res.status(502).json({ error: 'supabase_insert_failed', message: error.message })
      }
      
      // Create audit log
      const user = getUserFromRequest(req)
      console.log('User from request:', user)
      if (data && data[0]) {
        console.log('Creating audit log for new container:', data[0].id)
        await createAuditLog(supabaseAdmin, {
          userInitials: user.initials,
          userName: user.name,
          entityType: 'container',
          entityId: data[0].id,
          action: 'created',
          entityName: data[0].name,
          metadata: {
            location: data[0].location,
            layout: data[0].layout,
            temperature: data[0].temperature,
            type: data[0].type,
            cold_storage_id: data[0].cold_storage_id,
            rack_id: data[0].rack_id,
            rack_position: data[0].rack_position
          },
          description: `Created container "${data[0].name}" at ${data[0].location}`
        })
      }
      
      console.log('Returning success response')
      res.status(201).json({ data })
      return
    }

    // Update container
    if (req.method === 'PUT' || req.method === 'PATCH'){
      let body: any = req.body
      try{ if (!body && req.json) body = await req.json() }catch(e){}
      // Determine id from url
      const parts = req.url.split('/')
      const id = parts[parts.length - 1]
      if (!id) return res.status(400).json({ error: 'missing_id' })
      
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

      if (error) return res.status(502).json({ error: 'supabase_update_failed', message: error.message })
      
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
      
      return res.status(200).json({ data })
    }

    // Delete container
    if (req.method === 'DELETE'){
      const parts = req.url.split('/')
      const id = parts[parts.length - 1]
      if (!id) return res.status(400).json({ error: 'missing_id' })

      // Get container info before deletion for audit log
      const { data: containerData } = await supabaseAdmin
        .from('containers')
        .select('*')
        .eq('id', id)
        .single()

      // Get sample count before deletion
      const { data: samples } = await supabaseAdmin
        .from('samples')
        .select('id, sample_id')
        .eq('container_id', id)

      // First delete all samples in this container
      const { error: samplesError } = await supabaseAdmin
        .from('samples')
        .delete()
        .eq('container_id', id)

      if (samplesError) {
        console.error('Failed to delete samples:', samplesError)
        return res.status(502).json({ error: 'supabase_delete_samples_failed', message: samplesError.message })
      }

      // Then delete the container
      const { error: containerError } = await supabaseAdmin
        .from('containers')
        .delete()
        .eq('id', id)

      if (containerError) {
        console.error('Failed to delete container:', containerError)
        return res.status(502).json({ error: 'supabase_delete_container_failed', message: containerError.message })
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
            temperature: containerData.temperature,
            type: containerData.type,
            samples_deleted: samples?.length ?? 0
          },
          description: `Deleted container "${containerData.name}" from ${containerData.location} (${samples?.length ?? 0} samples removed)`
        })
      }

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  }catch(err:any){
    console.error('containers handler error', err)
    console.error('Error details:', { message: err?.message, stack: err?.stack, name: err?.name })
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
