import React, { useState, useEffect } from 'react'
import { getToken } from '../lib/auth'

interface Sample {
  id: string
  sample_id: string
  position: string
  container_id: string
  data?: any
  is_archived?: boolean
  is_training?: boolean
  owner?: string
  status?: string
  sample_tags?: Array<{ tags?: { id?: string; name?: string; color?: string; highlight?: boolean } }>
}

interface ContainerGridViewProps {
  container: any
  samples: Sample[]
  onSampleClick?: (sample: Sample | null, position: string) => void
  editMode?: boolean
  scanningPosition?: string | null
  highlightedPositions?: string[]
  selectedPositions?: string[]
  selectedSampleIds?: Set<string>
}

export default function ContainerGridView({ container, samples, onSampleClick, editMode = false, scanningPosition = null, highlightedPositions = [], selectedPositions = [], selectedSampleIds }: ContainerGridViewProps) {
  const [gridSize, setGridSize] = useState({ rows: 9, cols: 9 })
  const [sampleMap, setSampleMap] = useState<Map<string, Sample>>(new Map())
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false
    return document.documentElement.dataset.theme === 'dark'
  })

  useEffect(() => {
    // Parse layout (e.g., "9x9", "14x7")
    if (container?.layout) {
      const parts = container.layout.toLowerCase().split('x')
      if (parts.length === 2) {
        const rows = parseInt(parts[0]) || 9
        const cols = parseInt(parts[1]) || 9
        setGridSize({ rows, cols })
      }
    }
  }, [container?.layout])

  useEffect(() => {
    // Build map of position -> sample (include archived samples)
    const map = new Map<string, Sample>()
    samples.forEach(sample => {
      if (sample.position) {
        map.set(sample.position.toUpperCase(), sample)
      }
    })
    setSampleMap(map)
  }, [samples])

  const handleCellClick = (position: string) => {
    const sample = sampleMap.get(position) || null
    
    // In scanning mode, allow clicking any cell to select position
    if (scanningPosition) {
      onSampleClick?.(sample, position)
      return
    }
    
    // Allow viewing filled cells even when not in edit mode
    if (sample) {
      onSampleClick?.(sample, position)
      return
    }
    
    // Only allow adding to empty cells in edit mode
    if (!sample && editMode) {
      onSampleClick?.(sample, position)
    }
  }

  const getRowLabel = (index: number) => {
    // IDT Plates use numbers for rows (displayed on left side), with row 1 at top
    if (container?.type === 'IDT Plates') {
      return String(index + 1) // 1, 2, 3, ... 14
    }
    return String.fromCharCode(65 + index) // A, B, C, ...
  }
  
  const getColLabel = (index: number) => {
    // IDT Plates use letters for columns (displayed on top)
    if (container?.type === 'IDT Plates') {
      return String.fromCharCode(65 + index) // A, B, C, ...
    }
    return String(index + 1) // 1, 2, 3, ...
  }

  const getCellColor = (sample?: Sample, darkMode = false) => {
    if (!sample) return darkMode ? '#334155' : '#f9fafb'
    const highlightTag = (sample.sample_tags || []).find((t) => t.tags?.highlight !== false)
    const tagColor = highlightTag?.tags?.color
    if (tagColor) return tagColor
    if (sample.is_training) return darkMode ? '#7c3aed' : '#c7d2fe'
    if (sample.is_archived) return darkMode ? '#b45309' : '#fef3c7'
    return darkMode ? '#2563eb' : '#dbeafe'
  }

  const getContrastTextColor = (color: string) => {
    try {
      const h = color.replace('#', '')
      const r = parseInt(h.substring(0, 2), 16) / 255
      const g = parseInt(h.substring(2, 4), 16) / 255
      const b = parseInt(h.substring(4, 6), 16) / 255
      const Rs = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)
      const Gs = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)
      const Bs = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4)
      const lum = 0.2126 * Rs + 0.7152 * Gs + 0.0722 * Bs

      const darkTextLum = 0.02
      const lightTextLum = 0.98
      const contrastWithDark = (Math.max(lum, darkTextLum) + 0.05) / (Math.min(lum, darkTextLum) + 0.05)
      const contrastWithLight = (Math.max(lum, lightTextLum) + 0.05) / (Math.min(lum, lightTextLum) + 0.05)
      return contrastWithDark >= contrastWithLight ? '#0f172a' : '#f8fafc'
    } catch (e) {
      return '#1f2937'
    }
  }

  // Get highlight parameter from URL hash or from props
  const getHighlightedPosition = () => {
    const hash = window.location.hash
    const match = hash.match(/[?&]highlight=([^&]+)/)
    return match ? decodeURIComponent(match[1]).toUpperCase() : null
  }
  
  const [highlightedPosition, setHighlightedPosition] = useState<string | null>(getHighlightedPosition())
  
  useEffect(() => {
    const handleHashChange = () => {
      setHighlightedPosition(getHighlightedPosition())
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const applyTheme = () => {
      setIsDarkTheme(document.documentElement.dataset.theme === 'dark')
    }

    applyTheme()
    const observer = new MutationObserver(applyTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })

    return () => observer.disconnect()
  }, [])

  // Check if a position should be highlighted (from URL or from props array)
  const isPositionHighlighted = (position: string) => {
    if (highlightedPositions && highlightedPositions.length > 0) {
      return highlightedPositions.map(p => p.toUpperCase()).includes(position.toUpperCase())
    }
    return highlightedPosition === position.toUpperCase()
  }

  return (
    <div className="container-grid-view">
      <div className="grid-wrapper" style={{ 
        display: 'inline-grid',
        gridTemplateColumns: `40px repeat(${gridSize.cols}, 95px)`,
        gridTemplateRows: `30px repeat(${gridSize.rows}, 60px)`,
        gap: '2px',
        background: '#e5e7eb',
        padding: '2px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        {/* Top-left corner cell */}
        <div style={{
          background: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: '12px',
          color: '#6b7280',
          borderRadius: '4px'
        }} />

        {/* Column headers (1, 2, 3, ...) */}
        {Array.from({ length: gridSize.cols }).map((_, colIndex) => (
          <div key={`col-${colIndex}`} style={{
            background: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: '13px',
            color: '#374151',
            borderRadius: '4px'
          }}>
            {getColLabel(colIndex)}
          </div>
        ))}

        {/* Rows with row headers */}
        {Array.from({ length: gridSize.rows }).map((_, rowIndex) => (
          <React.Fragment key={`row-${rowIndex}`}>
            {/* Row header (A, B, C, ...) */}
            <div style={{
              background: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '13px',
              color: '#374151',
              borderRadius: '4px'
            }}>
              {getRowLabel(rowIndex)}
            </div>

            {/* Grid cells */}
            {Array.from({ length: gridSize.cols }).map((_, colIndex) => {
              // IDT Plates use column letter + row number (e.g., A1, B2)
              // Other containers use row letter + column number (e.g., A1, B2)
              const position = container?.type === 'IDT Plates'
                ? `${getColLabel(colIndex)}${getRowLabel(rowIndex)}`
                : `${getRowLabel(rowIndex)}${getColLabel(colIndex)}`
              const sample = sampleMap.get(position)
              const isOccupied = !!sample
              
              // Check if this is I9 for DP Pools (unavailable position)
              const isUnavailable = position === 'I9' && container?.type === 'DP Pools' && container?.layout === '9x9'

              const isHighlighted = isPositionHighlighted(position)
              const isSelected = selectedPositions.map(p => p.toUpperCase()).includes(position.toUpperCase())
              const isScanning = scanningPosition === position
              const isSampleSelected = selectedSampleIds && sample ? selectedSampleIds.has(sample.id) : false

              const baseCellColor = getCellColor(sample, isDarkTheme)
              const cellBackground = isUnavailable
                ? (isDarkTheme ? '#334155' : '#d1d5db')
                : isScanning
                  ? (isDarkTheme ? '#4c1d95' : '#f3e8ff')
                  : isSampleSelected
                    ? (isDarkTheme ? '#1d4ed8' : '#dbeafe')
                    : isSelected
                      ? (isDarkTheme ? '#1e40af' : '#dbeafe')
                      : baseCellColor

              const emptyCellTextColor = isDarkTheme ? '#94a3b8' : '#9ca3af'
              const occupiedCellTextColor = getContrastTextColor(cellBackground)
              const unavailableCellTextColor = isDarkTheme ? '#cbd5e1' : '#6b7280'
              
              return (
                <div
                  key={`cell-${rowIndex}-${colIndex}`}
                  onClick={() => !isUnavailable && handleCellClick(position)}
                  style={{
                    background: cellBackground,
                    border: isUnavailable
                      ? (isDarkTheme ? '2px solid #64748b' : '2px solid #9ca3af')
                      : isScanning
                        ? '3px solid #8b5cf6'
                        : isSampleSelected
                          ? '3px solid #2563eb'
                          : isSelected
                            ? '3px solid #3b82f6'
                            : isHighlighted 
                              ? '3px solid #f59e0b' 
                              : isOccupied 
                                ? '2px solid #3b82f6' 
                                : (isDarkTheme ? '1px solid #475569' : '1px solid #d1d5db'),
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    cursor: isUnavailable 
                      ? 'not-allowed' 
                      : isOccupied 
                        ? 'pointer' 
                        : (editMode ? 'pointer' : 'default'),
                    transition: 'all 0.15s',
                    fontSize: '11px',
                    fontWeight: isOccupied ? 600 : 400,
                    color: isUnavailable ? unavailableCellTextColor : isOccupied ? occupiedCellTextColor : emptyCellTextColor,
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: isScanning 
                      ? '0 0 0 3px #c4b5fd'
                      : isSampleSelected
                        ? '0 0 0 3px #93c5fd'
                        : isSelected
                          ? '0 0 0 2px #60a5fa'
                          : isHighlighted 
                            ? '0 0 0 2px #fbbf24' 
                            : 'none',
                    opacity: isUnavailable ? 0.5 : 1
                  }}
                  className={!isUnavailable && (isOccupied || editMode) ? 'hover:shadow-md hover:scale-105' : ''}
                  title={isUnavailable 
                    ? `${position} - Unavailable (DP Sets come in groups of 4)` 
                    : isOccupied 
                      ? `${sample.sample_id}${sample.is_training ? ' (training)' : ''}${sample.is_archived ? ' (archived)' : ''}\n${position}` 
                      : position}
                >
                  {isUnavailable ? (
                    <div style={{ fontSize: '16px', fontWeight: 700, opacity: 0.7 }}>×</div>
                  ) : isOccupied ? (
                    <>
                      {isSampleSelected && (
                        <div style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          background: '#2563eb',
                          color: 'white',
                          borderRadius: '50%',
                          width: '16px',
                          height: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: 700
                        }}>
                          ✓
                        </div>
                      )}
                      <div style={{ 
                        fontSize: '11px', 
                        fontWeight: 700,
                        textAlign: 'center',
                        wordBreak: 'break-all',
                        lineHeight: '1.2',
                        width: '100%',
                        opacity: sample.is_archived ? 0.6 : 1,
                        textDecoration: sample.is_archived ? 'line-through' : 'none'
                      }}>
                        {sample.sample_id}
                      </div>
                      {sample.is_training && !sample.is_archived && (
                        <div style={{
                          fontSize: '8px',
                          color: occupiedCellTextColor,
                          marginTop: '2px',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          opacity: 0.92
                        }}>
                          TRAINING
                        </div>
                      )}

                      {sample.is_archived && (
                        <div style={{ 
                          fontSize: '8px', 
                          color: getContrastTextColor(cellBackground),
                          marginTop: '2px',
                          fontWeight: 600
                        }}>
                          ARCHIVED
                        </div>
                      )}
                      {!sample.is_archived && sample.owner && (
                        <div style={{ 
                          fontSize: '9px', 
                          color: occupiedCellTextColor,
                          opacity: 0.84,
                          marginTop: '2px'
                        }}>
                          {sample.owner}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ opacity: 0.5 }}>{position}</div>
                  )}
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
