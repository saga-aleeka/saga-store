// Helper function to create audit log entries
async function createAuditLog(supabaseAdmin: any, params: {
  userInitials?: string | null
  userName?: string | null
  entityType: 'container' | 'sample'
  entityId?: string | null
  action: string
  entityName?: string | null
  changes?: any
  metadata?: any
  description?: string | null
}) {
  try {
    // Fetch container names for any container IDs in metadata
    let enhancedMetadata = params.metadata ? { ...params.metadata } : {}
    
    if (params.metadata) {
      const containerIds = new Set<string>()
      
      // Collect all container IDs from metadata
      if (params.metadata.container_id) containerIds.add(params.metadata.container_id)
      if (params.metadata.previous_container_id) containerIds.add(params.metadata.previous_container_id)
      if (params.metadata.from_container) containerIds.add(params.metadata.from_container)
      if (params.metadata.to_container) containerIds.add(params.metadata.to_container)
      
      // Fetch container names in batch
      if (containerIds.size > 0) {
        const { data: containers } = await supabaseAdmin
          .from('containers')
          .select('id, name')
          .in('id', Array.from(containerIds))
        
        const containerMap = new Map(containers?.map((c: any) => [c.id, c.name]) || [])
        
        // Add container names to metadata
        if (params.metadata.container_id) {
          enhancedMetadata.container_name = containerMap.get(params.metadata.container_id) || params.metadata.container_id
        }
        if (params.metadata.previous_container_id) {
          enhancedMetadata.previous_container_name = containerMap.get(params.metadata.previous_container_id) || params.metadata.previous_container_id
        }
        if (params.metadata.from_container) {
          enhancedMetadata.from_container_name = containerMap.get(params.metadata.from_container) || params.metadata.from_container
        }
        if (params.metadata.to_container) {
          enhancedMetadata.to_container_name = containerMap.get(params.metadata.to_container) || params.metadata.to_container
        }
      }
    }

    const insert = {
      user_initials: params.userInitials ?? null,
      user_name: params.userName ?? null,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      action: params.action,
      entity_name: params.entityName ?? null,
      changes: params.changes ?? null,
      metadata: enhancedMetadata,
      description: params.description ?? null
    }

    console.log('Creating audit log:', insert)

    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .insert([insert])
      .select()

    if (error) {
      console.error('Failed to create audit log:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
    } else {
      console.log('Audit log created successfully:', data)
    }
  } catch (err) {
    console.error('Audit log creation error:', err)
  }
}

// Extract user info from request headers
function getUserFromRequest(req: any): { initials?: string, name?: string } {
  const userInitials = req.headers['x-user-initials'] || req.headers['x_user_initials'] || null
  const userName = req.headers['x-user-name'] || req.headers['x_user_name'] || null
  
  return {
    initials: userInitials,
    name: userName
  }
}

module.exports = { createAuditLog, getUserFromRequest }
