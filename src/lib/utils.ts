// Utility functions for the app

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

/**
 * Debounce a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Format error message with user-friendly suggestions
 */
export function formatErrorMessage(error: any, context?: string): string {
  const message = error?.message || String(error)
  
  // Database errors
  if (message.includes('JWT') || message.includes('authentication')) {
    return 'Your session has expired. Please sign in again.'
  }
  
  if (message.includes('duplicate key') || message.includes('already exists')) {
    return 'This item already exists. Please use a different name or ID.'
  }
  
  if (message.includes('foreign key') || message.includes('violates')) {
    return 'This operation would create invalid data. Please check your inputs.'
  }
  
  if (message.includes('not found') || error?.code === 'PGRST116') {
    return context ? `${context} not found. It may have been deleted.` : 'Item not found.'
  }
  
  // Network errors
  if (message.includes('fetch') || message.includes('network')) {
    return 'Network error. Please check your connection and try again.'
  }
  
  if (message.includes('timeout')) {
    return 'Request timed out. Please try again.'
  }
  
  // Permission errors
  if (message.includes('permission') || message.includes('unauthorized')) {
    return 'You do not have permission to perform this action.'
  }
  
  // Default
  return message || 'An unexpected error occurred. Please try again.'
}

/**
 * Parse CSV with better error handling
 */
export function parseCSV(text: string, options: { 
  delimiter?: string
  hasHeader?: boolean 
} = {}): string[][] {
  const { delimiter = ',', hasHeader = true } = options
  const lines = text.trim().split('\n')
  const result: string[][] = []
  
  for (const line of lines) {
    if (!line.trim()) continue
    const values = line.split(delimiter).map(v => v.trim())
    result.push(values)
  }
  
  return hasHeader ? result.slice(1) : result
}
