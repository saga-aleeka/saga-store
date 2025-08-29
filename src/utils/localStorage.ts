// StackBlitz-compatible localStorage utilities for SAGA Storage System
import { PlasmaContainer } from '../components/PlasmaContainerList';

export interface LocalStorageKeys {
  CONTAINERS: 'saga-containers';
  USER_INITIALS: 'saga-user-initials';
  AUDIT_LOGS: 'saga-audit-logs';
  USER_SESSIONS: 'saga-user-sessions';
  SYSTEM_CONFIG: 'saga-system-config';
}

export const STORAGE_KEYS: LocalStorageKeys = {
  CONTAINERS: 'saga-containers',
  USER_INITIALS: 'saga-user-initials',
  AUDIT_LOGS: 'saga-audit-logs',
  USER_SESSIONS: 'saga-user-sessions',
  SYSTEM_CONFIG: 'saga-system-config'
};

// Safe JSON parsing with fallback
export function safeJSONParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Failed to parse JSON from localStorage:', error);
    return fallback;
  }
}

// Safe JSON stringifying
export function safeJSONStringify(value: any): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error('Failed to stringify JSON for localStorage:', error);
    return '{}';
  }
}

// Container management
export function loadContainers(): PlasmaContainer[] {
  const saved = localStorage.getItem(STORAGE_KEYS.CONTAINERS);
  return safeJSONParse(saved, []);
}

export function saveContainers(containers: PlasmaContainer[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.CONTAINERS, safeJSONStringify(containers));
    return true;
  } catch (error) {
    console.error('Failed to save containers to localStorage:', error);
    return false;
  }
}

// User session management
export interface UserSession {
  userId: string;
  userName: string;
  lastActivity: string;
  isActive: boolean;
}

export function loadUserSessions(): UserSession[] {
  const saved = localStorage.getItem(STORAGE_KEYS.USER_SESSIONS);
  return safeJSONParse(saved, []);
}

export function saveUserSession(session: UserSession): boolean {
  try {
    const sessions = loadUserSessions();
    const updatedSessions = sessions.filter(s => s.userId !== session.userId);
    updatedSessions.push(session);
    
    localStorage.setItem(STORAGE_KEYS.USER_SESSIONS, safeJSONStringify(updatedSessions));
    return true;
  } catch (error) {
    console.error('Failed to save user session to localStorage:', error);
    return false;
  }
}

export function removeUserSession(userId: string): boolean {
  try {
    const sessions = loadUserSessions();
    const updatedSessions = sessions.filter(s => s.userId !== userId);
    
    localStorage.setItem(STORAGE_KEYS.USER_SESSIONS, safeJSONStringify(updatedSessions));
    return true;
  } catch (error) {
    console.error('Failed to remove user session from localStorage:', error);
    return false;
  }
}

// Audit log management
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  success: boolean;
}

export function loadAuditLogs(): AuditLogEntry[] {
  const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
  return safeJSONParse(saved, []);
}

export function saveAuditLog(logEntry: Omit<AuditLogEntry, 'id' | 'timestamp'>): boolean {
  try {
    const logs = loadAuditLogs();
    const newLog: AuditLogEntry = {
      ...logEntry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };
    
    const updatedLogs = [newLog, ...logs].slice(0, 1000); // Keep last 1000 entries
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, safeJSONStringify(updatedLogs));
    return true;
  } catch (error) {
    console.error('Failed to save audit log to localStorage:', error);
    return false;
  }
}

// System configuration
export interface SystemConfig {
  version: string;
  lastUpdated: string;
  features: {
    realTimeSync: boolean;
    auditLogging: boolean;
    conflictResolution: boolean;
  };
}

export function loadSystemConfig(): SystemConfig {
  const saved = localStorage.getItem(STORAGE_KEYS.SYSTEM_CONFIG);
  const defaultConfig: SystemConfig = {
    version: '2.3.0',
    lastUpdated: new Date().toISOString(),
    features: {
      realTimeSync: true,
      auditLogging: true,
      conflictResolution: true
    }
  };
  
  return safeJSONParse(saved, defaultConfig);
}

export function saveSystemConfig(config: SystemConfig): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.SYSTEM_CONFIG, safeJSONStringify(config));
    return true;
  } catch (error) {
    console.error('Failed to save system config to localStorage:', error);
    return false;
  }
}

// Sample data management for containers
export function loadSamplesForContainer(containerId: string): any {
  const saved = localStorage.getItem(`samples-${containerId}`);
  return safeJSONParse(saved, {});
}

export function saveSamplesForContainer(containerId: string, samples: any): boolean {
  try {
    localStorage.setItem(`samples-${containerId}`, safeJSONStringify(samples));
    return true;
  } catch (error) {
    console.error(`Failed to save samples for container ${containerId}:`, error);
    return false;
  }
}

// Bulk operations
export function clearAllData(): boolean {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Also clear sample data
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('samples-')) {
        localStorage.removeItem(key);
      }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to clear all data:', error);
    return false;
  }
}

export function exportAllData(): string {
  try {
    const data: { [key: string]: any } = {};
    
    // Export main data
    Object.values(STORAGE_KEYS).forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        data[key] = safeJSONParse(value, null);
      }
    });
    
    // Export sample data
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('samples-')) {
        const value = localStorage.getItem(key);
        if (value) {
          data[key] = safeJSONParse(value, null);
        }
      }
    });
    
    return safeJSONStringify(data);
  } catch (error) {
    console.error('Failed to export data:', error);
    return '{}';
  }
}

export function importAllData(jsonData: string): boolean {
  try {
    const data = safeJSONParse(jsonData, {});
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null) {
        localStorage.setItem(key, safeJSONStringify(value));
      }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}

// Storage quota management
export function getStorageInfo(): { used: number; available: number; quota: number } {
  let used = 0;
  let quota = 5 * 1024 * 1024; // 5MB default estimate
  
  try {
    // Calculate used space
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length;
      }
    }
    
    // Try to get actual quota (not supported in all browsers)
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(estimate => {
        if (estimate.quota) {
          quota = estimate.quota;
        }
      });
    }
  } catch (error) {
    console.warn('Could not calculate storage info:', error);
  }
  
  return {
    used,
    available: quota - used,
    quota
  };
}

// Health check
export function performHealthCheck(): {
  isAvailable: boolean;
  canWrite: boolean;
  canRead: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  let isAvailable = false;
  let canWrite = false;
  let canRead = false;
  
  try {
    // Check if localStorage is available
    if (typeof Storage !== 'undefined' && localStorage) {
      isAvailable = true;
      
      // Test write
      const testKey = 'saga-health-check';
      const testValue = JSON.stringify({ timestamp: Date.now() });
      
      localStorage.setItem(testKey, testValue);
      canWrite = true;
      
      // Test read
      const readValue = localStorage.getItem(testKey);
      if (readValue === testValue) {
        canRead = true;
      } else {
        errors.push('Read test failed');
      }
      
      // Cleanup
      localStorage.removeItem(testKey);
    } else {
      errors.push('localStorage not available');
    }
  } catch (error) {
    errors.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return {
    isAvailable,
    canWrite,
    canRead,
    errors
  };
}