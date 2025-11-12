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
}

export default function ContainerGridView({ container, samples, onSampleClick, editMode = false }: ContainerGridViewProps) {
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
    // Build map of position -> sample
    const map = new Map<string, Sample>()
    samples.forEach(sample => {
      if (sample.position && !sample.is_archived) {
        map.set(sample.position.toUpperCase(), sample)
      }
    })
    setSampleMap(map)
  }, [samples])

  const handleCellClick = (position: string) => {
    if (!editMode) return
    const sample = sampleMap.get(position) || null
    onSampleClick?.(sample, position)
  }

  const getRowLabel = (index: number) => String.fromCharCode(65 + index) // A, B, C, ...
  const getColLabel = (index: number) => String(index + 1) // 1, 2, 3, ...

  const getCellColor = (sample?: Sample) => {
    if (!sample) return '#f9fafb' // empty - gray-50
    if (sample.is_archived) return '#fee2e2' // archived - red-100
    const status = sample.data?.status || sample.status
    if (status === 'pending') return '#fef3c7' // yellow-100
    if (status === 'processing') return '#dbeafe' // blue-100
    if (status === 'complete') return '#d1fae5' // green-100
    return '#e0e7ff' // default - indigo-100
  }

  return (
    <div className="container-grid-view">
      <div className="grid-wrapper" style={{ 
        display: 'inline-grid',
        gridTemplateColumns: `40px repeat(${gridSize.cols}, 60px)`,
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

              return (
                <div
                  key={`cell-${rowIndex}-${colIndex}`}
                  onClick={() => handleCellClick(position)}
                  style={{
                    background: getCellColor(sample),
                    border: isOccupied ? '2px solid #3b82f6' : '1px solid #d1d5db',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: editMode ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                    fontSize: '11px',
                    fontWeight: isOccupied ? 600 : 400,
                    color: isOccupied ? '#1f2937' : '#9ca3af',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  className={editMode ? 'hover:shadow-md hover:scale-105' : ''}
                  title={isOccupied ? `${sample.sample_id}\n${position}` : position}
                >
                  {isOccupied ? (
                    <>
                      <div style={{ 
                        fontSize: '10px', 
                        fontWeight: 700,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        paddingX: '2px'
                      }}>
                        {sample.sample_id}
                      </div>
                      {sample.owner && (
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
