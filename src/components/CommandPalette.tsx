import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  recentContainers: Array<{ id: string; name: string }>
  onNavigate: (type: 'container' | 'sample', id: string) => void
}

interface SearchResult {
  id: string
  type: 'container' | 'sample'
  name: string
  subtitle?: string
  icon: string
}

export default function CommandPalette({ isOpen, onClose, recentContainers, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Perform search when query changes
  useEffect(() => {
    if (!isOpen) return

    const searchDebounce = setTimeout(async () => {
      if (query.trim() === '') {
        // Show recent containers when no query
        setResults(
          recentContainers.map(c => ({
            id: c.id,
            type: 'container' as const,
            name: c.name,
            subtitle: 'Recent',
            icon: '📦'
          }))
        )
        setSelectedIndex(0)
        return
      }

      setIsSearching(true)
      try {
        const searchTerm = query.toLowerCase().trim()

        // Search containers
        const { data: containers } = await supabase
          .from('containers')
          .select('id, name, location, type, samples(count)')
          .or(`name.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`)
          .limit(10)

        // Search samples
        const { data: samples } = await supabase
          .from('samples')
          .select('id, sample_id, container_id, position, containers(name)')
          .ilike('sample_id', `%${searchTerm}%`)
          .limit(10)

        const containerResults: SearchResult[] = (containers || []).map(c => ({
          id: c.id,
          type: 'container' as const,
          name: c.name,
          subtitle: `${c.location || 'No location'} • ${c.type}`,
          icon: '📦'
        }))

        const sampleResults: SearchResult[] = (samples || []).map((s: any) => ({
          id: s.id,
          type: 'sample' as const,
          name: s.sample_id,
          subtitle: `${s.containers?.name || 'Unknown container'} • Position ${s.position}`,
          icon: '🔬'
        }))

        setResults([...containerResults, ...sampleResults])
        setSelectedIndex(0)
      } catch (error) {
        console.error('Command palette search error:', error)
      } finally {
        setIsSearching(false)
      }
    }, 200) // 200ms debounce

    return () => clearTimeout(searchDebounce)
  }, [query, isOpen, recentContainers])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault()
        const selected = results[selectedIndex]
        if (selected) {
          onNavigate(selected.type, selected.id)
          onClose()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex, onClose, onNavigate])

  // Auto-scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998
        }}
        onClick={onClose}
      />

      {/* Command Palette Modal */}
      <div
        style={{
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: 600,
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          zIndex: 9999,
          overflow: 'hidden'
        }}
      >
        {/* Search Input */}
        <div style={{ padding: '16px 16px 12px' }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search containers and samples... (⌘K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: 16,
              border: '2px solid #e5e7eb',
              borderRadius: 8,
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb'
            }}
          />
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            padding: '0 8px 8px'
          }}
        >
          {isSearching && (
            <div style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
              Searching...
            </div>
          )}

          {!isSearching && results.length === 0 && query.trim() !== '' && (
            <div style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
              No results found for "{query}"
            </div>
          )}

          {!isSearching && results.length === 0 && query.trim() === '' && recentContainers.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
              Type to search containers and samples
            </div>
          )}

          {!isSearching && results.map((result, index) => (
            <div
              key={`${result.type}-${result.id}`}
              onClick={() => {
                onNavigate(result.type, result.id)
                onClose()
              }}
              style={{
                padding: '12px 16px',
                margin: '4px 0',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: index === selectedIndex ? '#eff6ff' : 'transparent',
                border: index === selectedIndex ? '2px solid #3b82f6' : '2px solid transparent',
                transition: 'all 0.15s'
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span style={{ fontSize: 24 }}>{result.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: '#111827',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {result.name}
                </div>
                {result.subtitle && (
                  <div style={{
                    fontSize: 12,
                    color: '#6b7280',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {result.subtitle}
                  </div>
                )}
              </div>
              <div style={{
                padding: '2px 8px',
                background: result.type === 'container' ? '#dbeafe' : '#fef3c7',
                color: result.type === 'container' ? '#1e40af' : '#92400e',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase'
              }}>
                {result.type}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
          display: 'flex',
          gap: 16,
          fontSize: 11,
          color: '#6b7280'
        }}>
          <span><kbd style={{ padding: '2px 6px', background: 'white', border: '1px solid #d1d5db', borderRadius: 3 }}>↑↓</kbd> Navigate</span>
          <span><kbd style={{ padding: '2px 6px', background: 'white', border: '1px solid #d1d5db', borderRadius: 3 }}>Enter</kbd> Select</span>
          <span><kbd style={{ padding: '2px 6px', background: 'white', border: '1px solid #d1d5db', borderRadius: 3 }}>Esc</kbd> Close</span>
        </div>
      </div>
    </>
  )
}
