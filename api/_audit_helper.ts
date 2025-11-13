// Helper function to create audit log entries
export async function createAuditLog(supabaseAdmin: any, params: {
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
    const insert = {
      user_initials: params.userInitials ?? null,
      user_name: params.userName ?? null,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      action: params.action,
      entity_name: params.entityName ?? null,
      changes: params.changes ?? null,
      metadata: params.metadata ?? null,
      description: params.description ?? null
    }

    const { error } = await supabaseAdmin
      .from('audit_logs')
      .insert([insert])

    if (error) {
      console.error('Failed to create audit log:', error)
    }
  } catch (err) {
    console.error('Audit log creation error:', err)
  }
}

// Extract user info from request headers
export function getUserFromRequest(req: any): { initials?: string, name?: string } {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || ''
  const userInitials = req.headers['x-user-initials'] || req.headers['x_user_initials'] || null
  const userName = req.headers['x-user-name'] || req.headers['x_user_name'] || null
  
  return {
    initials: userInitials,
    name: userName
  }
}
