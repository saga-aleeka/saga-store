import React, { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface VirtualizedSampleListProps {
  samples: any[]
  onSampleClick: (sample: any) => void
  sampleTypeColors: { [key: string]: string }
  user: any
}

export default function VirtualizedSampleList({ 
  samples, 
  onSampleClick,
  sampleTypeColors,
  user 
}: VirtualizedSampleListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: samples.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 57, // Estimated row height in pixels
    overscan: 10, // Render 10 extra rows above/below viewport
  })

  const items = virtualizer.getVirtualItems()

  return (
    <div style={{border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden'}}>
      {/* Table Header (fixed) */}
      <table style={{width: '100%', borderCollapse: 'collapse'}}>
        <thead style={{background: '#f3f4f6'}}>
          <tr>
            <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: '15%'}}>Sample ID</th>
            <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: '12%'}}>Type</th>
            <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: '12%'}}>Location</th>
            <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: '18%'}}>Container</th>
            <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: '10%'}}>Position</th>
            <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: '10%'}}>Owner</th>
            <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: '13%'}}>Collected</th>
            <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: '10%'}}>Actions</th>
          </tr>
        </thead>
      </table>

      {/* Virtual Scrolling Body */}
      <div
        ref={parentRef}
        style={{
          height: '600px',
          overflow: 'auto',
          contain: 'strict',
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <table style={{width: '100%', borderCollapse: 'collapse', position: 'absolute', top: 0, left: 0}}>
            <tbody>
              {items.map((virtualRow) => {
                const s = samples[virtualRow.index]
                const containerName = s.containers?.name || s.container_id || '-'
                const containerLocation = s.containers?.location || '-'
                const containerType = s.is_checked_out && s.previous_containers?.type
                  ? s.previous_containers.type
                  : (s.containers?.type || 'Sample Type')
                const typeColor = sampleTypeColors[containerType] || '#6b7280'
                
                return (
                  <tr
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      borderTop: virtualRow.index > 0 ? '1px solid #e5e7eb' : 'none',
                      cursor: s.container_id ? 'pointer' : 'default',
                      background: s.is_archived ? '#fef3c7' : 'white',
                    }}
                    onClick={() => s.container_id && onSampleClick(s)}
                  >
                    <td style={{padding: 12, width: '15%', fontWeight: s.is_checked_out ? 600 : 400}}>
                      {s.sample_id}
                      {s.is_checked_out && (
                        <span style={{
                          marginLeft: 8,
                          padding: '2px 6px',
                          fontSize: 11,
                          borderRadius: 4,
                          background: '#fee2e2',
                          color: '#991b1b',
                          fontWeight: 600
                        }}>
                          CHECKED OUT
                        </span>
                      )}
                      {s.is_archived && (
                        <span style={{
                          marginLeft: 8,
                          padding: '2px 6px',
                          fontSize: 11,
                          borderRadius: 4,
                          background: '#fef3c7',
                          color: '#92400e',
                          fontWeight: 600
                        }}>
                          ARCHIVED
                        </span>
                      )}
                    </td>
                    <td style={{padding: 12, width: '12%'}}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        fontSize: 12,
                        borderRadius: 4,
                        background: typeColor,
                        color: 'white',
                        fontWeight: 500
                      }}>
                        {containerType}
                      </span>
                    </td>
                    <td style={{padding: 12, width: '12%'}}>{containerLocation}</td>
                    <td style={{padding: 12, width: '18%'}}>{containerName}</td>
                    <td style={{padding: 12, width: '10%', fontWeight: 500}}>{s.position || '-'}</td>
                    <td style={{padding: 12, width: '10%'}}>{s.owner || '-'}</td>
                    <td style={{padding: 12, width: '13%'}}>{s.collected_date || '-'}</td>
                    <td style={{padding: 12, width: '10%'}}>
                      {s.container_id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onSampleClick(s)
                          }}
                          style={{
                            padding: '6px 12px',
                            fontSize: 13,
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            background: 'white',
                            cursor: 'pointer',
                            color: '#374151',
                          }}
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
