import React, { useState, useEffect } from 'react'
import { getToken } from '../lib/auth'

interface Sample {
  id: string
  sample_id: string
  position: string
  container_id: string
  data?: any
  is_archived?: boolean
  owner?: string
  status?: string
}

interface ContainerGridViewProps {
  container: any
  samples: Sample[]
  onSampleClick?: (sample: Sample | null, position: string) => void
  editMode?: boolean
  scanningPosition?: string | null
  highlightedPositions?: string[]
}

export default function ContainerGridView({ container, samples, onSampleClick, editMode = false, scanningPosition = null, highlightedPositions = [] }: ContainerGridViewProps) {
  const [gridSize, setGridSize] = useState({ rows: 9, cols: 9 })
  const [sampleMap, setSampleMap] = useState<Map<string, Sample>>(new Map())

  useEffect(() => {
    // Parse layout (e.g., "9x9", "8x12")
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

  const getRowLabel = (index: number) => String.fromCharCode(65 + index) // A, B, C, ...
  const getColLabel = (index: number) => String(index + 1) // 1, 2, 3, ...

  const getCellColor = (sample?: Sample) => {
    if (!sample) return '#f9fafb' // empty - gray-50
    if (sample.is_archived) return '#fef3c7' // archived - yellow-100
    const status = sample.data?.status || sample.status
    if (status === 'pending') return '#fef3c7' // yellow-100
    if (status === 'processing') return '#dbeafe' // blue-100
    if (status === 'complete') return '#d1fae5' // green-100
    return '#e0e7ff' // default - indigo-100
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
              const position = `${getRowLabel(rowIndex)}${getColLabel(colIndex)}`
              const sample = sampleMap.get(position)
              const isOccupied = !!sample
              
              // Check if this is I9 for DP Pools (unavailable position)
              const isUnavailable = position === 'I9' && container?.type === 'DP Pools' && container?.layout === '9x9'

              const isHighlighted = isPositionHighlighted(position)
              const isScanning = scanningPosition === position
              
              return (
                <div
                  key={`cell-${rowIndex}-${colIndex}`}
                  onClick={() => !isUnavailable && handleCellClick(position)}
                  style={{
                    background: isUnavailable
                      ? '#d1d5db'
                      : isScanning 
                        ? '#f3e8ff' 
                        : getCellColor(sample),
                    border: isUnavailable
                      ? '2px solid #9ca3af'
                      : isScanning
                        ? '3px solid #8b5cf6'
                        : isHighlighted 
                          ? '3px solid #f59e0b' 
                          : isOccupied 
                            ? '2px solid #3b82f6' 
                            : '1px solid #d1d5db',
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
                    color: isUnavailable ? '#6b7280' : isOccupied ? '#1f2937' : '#9ca3af',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: isScanning 
                      ? '0 0 0 3px #c4b5fd' 
                      : isHighlighted 
                        ? '0 0 0 2px #fbbf24' 
                        : 'none',
                    opacity: isUnavailable ? 0.5 : 1
                  }}
                  className={!isUnavailable && (isOccupied || editMode) ? 'hover:shadow-md hover:scale-105' : ''}
                  title={isUnavailable 
                    ? `${position} - Unavailable (DP Sets come in groups of 4)` 
                    : isOccupied 
                      ? `${sample.sample_id}${sample.is_archived ? ' (archived)' : ''}\n${position}` 
                      : position}
                >
                  {isUnavailable ? (
                    <div style={{ fontSize: '16px', fontWeight: 700, opacity: 0.7 }}>×</div>
                  ) : isOccupied ? (
                    <>
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
                      {sample.is_archived && (
                        <div style={{ 
                          fontSize: '8px', 
                          color: '#92400e',
                          marginTop: '2px',
                          fontWeight: 600
                        }}>
                          ARCHIVED
                        </div>
                      )}
                      {!sample.is_archived && sample.owner && (
                        <div style={{ 
                          fontSize: '9px', 
                          color: '#6b7280',
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
