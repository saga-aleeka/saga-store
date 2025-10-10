// --- Helper functions and type maps ---
const frontendToDbType: Record<string, string> = {
  '9x9-box': 'box_9x9',
  '5x5-box': 'box_5x5',
  '5x4-rack': 'rack_5x4',
  '9x9-rack': 'rack_9x9',
  '7x14-rack': 'rack_7x14',
};

const totalSlotToDbType: Record<number, string> = {
  81: 'box_9x9',
  25: 'box_5x5',
  20: 'rack_5x4',
  63: 'rack_7x14',
};

function resolveDbType(container: any): string | undefined {
  // Prefer the frontend-provided containerType when available (e.g. '5x5-box').
  // Fall back to DB 'type' if present.
  const rawType = container?.containerType ?? container?.type;
  if (typeof rawType === 'string' && rawType) {
    return frontendToDbType[rawType] || rawType;
  }
  const totalSlots = Number(container?.total_slots ?? container?.totalSlots);
  if (!Number.isNaN(totalSlots) && totalSlotToDbType[totalSlots]) {
    return totalSlotToDbType[totalSlots];
  }
  const occupiedSlots = Number(
    container?.occupied_slots ??
      container?.occupiedSlots ??
      (Array.isArray(container?.samples) ? container.samples.length : undefined)
  );
  if (!Number.isNaN(occupiedSlots) && totalSlotToDbType[occupiedSlots]) {
    return totalSlotToDbType[occupiedSlots];
  }
  return undefined;
}

function normaliseContainerPayload(container: any) {
  if (!container || typeof container !== 'object') {
    return {};
  }
  const payload: Record<string, any> = { ...container };
  const resolvedType = resolveDbType(payload);
  if (resolvedType) {
    payload.type = resolvedType;
  }
  if ('sampleType' in payload && !payload.sample_type) {
    const sampleTypeValue = payload.sampleType;
    if (typeof sampleTypeValue === 'string' && sampleTypeValue) {
      payload.sample_type = sampleTypeValue;
    }
  }
  if ('location' in payload && payload.location_freezer === undefined) {
    payload.location_freezer = payload.location;
  }
  if (payload.occupiedSlots !== undefined && payload.occupied_slots === undefined) {
    payload.occupied_slots = payload.occupiedSlots;
  }
  if (payload.totalSlots !== undefined && payload.total_slots === undefined) {
    payload.total_slots = payload.totalSlots;
  }
  if (payload.isTraining !== undefined && payload.is_training === undefined) {
    payload.is_training = payload.isTraining;
  }
  if (payload.isArchived !== undefined && payload.is_archived === undefined) {
    payload.is_archived = payload.isArchived;
  }
  if (payload.samplesWithTemp && !payload.samples) {
    payload.samples = payload.samplesWithTemp;
  }
  // Normalize any samples included in the payload so positions and sample ids are canonical
  if (Array.isArray(payload.samples)) {
    payload.samples = payload.samples.map((s: any) => {
      const sample: any = { ...s };
      if (sample.position !== undefined && sample.position !== null) {
        try { sample.position = String(sample.position).trim().toUpperCase(); } catch {};
      }
      if (sample.sampleId && !sample.sample_id) {
        sample.sample_id = sample.sampleId;
      }
      if (sample.sample_id !== undefined && sample.sample_id !== null) {
        try { sample.sample_id = String(sample.sample_id).trim(); } catch {};
      }
      // Normalize camelCase keys to snake_case here to keep DB shape
      delete sample.sampleId;
      delete sample.containerId;
      return sample;
    });
  }
  delete payload.containerType;
  delete payload.sampleType;
  delete payload.location;
  delete payload.occupiedSlots;
  delete payload.totalSlots;
  delete payload.isTraining;
  delete payload.isArchived;
  delete payload.samplesWithTemp;
  return payload;
}
import { serve } from '@hono/node-server'
import { Hono } from "hono";
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createClient } from "@supabase/supabase-js";
import * as kv from './kv_store'

const app = new Hono();
app.use('*', cors({ origin: '*', allowHeaders: ['*'], allowMethods: ['*'] }));
app.use('*', logger(console.log));

// Explicit OPTIONS preflight handler to ensure deployed hosts that don't forward
// preflight requests receive an immediate OK with required CORS headers.
app.options('*', (c) => {
  const headers = new Headers()
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey')
  headers.set('Access-Control-Max-Age', '600')
  return new Response('', { status: 204, headers })
})

