import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

const TAG_COLOR_PALETTE = [
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#f97316',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#84cc16',
  '#06b6d4'
]

const pickRandomTagColor = (existingColors: string[]) => {
  const used = new Set(existingColors.map((c) => String(c || '').toLowerCase()))
  const available = TAG_COLOR_PALETTE.filter((c) => !used.has(c.toLowerCase()))
  const choices = available.length > 0 ? available : TAG_COLOR_PALETTE
  return choices[Math.floor(Math.random() * choices.length)]
}

export default function TagsManager() {
  const [tags, setTags] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#94a3b8')
  const [newHighlight, setNewHighlight] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#94a3b8')
  const [editHighlight, setEditHighlight] = useState(true)
  const [editArchived, setEditArchived] = useState(false)

  const readErrorDetail = async (res: Response) => {
    try {
      const data = await res.clone().json()
      if (data?.error) return String(data.error)
      return JSON.stringify(data)
    } catch {
      try {
        const text = await res.text()
        return text
      } catch {
        return ''
      }
    }
  }

  const loadTags = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/tags?includeArchived=1')
      if (!res.ok) {
        const detail = await readErrorDetail(res)
        throw new Error(`Failed to load tags (${res.status}): ${detail || res.statusText}`)
      }
      const payload = await res.json()
      const nextTags = payload?.data || []
      setTags(nextTags)
      if (!newName.trim()) {
        setNewColor(pickRandomTagColor(nextTags.map((tag: any) => tag?.color)))
      }
    } catch (err) {
      console.error('Failed to load tags:', err)
      setTags([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTags()
  }, [])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return

    setSaving(true)
    try {
      const res = await apiFetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: newColor || '#94a3b8', highlight: newHighlight })
      })
      if (!res.ok) {
        const detail = await readErrorDetail(res)
        throw new Error(`Failed to create tag (${res.status}): ${detail || res.statusText}`)
      }
      setNewName('')
      setNewHighlight(true)
      await loadTags()
    } catch (err: any) {
      console.error('Failed to create tag:', err)
      alert(`Failed to create tag: ${err?.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (tag: any) => {
    setEditingId(tag.id)
    setEditName(tag.name || '')
    setEditColor(tag.color || '#94a3b8')
    setEditHighlight(tag.highlight !== undefined ? !!tag.highlight : true)
    setEditArchived(!!tag.archived)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditColor('#94a3b8')
    setEditHighlight(true)
    setEditArchived(false)
  }

  const saveEdit = async () => {
    if (!editingId) return
    const name = editName.trim()
    if (!name) return

    setSaving(true)
    try {
      const res = await apiFetch('/api/tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, name, color: editColor || '#94a3b8', highlight: editHighlight, archived: editArchived })
      })
      if (!res.ok) {
        const detail = await readErrorDetail(res)
        throw new Error(`Failed to update tag (${res.status}): ${detail || res.statusText}`)
      }
      await loadTags()
      cancelEdit()
    } catch (err: any) {
      console.error('Failed to update tag:', err)
      alert(`Failed to update tag: ${err?.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tag: any) => {
    if (!window.confirm(`Delete tag "${tag.name}"? This will remove it from all samples.`)) return

    setSaving(true)
    try {
      const res = await apiFetch('/api/tags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tag.id })
      })
      if (!res.ok) {
        const detail = await readErrorDetail(res)
        throw new Error(`Failed to delete tag (${res.status}): ${detail || res.statusText}`)
      }
      await loadTags()
    } catch (err: any) {
      console.error('Failed to delete tag:', err)
      alert(`Failed to delete tag: ${err?.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Tags</h2>
          <div className="muted" style={{ marginTop: 4 }}>Create, edit, archive, and delete sample tags.</div>
        </div>
      </div>

      <div style={{ padding: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>New Tag</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tag name"
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 13,
              minWidth: 200
            }}
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            style={{ width: 40, height: 32, border: 'none', background: 'transparent' }}
            aria-label="Tag color"
          />
          <label className="toggle-row" style={{ gap: 6 }}>
            <input
              className="toggle-input"
              type="checkbox"
              checked={newHighlight}
              onChange={(e) => setNewHighlight(e.target.checked)}
            />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Highlight samples</span>
          </label>
          <button className="btn" onClick={handleCreate} disabled={saving || !newName.trim()}>
            {saving ? 'Saving...' : 'Create Tag'}
          </button>
        </div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: 'white', overflow: 'hidden' }}>
        <div style={{ padding: 12, background: '#f3f4f6', fontWeight: 600 }}>All Tags</div>
        {loading && <div className="muted" style={{ padding: 12 }}>Loading tags...</div>}
        {!loading && tags.length === 0 && <div className="muted" style={{ padding: 12 }}>No tags yet</div>}
        {!loading && tags.length > 0 && (
          <div>
            {tags.map((tag) => (
              <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderTop: '1px solid #e5e7eb', opacity: tag.archived ? 0.72 : 1 }}>
                <div style={{ width: 16, height: 16, borderRadius: 9999, background: tag.color || '#94a3b8' }} />
                <div style={{ flex: 1 }}>
                  {editingId === tag.id ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 8,
                          border: '1px solid #d1d5db',
                          fontSize: 13,
                          minWidth: 180
                        }}
                      />
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        style={{ width: 36, height: 30, border: 'none', background: 'transparent' }}
                        aria-label="Tag color"
                      />
                      <label className="toggle-row" style={{ gap: 6 }}>
                        <input
                          className="toggle-input"
                          type="checkbox"
                          checked={editHighlight}
                          onChange={(e) => setEditHighlight(e.target.checked)}
                        />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>Highlight samples</span>
                      </label>
                      <label className="toggle-row" style={{ gap: 6 }}>
                        <input
                          className="toggle-input"
                          type="checkbox"
                          checked={editArchived}
                          onChange={(e) => setEditArchived(e.target.checked)}
                        />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>Archived</span>
                      </label>
                      <button className="btn" onClick={saveEdit} disabled={saving || !editName.trim()}>
                        Save
                      </button>
                      <button className="btn ghost" onClick={cancelEdit} disabled={saving}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 600 }}>{tag.name}</div>
                      <span className="muted" style={{ fontSize: 12 }}>{tag.color}</span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {tag.highlight === false ? 'No highlight' : 'Highlights'}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: tag.archived ? '#e5e7eb' : '#dcfce7',
                          color: tag.archived ? '#4b5563' : '#166534'
                        }}
                      >
                        {tag.archived ? 'Archived' : 'Active'}
                      </span>
                    </div>
                  )}
                </div>
                {editingId !== tag.id && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn ghost" onClick={() => startEdit(tag)} disabled={saving}>Edit</button>
                    <button className="btn ghost" onClick={() => handleDelete(tag)} disabled={saving} style={{ color: '#ef4444' }}>
                      Delete
                    </button>
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
