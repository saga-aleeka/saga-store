import { supabase } from './client'
import { projectId, publicAnonKey } from './info'
import { PlasmaContainer } from '../../components/PlasmaContainerList'
import { AuditLogEntry } from '../../components/AuditTrail'

// API base URL for server functions
const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-aaac77aa`

// Connection timeout (5 seconds)
const FETCH_TIMEOUT = 5000

// Create a fetch wrapper with timeout and better error handling
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - server functions may not be deployed')
    }
    throw error
  }
}

// Database health check with timeout and fallback
export async function checkDatabaseHealth(): Promise<{
  success: boolean
  message: string
  serverFunctionsAvailable: boolean
  databaseAvailable: boolean
}> {
  try {
    // First, test basic Supabase connectivity
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1)
      .maybeSingle()

    const databaseAvailable = !error

    // Test server functions
    let serverFunctionsAvailable = false
    let serverMessage = ''

    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/health`)
      serverFunctionsAvailable = response.ok
      if (response.ok) {
        const result = await response.json()
        serverMessage = result.message || 'Server functions available'
      }
    } catch (serverError) {
      serverMessage = serverError instanceof Error ? serverError.message : 'Server functions not available'
    }

    if (databaseAvailable && serverFunctionsAvailable) {
      return {
        success: true,
        message: 'Database and server functions connected',
        serverFunctionsAvailable: true,
        databaseAvailable: true
      }
    } else if (databaseAvailable) {
      return {
        success: true,
        message: 'Database connected (server functions offline)',
        serverFunctionsAvailable: false,
        databaseAvailable: true
      }
    } else {
      return {
        success: false,
        message: 'Database connection failed',
        serverFunctionsAvailable: false,
        databaseAvailable: false
      }
    }
  } catch (error) {
    console.error('Database health check failed:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown database error',
      serverFunctionsAvailable: false,
      databaseAvailable: false
    }
  }
}

// Container operations with fallback to localStorage
export async function fetchContainers(): Promise<PlasmaContainer[]> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/containers`)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return data.containers || []
  } catch (error) {
    console.warn('Failed to fetch containers from server, falling back to localStorage:', error)
    // Fallback to localStorage
    const saved = localStorage.getItem('saga-containers')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (parseError) {
        console.error('Failed to parse localStorage containers:', parseError)
      }
    }
    return []
  }
}

export async function storeContainers(containers: PlasmaContainer[], userInitials?: string): Promise<boolean> {
  // Always store to localStorage as backup
  try {
    localStorage.setItem('saga-containers', JSON.stringify(containers))
  } catch (error) {
    console.error('Failed to store containers to localStorage:', error)
  }

  // Try to store to server
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/containers`, {
      method: 'POST',
      body: JSON.stringify({
        containers,
        userInitials: userInitials || 'Unknown',
        timestamp: new Date().toISOString()
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    return result.success
  } catch (error) {
    console.warn('Failed to store containers to server (working offline):', error)
    return false // Indicate server storage failed but localStorage succeeded
  }
}

export async function createContainer(container: Omit<PlasmaContainer, 'id'>, userId: string): Promise<PlasmaContainer> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/containers`, {
      method: 'POST',
      body: JSON.stringify({ container, userId })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(`Failed to create container: ${error.message}`)
    }

    const data = await response.json()
    return data.container
  } catch (error) {
    console.warn('Server container creation failed, using local fallback:', error)
    // Create container locally with generated ID
    const newContainer: PlasmaContainer = {
      ...container,
      id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      lastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' ')
    }
    return newContainer
  }
}

export async function updateContainer(id: string, container: Partial<PlasmaContainer>, userId: string): Promise<PlasmaContainer> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/containers/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ container, userId })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(`Failed to update container: ${error.message}`)
    }

    const data = await response.json()
    return data.container
  } catch (error) {
    console.warn('Server container update failed, using local fallback:', error)
    // Return updated container with timestamp
    return {
      ...container,
      id,
      lastUpdated: new Date().toISOString().slice(0, 16).replace('T', ' ')
    } as PlasmaContainer
  }
}

export async function deleteContainer(id: string, userId: string): Promise<void> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/containers/${id}?userId=${userId}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(`Failed to delete container: ${error.message}`)
    }
  } catch (error) {
    console.warn('Server container deletion failed (working offline):', error)
    // In offline mode, deletion will be handled by the calling component
  }
}

// Container locking operations (graceful degradation)
export async function lockContainer(id: string, userId: string, userName: string): Promise<PlasmaContainer | null> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/containers/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ userId, userName })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(`Failed to lock container: ${error.message}`)
    }

    const data = await response.json()
    return data.container
  } catch (error) {
    console.warn('Container locking not available (server offline):', error)
    return null
  }
}

export async function unlockContainer(id: string, userId: string): Promise<PlasmaContainer | null> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/containers/${id}/lock?userId=${userId}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(`Failed to unlock container: ${error.message}`)
    }

    const data = await response.json()
    return data.container
  } catch (error) {
    console.warn('Container unlocking not available (server offline):', error)
    return null
  }
}

// User session management (non-critical, fail silently)
export async function updateUserSession(userId: string, userName: string, activityType: string, containerId?: string, metadata?: any): Promise<void> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/user-session`, {
      method: 'POST',
      body: JSON.stringify({ 
        userId, 
        userName, 
        action: activityType,
        containerId, 
        metadata,
        timestamp: new Date().toISOString()
      })
    })

    if (!response.ok) {
      // Don't throw error for user sessions - they're not critical
      console.warn('User session update failed (non-critical):', response.statusText)
    }
  } catch (error) {
    // Silently fail for user sessions
    console.warn('User session update failed (working offline):', error)
  }
}