// Ensure all responses include CORS headers too (some platforms don't forward middleware-added headers)
app.use('*', async (c, next) => {
  // Let downstream handlers run
  await next()
  // Add safe CORS headers to the response
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey')
  c.header('Access-Control-Allow-Credentials', 'true')
})

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
)

// Routes for SAGA Storage System
interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
}

app.get('/health', (c: any) => {
  const response: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'SAGA Storage System API'
  };
  return c.json(response);
});

// Container management routes
// ...existing code for GET, POST, PUT, DELETE routes...

app.put('/containers/:id', async (c: any) => {  
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { container, userId } = body;
    if (!container || !userId) {
      return c.json({ error: 'Container data and userId required' }, 400);
    }
    // Fetch old container for audit log
    const { data: oldData, error: oldError } = await supabase.from('containers').select('*').eq('id', id).single();
    if (oldError || !oldData) {
      return c.json({ error: 'Container not found' }, 404);
    }
    // Update container
    // Ensure id, userId, and helper functions are in scope
    const containerPayload = normaliseContainerPayload(body.container);
    const timestamp = new Date().toISOString();
    const updatedContainer = {
      ...oldData,
      ...containerPayload,
      id,
      updated_at: timestamp,
      updated_by: body.userId,
    };
    if (!updatedContainer.created_by) {
      updatedContainer.created_by = body.userId;
    }
    const { data, error } = await supabase.from('containers').update(updatedContainer).eq('id', id).select();
    if (error) throw error;
    // Create audit log
    await createAuditLogEntry('container_updated', 'container', id, body.userId, {
      description: `Container updated: ${updatedContainer.name}`,
      changes: getContainerChanges(oldData, updatedContainer)
    });
    return c.json({ container: data[0] });
  } catch (error) {
    console.error('Server error updating container:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Internal server error', details: errorMessage }, 500);
  }
})

app.delete('/containers/:id', async (c: any) => {
  try {
    const id = c.req.param('id');
    const userId = c.req.query('userId');
    if (!userId) {
      return c.json({ error: 'userId required' }, 400);
    }
    // Fetch container to delete for audit log
    const { data: containerToDelete, error: fetchError } = await supabase.from('containers').select('*').eq('id', id).single();
    if (fetchError || !containerToDelete) {
      return c.json({ error: 'Container not found' }, 404);
    }
    // Delete container
    const { error } = await supabase.from('containers').delete().eq('id', id);
    if (error) throw error;
    // Create audit log
    await createAuditLogEntry('container_deleted', 'container', id, userId, {
      description: `Container deleted: ${containerToDelete.name}`,
      containerType: containerToDelete.type,
      sampleCount: containerToDelete.samples ? Object.keys(containerToDelete.samples).length : 0
    });
    return c.json({ success: true });
  } catch (error) {
    console.error('Server error deleting container:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Internal server error', details: errorMessage }, 500);
  }
})

// Container locking routes
app.post('/containers/:id/lock', async (c: any) => {  
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Internal server error', details: errorMessage }, 500)
  }
})

app.delete('/containers/:id/lock', async (c: any) => {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Internal server error', details: errorMessage }, 500)
  }
})

// User session management
app.post('/sessions', async (c: any) => {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Internal server error', details: errorMessage }, 500)
  }
})

app.get('/sessions', async (c: any) => {
  try {
    const sessions = await kv.get('saga-user-sessions') || {}
    const sessionArray = Object.values(sessions)

    return c.json({ sessions: sessionArray })
  } catch (error) {
    console.error('Server error fetching sessions:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Internal server error', details: errorMessage }, 500)
  }
})

// Audit log routes
app.post('/audit-logs', async (c: any) => {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Internal server error', details: errorMessage }, 500)
  }
})

