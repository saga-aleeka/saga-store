import React, { useEffect, useState } from 'react'
import { getToken } from '../lib/auth'
import { formatDateTime } from '../lib/dateUtils'
import { supabase } from '../lib/supabaseClient'

interface HistoryEvent {
  when: string
  action: string
  from_container?: string
  to_container?: string
  from_position?: string
  to_position?: string
  user?: string
  source?: string
}

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
  created_at?: string
  updated_at?: string
}

interface SampleHistorySidebarProps {
  sample: Sample | null
  onClose: () => void
  onArchive?: (sampleId: string) => void
  onUpdate?: () => void
  onDelete?: (sampleId: string) => void
}

export default function SampleHistorySidebar({ sample, onClose, onArchive, onUpdate, onDelete }: SampleHistorySidebarProps) {
  const [archiving, setArchiving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [containerNames, setContainerNames] = useState<Map<string, string>>(new Map())

  if (!sample) return null

  const history: HistoryEvent[] = sample.data?.history || []
  const sortedHistory = [...history].sort((a, b) => 
    new Date(b.when).getTime() - new Date(a.when).getTime()
  )

  // Fetch container names for UUIDs in history
  useEffect(() => {
    async function fetchContainerNames() {
      const containerIds = new Set<string>()
      
      // Collect all unique container IDs from history
      history.forEach(event => {
        if (event.from_container) containerIds.add(event.from_container)
        if (event.to_container) containerIds.add(event.to_container)
      })
      
      if (containerIds.size === 0) return
      
      try {
        const { data, error } = await supabase
          .from('containers')
          .select('id, name')
          .in('id', Array.from(containerIds))
        
        if (error) throw error
        
        const nameMap = new Map<string, string>()
        data?.forEach(container => {
          nameMap.set(container.id, container.name)
        })
        
        setContainerNames(nameMap)
      } catch (error) {
        console.error('Failed to fetch container names:', error)
      }
    }
    
    fetchContainerNames()
  }, [sample?.id])

  const getContainerDisplay = (containerId: string | undefined) => {
    if (!containerId) return 'Unknown'
    return containerNames.get(containerId) || containerId
  }

    const handleArchive = async () => {
    if (!window.confirm(`Archive ${sample.sample_id}? This will mark it as archived.`)) {
      return
    }

    setArchiving(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/samples/${sample.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_archived: true })
      })

      if (!res.ok) throw new Error('Failed to archive sample')
      
      onArchive?.(sample.id)
      onUpdate?.()
    } catch (error) {
      console.error('Archive error:', error)
      alert('Failed to archive sample')
    } finally {
      setArchiving(false)
    }
  }

  const handleTrainingToggle = async () => {
    const newTrainingState = !sample.is_training
    if (!window.confirm(`${newTrainingState ? 'Mark' : 'Unmark'} ${sample.sample_id} as training sample?`)) {
      return
    }

    setArchiving(true) // Reuse the archiving state for loading
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/samples/${sample.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_training: newTrainingState })
      })

      if (!res.ok) throw new Error('Failed to update training status')
      
      onUpdate?.()
    } catch (error) {
      console.error('Training toggle error:', error)
      alert('Failed to update training status')
    } finally {
      setArchiving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete ${sample.sample_id}? This action cannot be undone.`)) {
      return
    }

    setDeleting(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/samples/${sample.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!res.ok) throw new Error('Failed to delete sample')
      
      onDelete?.(sample.id)
      onClose()
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete sample')
    } finally {
      setDeleting(false)
    }
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'inserted': 'Created',
      'moved': 'Moved',
      'updated': 'Updated',
      'archived': 'Archived',
      'inserted_archived': 'Created (Archived)'
    }
    return labels[action] || action
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: '400px',
      background: 'white',
      boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            {sample.sample_id}
          </h3>
          <div style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280' }}>
            Position: {sample.position}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0',
            color: '#6b7280',
            lineHeight: 1
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Sample Info */}
      <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'grid', gap: '12px', fontSize: '14px' }}>
          {sample.owner && (
            <div>
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Owner</div>
              <div style={{ fontWeight: 600 }}>{sample.owner}</div>
            </div>
          )}
          {sample.status && (
            <div>
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Status</div>
              <div style={{ fontWeight: 600 }}>{sample.status}</div>
            </div>
          )}
          {sample.created_at && (
            <div>
              <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Created</div>
              <div>{formatDateTime(sample.created_at)}</div>
            </div>
          )}
          {sample.is_archived && (
            <div style={{
              padding: '8px 12px',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '13px'
            }}>
              ⚠️ Archived
            </div>
          )}
          {sample.is_training && (
            <div style={{
              padding: '8px 12px',
              background: '#e0e7ff',
              color: '#3730a3',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '13px'
            }}>
              🎓 Training Sample
            </div>
          )}
        </div>

        {!sample.is_archived && (
          <button
            onClick={handleArchive}
            disabled={archiving}
            style={{
              marginTop: '16px',
              width: '100%',
              padding: '10px',
              background: archiving ? '#9ca3af' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: archiving ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {archiving ? 'Archiving...' : '🗄️ Archive Sample'}
          </button>
        )}

        <button
          onClick={handleTrainingToggle}
          disabled={archiving}
          style={{
            marginTop: '12px',
            width: '100%',
            padding: '10px',
            background: archiving ? '#9ca3af' : (sample.is_training ? '#6366f1' : '#e0e7ff'),
            color: sample.is_training ? 'white' : '#3730a3',
            border: sample.is_training ? 'none' : '1px solid #c7d2fe',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: archiving ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          {archiving ? 'Updating...' : (sample.is_training ? '❌ Remove Training Status' : '🎓 Mark as Training')}
        </button>

        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            marginTop: '12px',
            width: '100%',
            padding: '10px',
            background: deleting ? '#9ca3af' : '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: deleting ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          {deleting ? 'Deleting...' : '🗑️ Delete Sample'}
        </button>
      </div>

      {/* Movement History */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px'
      }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#374151' }}>
          Movement History
        </h4>

        {sortedHistory.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: '14px', fontStyle: 'italic' }}>
            No history recorded
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sortedHistory.map((event, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  borderLeft: '3px solid #3b82f6',
                  fontSize: '13px'
                }}
              >
                <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: '4px' }}>
                  {getActionLabel(event.action)}
                </div>
                <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '8px' }}>
                  {formatDateTime(event.when)}
                </div>
                {event.from_container && event.to_container && (
                  <div style={{ fontSize: '12px', color: '#4b5563' }}>
                    From: {getContainerDisplay(event.from_container)} ({event.from_position})<br />
                    To: {getContainerDisplay(event.to_container)} ({event.to_position})
                  </div>
                )}
                {event.to_container && !event.from_container && (
                  <div style={{ fontSize: '12px', color: '#4b5563' }}>
                    Container: {getContainerDisplay(event.to_container)} ({event.to_position})
                  </div>
                )}
                {event.user && (
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    By: {event.user}
                  </div>
                )}
                {event.source && (
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                    Source: {event.source}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
