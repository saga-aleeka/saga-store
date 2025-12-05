// React hooks for common patterns
import { useState, useEffect, useRef } from 'react'

/**
 * Debounced value hook
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * LocalStorage hook with serialization
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = (value: T) => {
    try {
      setStoredValue(value)
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error)
    }
  }

  return [storedValue, setValue]
}

/**
 * Hook to track recently accessed items
 */
export function useRecentItems<T extends { id: string | number; name: string }>(
  storageKey: string,
  maxItems: number = 10
): {
  recentItems: T[]
  addRecentItem: (item: T) => void
  clearRecent: () => void
} {
  const [recentItems, setRecentItems] = useLocalStorage<T[]>(storageKey, [])

  const addRecentItem = (item: T) => {
    const filtered = recentItems.filter(i => i.id !== item.id)
    const updated = [item, ...filtered].slice(0, maxItems)
    setRecentItems(updated)
  }

  const clearRecent = () => {
    setRecentItems([])
  }

  return { recentItems, addRecentItem, clearRecent }
}

/**
 * Hook for keyboard shortcuts
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  modifiers: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {}
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const matchesModifiers =
        (!modifiers.ctrl || e.ctrlKey) &&
        (!modifiers.alt || e.altKey) &&
        (!modifiers.shift || e.shiftKey) &&
        (!modifiers.meta || e.metaKey)

      if (e.key === key && matchesModifiers) {
        e.preventDefault()
        callback()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [key, callback, modifiers])
}

/**
 * Hook for tracking favorites
 */
export function useFavorites(storageKey: string = 'saga_favorites'): {
  favorites: Set<string>
  toggleFavorite: (id: string) => void
  isFavorite: (id: string) => boolean
} {
  const [favoriteIds, setFavoriteIds] = useLocalStorage<string[]>(storageKey, [])
  const favorites = new Set(favoriteIds)

  const toggleFavorite = (id: string) => {
    if (favorites.has(id)) {
      setFavoriteIds(favoriteIds.filter(fid => fid !== id))
    } else {
      setFavoriteIds([...favoriteIds, id])
    }
  }

  const isFavorite = (id: string) => favorites.has(id)

  return { favorites, toggleFavorite, isFavorite }
}
