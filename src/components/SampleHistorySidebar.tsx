import React, { useEffect, useState } from 'react'
import { getToken } from '../lib/auth'
import { apiFetch } from '../lib/api'
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
  sample_tags?: Array<{ tags?: { id?: string; name?: string; color?: string } }>
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
  const [checkingOut, setCheckingOut] = useState(false)
  const [containerNames, setContainerNames] = useState<Map<string, string>>(new Map())
  const [tags, setTags] = useState<any[]>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#94a3b8')
  const [creatingTag, setCreatingTag] = useState(false)
  const [updatingTags, setUpdatingTags] = useState(false)

  const readableTextColor = (hex: string) => {
    try {
      const h = hex.replace('#','')
      const r = parseInt(h.substring(0,2),16)/255
      const g = parseInt(h.substring(2,4),16)/255
      const b = parseInt(h.substring(4,6),16)/255
      const Rs = r <= 0.03928 ? r/12.92 : Math.pow((r+0.055)/1.055, 2.4)
      const Gs = g <= 0.03928 ? g/12.92 : Math.pow((g+0.055)/1.055, 2.4)
      const Bs = b <= 0.03928 ? b/12.92 : Math.pow((b+0.055)/1.055, 2.4)
      const lum = 0.2126 * Rs + 0.7152 * Gs + 0.0722 * Bs
      return lum > 0.6 ? '#111827' : '#ffffff'
    } catch (e) {
      return '#111827'
    }
  }

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

  useEffect(() => {
    if (!sample) return
    const existingTags = (sample.sample_tags || [])
      .map((t: any) => t.tags?.id)
      .filter(Boolean)
    setSelectedTagIds(new Set(existingTags))
  }, [sample?.id])

  useEffect(() => {
    if (!sample) return
    loadTags()
  }, [sample?.id])

  const loadTags = async () => {
    setLoadingTags(true)
    try {
      const res = await apiFetch('/api/tags')
      if (!res.ok) throw new Error('Failed to load tags')
      const payload = await res.json()
      setTags(payload?.data || [])
    } catch (error) {
      console.error('Failed to load tags:', error)
      setTags([])
    } finally {
      setLoadingTags(false)
    }
  }

  const toggleTag = async (tagId: string) => {
    if (!sample) return
    setUpdatingTags(true)
    try {
      if (selectedTagIds.has(tagId)) {
        const res = await apiFetch('/api/sample-tags', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sample_id: sample.id, tag_id: tagId })
        })

        if (!res.ok) throw new Error('Failed to remove tag')
        setSelectedTagIds(prev => {
          const next = new Set(prev)
          next.delete(tagId)
          return next
        })
      } else {
        const res = await apiFetch('/api/sample-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sample_id: sample.id, tag_id: tagId })
        })

        if (!res.ok) throw new Error('Failed to add tag')
        setSelectedTagIds(prev => new Set([...prev, tagId]))
      }

      onUpdate?.()
      window.dispatchEvent(new CustomEvent('samples-updated'))
    } catch (error: any) {
      console.error('Failed to update tags:', error)
      alert(`Failed to update tags: ${error?.message || 'Unknown error'}`)
    } finally {
      setUpdatingTags(false)
    }
  }

  const handleCreateTag = async () => {
    const name = newTagName.trim()
    if (!name) return

    setCreatingTag(true)
    try {
      const res = await apiFetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: newTagColor || '#94a3b8' })
      })

      if (!res.ok) throw new Error('Failed to create tag')
      const payload = await res.json()
      const created = payload?.data
      setTags((prev) => [...prev, created].sort((a, b) => String(a.name).localeCompare(String(b.name))))
      setNewTagName('')
      await toggleTag(created.id)
      window.dispatchEvent(new CustomEvent('samples-updated'))
    } catch (error: any) {
      console.error('Failed to create tag:', error)
      alert(`Failed to create tag: ${error?.message || 'Unknown error'}`)
    } finally {
      setCreatingTag(false)
    }
  }

  const getContainerDisplay = (containerId: string | undefined) => {
    if (!containerId) return 'Unknown'
    return containerNames.get(containerId) || containerId
  }

  const handleArchiveToggle = async () => {
    const newArchivedState = !sample.is_archived
    if (!window.confirm(`${newArchivedState ? 'Archive' : 'Unarchive'} ${sample.sample_id}?`)) {
      return
    }

    setArchiving(true)
    try {
      const token = localStorage.getItem('token')
      const res = await apiFetch(`/api/samples/${sample.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_archived: newArchivedState })
      })

      if (!res.ok) throw new Error('Failed to update archive status')
      
      onArchive?.(sample.id)
      onUpdate?.()
    } catch (error) {
      console.error('Archive toggle error:', error)
      alert('Failed to update archive status')
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
      const res = await apiFetch(`/api/samples/${sample.id}`, {
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

  const handleCheckout = async () => {
    if (!window.confirm(`Check out ${sample.sample_id}? This will remove it from the container and mark it as checked out.`)) {
      return
    }

    setCheckingOut(true)
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const userInitials = user.initials || 'Unknown'

      const { error } = await supabase
        .from('samples')
        .update({
          is_checked_out: true,
          checked_out_at: new Date().toISOString(),
          checked_out_by: userInitials,
          previous_container_id: sample.container_id,
          previous_position: sample.position,
          container_id: null,
          position: null
        })
        .eq('id', sample.id)

      if (error) {
        console.error('Checkout error:', error)
        alert(`Failed to checkout sample: ${error.message}`)
        return
      }
      
      onUpdate?.()
      onClose()
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to checkout sample')
    } finally {
      setCheckingOut(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete ${sample.sample_id}? This action cannot be undone.`)) {
      return
    }

    setDeleting(true)
    try {
      const token = localStorage.getItem('token')
      const res = await apiFetch(`/api/samples/${sample.id}`, {
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

  const formatHistoryDescription = (event: HistoryEvent): string => {
    const fromContainer = getContainerDisplay(event.from_container)
    const toContainer = getContainerDisplay(event.to_container)
    
    if (event.action === 'moved' && event.from_container && event.to_container) {
      if (event.from_container === event.to_container) {
        return `Moved within ${toContainer} (${event.from_position} > ${event.to_position})`
      }
      return `Moved from ${fromContainer} (${event.from_position}) > ${toContainer} (${event.to_position})`
    }
    
    if (event.action === 'inserted' && event.to_container) {
      return `Scanned into ${toContainer} (${event.to_position})`
    }
    
    return getActionLabel(event.action)
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

        {/* Tags */}
        <div style={{ marginTop: '16px', padding: '12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: 8 }}>Tags</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {loadingTags && <span className="muted">Loading tags...</span>}
            {!loadingTags && tags.length === 0 && (
              <span className="muted">No tags yet</span>
            )}
            {!loadingTags && tags.map((tag) => {
              const active = selectedTagIds.has(tag.id)
              const color = tag.color || '#94a3b8'
              const bg = active ? color : `${color}22`
              const textColor = active ? readableTextColor(color) : color
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  disabled={updatingTags}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 9999,
                    border: active ? 'none' : `1px solid ${color}55`,
                    background: bg,
                    color: textColor,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: updatingTags ? 'not-allowed' : 'pointer'
                  }}
                >
                  {tag.name}
                </button>
              )
            })}
            {selectedTagIds.size > 0 && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => setSelectedTagIds(new Set())}
                style={{ fontSize: 12, padding: '2px 8px' }}
              >
                Clear tags
              </button>
            )}
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag name"
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 12,
                minWidth: 160
              }}
            />
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              style={{ width: 36, height: 30, border: 'none', background: 'transparent' }}
              aria-label="Tag color"
            />
            <button
              type="button"
              className="btn ghost"
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || creatingTag}
              style={{ fontSize: 12 }}
            >
              {creatingTag ? 'Adding...' : 'Add Tag'}
            </button>
          </div>
        </div>

        {/* Archive Toggle */}
        <div style={{
          marginTop: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px',
          background: '#f9fafb',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>🗄️</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Archive</span>
          </div>
          <button
            onClick={handleArchiveToggle}
            disabled={archiving}
            style={{
              position: 'relative',
              width: '44px',
              height: '24px',
              background: archiving ? '#9ca3af' : (sample.is_archived ? '#ef4444' : '#d1d5db'),
              border: 'none',
              borderRadius: '12px',
              cursor: archiving ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              padding: 0
            }}
          >
            <div style={{
              position: 'absolute',
              top: '2px',
              left: sample.is_archived ? '22px' : '2px',
              width: '20px',
              height: '20px',
              background: 'white',
              borderRadius: '10px',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
          </button>
        </div>

        {/* Training Toggle */}
        <div style={{
          marginTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px',
          background: '#f9fafb',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>🎓</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Training Sample</span>
          </div>
          <button
            onClick={handleTrainingToggle}
            disabled={archiving}
            style={{
              position: 'relative',
              width: '44px',
              height: '24px',
              background: archiving ? '#9ca3af' : (sample.is_training ? '#6366f1' : '#d1d5db'),
              border: 'none',
              borderRadius: '12px',
              cursor: archiving ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              padding: 0
            }}
          >
            <div style={{
              position: 'absolute',
              top: '2px',
              left: sample.is_training ? '22px' : '2px',
              width: '20px',
              height: '20px',
              background: 'white',
              borderRadius: '10px',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
          </button>
        </div>

        {/* Checkout Button */}
        <button
          onClick={handleCheckout}
          disabled={checkingOut}
          style={{
            marginTop: '12px',
            width: '100%',
            padding: '10px',
            background: checkingOut ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: checkingOut ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          {checkingOut ? 'Checking Out...' : '📤 Checkout Sample'}
        </button>

        {/* Delete Button */}
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
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '3px 8px',
                    background: event.action === 'moved' ? '#e0e7ff' : 
                               event.action === 'inserted' ? '#dcfce7' : 
                               event.action === 'archived' ? '#fed7aa' : '#e5e7eb',
                    color: event.action === 'moved' ? '#3730a3' : 
                          event.action === 'inserted' ? '#166534' : 
                          event.action === 'archived' ? '#9a3412' : '#374151',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}>
                    {getActionLabel(event.action)}
                  </span>
                  {event.user && (
                    <span style={{
                      padding: '3px 8px',
                      background: '#f3f4f6',
                      color: '#374151',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600
                    }}>
                      {event.user}
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>
                    {formatDateTime(event.when)}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>
                  {formatHistoryDescription(event)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
