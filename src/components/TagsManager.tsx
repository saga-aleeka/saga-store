import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function TagsManager() {
  const [tags, setTags] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#94a3b8')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#94a3b8')

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
      const res = await apiFetch('/api/tags')
      if (!res.ok) {
        const detail = await readErrorDetail(res)
        throw new Error(`Failed to load tags (${res.status}): ${detail || res.statusText}`)
      }
      const payload = await res.json()
      setTags(payload?.data || [])
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
        body: JSON.stringify({ name, color: newColor || '#94a3b8' })
      })
      if (!res.ok) {
        const detail = await readErrorDetail(res)
        throw new Error(`Failed to create tag (${res.status}): ${detail || res.statusText}`)
      }
      setNewName('')
      setNewColor('#94a3b8')
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
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditColor('#94a3b8')
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
        body: JSON.stringify({ id: editingId, name, color: editColor || '#94a3b8' })
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
          <div className="muted" style={{ marginTop: 4 }}>Create, edit, and delete sample tags.</div>
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
              <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderTop: '1px solid #e5e7eb' }}>
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