app.get('/audit-logs', async (c: any) => {
  try {
    const limit = parseInt(c.req.query('limit') || '100')
    const offset = parseInt(c.req.query('offset') || '0')
    const resourceType = c.req.query('resourceType')
    const actionType = c.req.query('actionType')
    const userId = c.req.query('userId')
    const severity = c.req.query('severity')

    let logs = await kv.get('saga-audit-logs') || []

    // Defensive: ensure logs is always an array
    logs = Array.isArray(logs) ? logs : []

    // Apply filters
    if (resourceType) {
      logs = (logs ?? []).filter((log: any) => log.resource_type === resourceType)
    }
    if (actionType) {
      logs = (logs ?? []).filter((log: any) => log.action_type === actionType)
    }
    if (userId) {
      logs = (logs ?? []).filter((log: any) => log.user_id === userId)
    }
    if (severity) {
      logs = (logs ?? []).filter((log: any) => log.severity === severity)
    }

    // Apply pagination
    const paginatedLogs = (logs ?? []).slice(offset, offset + limit)

    return c.json({ logs: paginatedLogs })
  } catch (error) {
    console.error('Server error fetching audit logs:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Internal server error', details: errorMessage }, 500)
  }
})

// Backups: allow privileged insertion of backups (service-role) and retention cleanup
app.post('/backups', async (c: any) => {
  try {
    const body = await c.req.json();
    const { data: backupPayload, createdBy } = body;
    if (!backupPayload) {
      return c.json({ error: 'Backup payload required' }, 400);
    }

    // Insert into backups table using the service-role client
    const { error } = await supabase.from('backups').insert([{ data: backupPayload, created_by: createdBy || 'server', created_at: new Date().toISOString() }]);
    if (error) throw error;

    // Retention: delete backups older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('backups').delete().lt('created_at', sevenDaysAgo);

    return c.json({ success: true });
  } catch (err) {
    console.error('Server error inserting backup:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: 'Internal server error', details: errorMessage }, 500);
  }
})

// Samples: privileged upsert endpoint to satisfy RLS-protected writes
app.post('/samples', async (c: any) => {
    try {
    const body = await c.req.json();
    const sampleRaw = body?.sample ?? body;

    if (!sampleRaw) {
      return c.json({ error: 'Sample payload required' }, 400);
    }

    // Basic normalization: position -> uppercase trimmed, sample_id trimmed
    const sample: any = { ...sampleRaw };
    if (sample.position !== undefined && sample.position !== null) {
      try { sample.position = String(sample.position).trim().toUpperCase(); } catch {};
    }
    if (sample.sampleId && !sample.sample_id) sample.sample_id = sample.sampleId;
    if (sample.sample_id !== undefined && sample.sample_id !== null) {
      try { sample.sample_id = String(sample.sample_id).trim().toUpperCase(); } catch {};
    }
    if (sample.containerId && !sample.container_id) sample.container_id = sample.containerId;

    // Load containers to reason about archive state
    const { data: containersData, error: contErr } = await supabase.from('containers').select('*');
    if (contErr) throw contErr;

    const containers = containersData || [];
    const thisContainer = containers.find((cn: any) => String(cn.id) === String(sample.container_id));
    const isArchive = thisContainer?.is_archived || thisContainer?.status === 'archived' || thisContainer?.isArchived;

    // If not archived, enforce uniqueness of sample_id across non-archived containers
    if (!isArchive) {
      const targetSampleId = sample.sample_id;
      if (targetSampleId) {
        const { data: existingSamples, error: fetchError } = await supabase
          .from('samples')
          .select('id, container_id')
          .eq('sample_id', targetSampleId);
        if (fetchError) throw fetchError;

        for (const s of existingSamples || []) {
          if (String(s.container_id) !== String(sample.container_id)) {
            const otherContainer = containers.find((c2: any) => String(c2.id) === String(s.container_id));
            const otherIsArchive = otherContainer?.is_archived || otherContainer?.status === 'archived' || otherContainer?.isArchived;
            if (!otherIsArchive) {
              await supabase.from('samples').delete().eq('id', s.id);
            }
          }
        }

        const existingInThisContainer = (existingSamples || []).find((s: any) => String(s.container_id) === String(sample.container_id));
        if (existingInThisContainer && existingInThisContainer.id) {
          sample.id = existingInThisContainer.id;
        }
      }
    }

    const { data, error } = await supabase.from('samples').upsert(sample).select();
    if (error) throw error;
    return c.json({ data });
  } catch (error) {
    console.error('Server error upserting sample:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Internal server error', details: errorMessage }, 500);
  }
});

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

    let auditLogs = await kv.get('saga-audit-logs') || []
    auditLogs = Array.isArray(auditLogs) ? auditLogs : []
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
const port = process.env.PORT || 3000;
serve({
  fetch: app.fetch,
  port: Number(port),
})
console.log(`SAGA Storage System API server running on http://localhost:${port}`);