export async function fetchActiveSessions(): Promise<any[]> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/active-users`)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return data.users || []
  } catch (error) {
    console.warn('Failed to fetch active sessions (working offline):', error)
    return []
  }
}

// Audit log operations (fallback to localStorage)
export async function createAuditLog(
  actionType: string,
  resourceType: string,
  resourceId: string,
  details: any,
  userInitials: string,
  options: {
    oldValues?: any
    newValues?: any
    metadata?: any
    severity?: 'low' | 'medium' | 'high' | 'critical'
    success?: boolean
  } = {}
): Promise<void> {
  if (!userInitials) return

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit-logs`, {
      method: 'POST',
      body: JSON.stringify({
        actionType,
        resourceType,
        resourceId,
        userId: userInitials,
        userName: userInitials,
        details,
        oldValues: options.oldValues,
        newValues: options.newValues,
        metadata: options.metadata,
        severity: options.severity || 'low',
        success: options.success !== false,
        timestamp: new Date().toISOString()
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    console.warn('Server audit log failed, storing locally:', error)
    // Fallback to localStorage for audit logs
    try {
      const existingLogs = JSON.parse(localStorage.getItem('plasma-audit-logs') || '[]')
      const newLog = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId: userInitials,
        userName: userInitials,
        userRole: 'Lab User',
        action: actionType,
        entityType: resourceType,
        entityId: resourceId,
        details: { description: details },
        severity: options.severity || 'low',
        success: options.success !== false,
        metadata: options.metadata
      }
      
      const updatedLogs = [newLog, ...existingLogs].slice(0, 10000) // Keep last 10k entries
      localStorage.setItem('plasma-audit-logs', JSON.stringify(updatedLogs))
    } catch (storageError) {
      console.error('Failed to store audit log locally:', storageError)
    }
  }
}

export async function fetchAuditLogs(filters: {
  limit?: number
  offset?: number
  resourceType?: string
  actionType?: string
  userId?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
} = {}): Promise<AuditLogEntry[]> {
  try {
    const params = new URLSearchParams()
    
    if (filters.limit) params.set('limit', filters.limit.toString())
    if (filters.offset) params.set('offset', filters.offset.toString())
    if (filters.resourceType) params.set('resourceType', filters.resourceType)
    if (filters.actionType) params.set('actionType', filters.actionType)
    if (filters.userId) params.set('userId', filters.userId)
    if (filters.severity) params.set('severity', filters.severity)

    const response = await fetchWithTimeout(`${API_BASE_URL}/audit-logs?${params}`)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return data.logs || []
  } catch (error) {
    console.warn('Failed to fetch audit logs from server, using local storage:', error)
    // Fallback to localStorage
    try {
      const logs = JSON.parse(localStorage.getItem('plasma-audit-logs') || '[]')
      return logs
    } catch (parseError) {
      console.error('Failed to parse local audit logs:', parseError)
      return []
    }
  }
}

// Real-time subscriptions (graceful degradation)
export function subscribeToContainers(callback: (containers: PlasmaContainer[]) => void) {
  try {
    return supabase
      .channel('containers-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'containers'
      }, async () => {
        try {
          const containers = await fetchContainers()
          callback(containers)
        } catch (error) {
          console.warn('Error fetching containers after real-time update:', error)
        }
      })
      .subscribe()
  } catch (error) {
    console.warn('Real-time subscription failed (working offline):', error)
    return { unsubscribe: () => {} }
  }
}

export function subscribeToUserSessions(callback: (sessions: any[]) => void) {
  try {
    return supabase
      .channel('sessions-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_sessions'
      }, async () => {
        try {
          const sessions = await fetchActiveSessions()
          callback(sessions)
        } catch (error) {
          console.warn('Error fetching sessions after real-time update:', error)
        }
      })
      .subscribe()
  } catch (error) {
    console.warn('Real-time subscription failed (working offline):', error)
    return { unsubscribe: () => {} }
  }
}

// Export enhanced client for direct Supabase access
export { supabase }

// Simple connectivity test
export async function testBasicConnectivity(): Promise<boolean> {
  try {
    const { error } = await supabase.from('information_schema.tables').select('table_name').limit(1)
    return !error
  } catch (error) {
    console.warn('Basic connectivity test failed:', error)
    return false
  }
}