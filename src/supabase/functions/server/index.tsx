import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { cors } from 'https://deno.land/x/hono@v3.7.2/middleware.ts'
import { Hono } from 'https://deno.land/x/hono@v3.7.2/mod.ts'
import { logger } from 'https://deno.land/x/hono@v3.7.2/middleware.ts'
import * as kv from './kv_store.tsx'

const app = new Hono()

// Add CORS and logging middleware
app.use('*', cors({
  origin: '*',
  allowHeaders: ['*'],
  allowMethods: ['*'],
}))
app.use('*', logger(console.log))

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

// Routes for SAGA Storage System
app.get('/make-server-aaac77aa/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'SAGA Storage System API'
  })
})

// Container management routes
app.get('/make-server-aaac77aa/containers', async (c) => {
  try {
    // For now, use KV store until database tables are properly set up
    const containers = await kv.get('saga-containers') || []
    return c.json({ containers })
  } catch (error) {
    console.error('Server error fetching containers:', error)
    return c.json({ error: 'Internal server error', details: error.message }, 500)
  }
})

app.post('/make-server-aaac77aa/containers', async (c) => {
  try {
    const body = await c.req.json()
    const { container, userId } = body

    if (!container || !userId) {
      return c.json({ error: 'Container data and userId required' }, 400)
    }

    // Add timestamps and IDs
    const newContainer = {
      ...container,
      id: container.id || `container_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: userId,
      updated_by: userId
    }

    // Get existing containers
    const existingContainers = await kv.get('saga-containers') || []
    const updatedContainers = [...existingContainers, newContainer]

    // Save to KV store
    await kv.set('saga-containers', updatedContainers)

    // Create audit log
    await createAuditLogEntry('container_created', 'container', newContainer.id, userId, {
      description: `Container created: ${newContainer.name}`,
      containerType: newContainer.type,
      location: `${newContainer.location_freezer}${newContainer.location_rack ? '/' + newContainer.location_rack : ''}${newContainer.location_drawer ? '/' + newContainer.location_drawer : ''}`
    })

    return c.json({ container: newContainer })
  } catch (error) {
    console.error('Server error creating container:', error)
    return c.json({ error: 'Internal server error', details: error.message }, 500)
  }
})

app.put('/make-server-aaac77aa/containers/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const { container, userId } = body

    if (!container || !userId) {
      return c.json({ error: 'Container data and userId required' }, 400)
    }

    // Get existing containers
    const existingContainers = await kv.get('saga-containers') || []
    const containerIndex = existingContainers.findIndex((c: any) => c.id === id)

    if (containerIndex === -1) {
      return c.json({ error: 'Container not found' }, 404)
    }

    // Update container
    const oldContainer = existingContainers[containerIndex]
    const updatedContainer = {
      ...oldContainer,
      ...container,
      id,
      updated_at: new Date().toISOString(),
      updated_by: userId
    }

    existingContainers[containerIndex] = updatedContainer

    // Save to KV store
    await kv.set('saga-containers', existingContainers)

    // Create audit log
    await createAuditLogEntry('container_updated', 'container', id, userId, {
      description: `Container updated: ${updatedContainer.name}`,
      changes: getContainerChanges(oldContainer, updatedContainer)
    })

    return c.json({ container: updatedContainer })
  } catch (error) {
    console.error('Server error updating container:', error)
    return c.json({ error: 'Internal server error', details: error.message }, 500)
  }
})

app.delete('/make-server-aaac77aa/containers/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const userId = c.req.query('userId')

    if (!userId) {
      return c.json({ error: 'userId required' }, 400)
    }

    // Get existing containers
    const existingContainers = await kv.get('saga-containers') || []
    const containerToDelete = existingContainers.find((c: any) => c.id === id)

    if (!containerToDelete) {
      return c.json({ error: 'Container not found' }, 404)
    }

    // Remove container
    const updatedContainers = existingContainers.filter((c: any) => c.id !== id)

    // Save to KV store
    await kv.set('saga-containers', updatedContainers)

    // Create audit log
    await createAuditLogEntry('container_deleted', 'container', id, userId, {
      description: `Container deleted: ${containerToDelete.name}`,
      containerType: containerToDelete.type,
      sampleCount: containerToDelete.samples ? Object.keys(containerToDelete.samples).length : 0
    })

    return c.json({ success: true })
  } catch (error) {
    console.error('Server error deleting container:', error)
    return c.json({ error: 'Internal server error', details: error.message }, 500)
  }
})

// Container locking routes
app.post('/make-server-aaac77aa/containers/:id/lock', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const { userId, userName } = body

    if (!userId || !userName) {
      return c.json({ error: 'UserId and userName required' }, 400)
    }

    // Get container locks
    const locks = await kv.get('saga-container-locks') || {}

    // Check if already locked
    if (locks[id] && locks[id].userId !== userId) {
      return c.json({ error: 'Container is already locked by another user' }, 409)
    }

    // Lock container
    locks[id] = {
      userId,
      userName,
      lockedAt: new Date().toISOString()
    }

    await kv.set('saga-container-locks', locks)

    // Get updated container
    const containers = await kv.get('saga-containers') || []
    const container = containers.find((c: any) => c.id === id)

    if (container) {
      container.locked_by = userId
      container.locked_at = new Date().toISOString()
      await kv.set('saga-containers', containers)
    }

    return c.json({ container })
  } catch (error) {
    console.error('Server error locking container:', error)
    return c.json({ error: 'Internal server error', details: error.message }, 500)
  }
})

app.delete('/make-server-aaac77aa/containers/:id/lock', async (c) => {
  try {
    const id = c.req.param('id')
    const userId = c.req.query('userId')

    if (!userId) {
      return c.json({ error: 'userId required' }, 400)
    }

    // Get container locks
    const locks = await kv.get('saga-container-locks') || {}

    // Check if locked by this user
    if (locks[id] && locks[id].userId !== userId) {
      return c.json({ error: 'Container is locked by another user' }, 403)
    }

    // Remove lock
    delete locks[id]
    await kv.set('saga-container-locks', locks)

    // Get updated container
    const containers = await kv.get('saga-containers') || []
    const container = containers.find((c: any) => c.id === id)

    if (container) {
      container.locked_by = null
      container.locked_at = null
      await kv.set('saga-containers', containers)
    }

    return c.json({ container })
  } catch (error) {
    console.error('Server error unlocking container:', error)
    return c.json({ error: 'Internal server error', details: error.message }, 500)
  }
})

// User session management
app.post('/make-server-aaac77aa/sessions', async (c) => {
  try {
    const body = await c.req.json()
    const { userId, userName, activityType, containerId, metadata } = body

    const session = {
      user_id: userId,
      user_name: userName,
      activity_type: activityType,
      container_id: containerId,
      last_seen: new Date().toISOString(),
      status: 'active',
      metadata
    }

    // Get existing sessions
    const sessions = await kv.get('saga-user-sessions') || {}
    sessions[userId] = session

    // Clean up old sessions (older than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    Object.keys(sessions).forEach(key => {
      if (sessions[key].last_seen < fiveMinutesAgo) {
        delete sessions[key]
      }
    })

    await kv.set('saga-user-sessions', sessions)

    return c.json({ session })
  } catch (error) {
    console.error('Server error updating session:', error)
    return c.json({ error: 'Internal server error', details: error.message }, 500)
  }
})

app.get('/make-server-aaac77aa/sessions', async (c) => {
  try {
    const sessions = await kv.get('saga-user-sessions') || {}
    const sessionArray = Object.values(sessions)

    return c.json({ sessions: sessionArray })
  } catch (error) {
    console.error('Server error fetching sessions:', error)
    return c.json({ error: 'Internal server error', details: error.message }, 500)
  }
})

// Audit log routes
app.post('/make-server-aaac77aa/audit-logs', async (c) => {
  try {
    const body = await c.req.json()
    const { actionType, resourceType, resourceId, userId, userName, details, oldValues, newValues, metadata, severity, success } = body

    const auditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action_type: actionType,
      resource_type: resourceType,
      resource_id: resourceId,
      user_id: userId,
      user_name: userName,
      details,
      old_values: oldValues,
      new_values: newValues,
      metadata,
      severity: severity || 'low',
      success: success !== false,
      timestamp: new Date().toISOString()
    }

    // Get existing audit logs
    const auditLogs = await kv.get('saga-audit-logs') || []
    auditLogs.unshift(auditLog) // Add to beginning for most recent first

    // Keep only last 1000 logs to prevent unbounded growth
    if (auditLogs.length > 1000) {
      auditLogs.splice(1000)
    }

    await kv.set('saga-audit-logs', auditLogs)

    return c.json({ auditLog })
  } catch (error) {
    console.error('Server error creating audit log:', error)
    return c.json({ error: 'Internal server error', details: error.message }, 500)
  }
})

app.get('/make-server-aaac77aa/audit-logs', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '100')
    const offset = parseInt(c.req.query('offset') || '0')
    const resourceType = c.req.query('resourceType')
    const actionType = c.req.query('actionType')
    const userId = c.req.query('userId')
    const severity = c.req.query('severity')

    let logs = await kv.get('saga-audit-logs') || []

    // Apply filters
    if (resourceType) {
      logs = logs.filter((log: any) => log.resource_type === resourceType)
    }
    if (actionType) {
      logs = logs.filter((log: any) => log.action_type === actionType)
    }
    if (userId) {
      logs = logs.filter((log: any) => log.user_id === userId)
    }
    if (severity) {
      logs = logs.filter((log: any) => log.severity === severity)
    }

    // Apply pagination
    const paginatedLogs = logs.slice(offset, offset + limit)

    return c.json({ logs: paginatedLogs })
  } catch (error) {
    console.error('Server error fetching audit logs:', error)
    return c.json({ error: 'Internal server error', details: error.message }, 500)
  }
})

// Helper functions
async function createAuditLogEntry(actionType: string, resourceType: string, resourceId: string, userId: string, details: any) {
  try {
    const auditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action_type: actionType,
      resource_type: resourceType,
      resource_id: resourceId,
      user_id: userId,
      user_name: 'System User', // We could look this up if needed
      details,
      severity: 'low',
      success: true,
      timestamp: new Date().toISOString()
    }

    const auditLogs = await kv.get('saga-audit-logs') || []
    auditLogs.unshift(auditLog)

    if (auditLogs.length > 1000) {
      auditLogs.splice(1000)
    }

    await kv.set('saga-audit-logs', auditLogs)
  } catch (error) {
    console.error('Error creating audit log entry:', error)
  }
}

function getContainerChanges(oldContainer: any, newContainer: any) {
  const changes: any = {}
  
  const compareFields = ['name', 'type', 'sample_type', 'status', 'location_freezer', 'location_rack', 'location_drawer']
  
  compareFields.forEach(field => {
    if (oldContainer[field] !== newContainer[field]) {
      changes[field] = {
        from: oldContainer[field],
        to: newContainer[field]
      }
    }
  })

  // Check for sample changes
  const oldSampleCount = oldContainer.samples ? Object.keys(oldContainer.samples).length : 0
  const newSampleCount = newContainer.samples ? Object.keys(newContainer.samples).length : 0
  
  if (oldSampleCount !== newSampleCount) {
    changes.sampleCount = {
      from: oldSampleCount,
      to: newSampleCount
    }
  }

  return changes
}

console.log('SAGA Storage System API server starting...')
serve(app.fetch)