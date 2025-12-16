import React, { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'

interface SampleType {
  id: string
  name: string
  description: string | null
  color: string
  default_temperature: string | null
  is_system: boolean
}

interface ContainerType {
  id: string
  name: string
  description: string | null
  rows: number
  columns: number
  default_temperature: string | null
  is_system: boolean
}

export default function TypesManager() {
  const [activeTab, setActiveTab] = useState<'samples' | 'containers'>('samples')
  
  // Sample types state
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([])
  const [loadingSamples, setLoadingSamples] = useState(true)
  const [showAddSample, setShowAddSample] = useState(false)
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null)
  
  // Container types state
  const [containerTypes, setContainerTypes] = useState<ContainerType[]>([])
  const [loadingContainers, setLoadingContainers] = useState(true)
  const [showAddContainer, setShowAddContainer] = useState(false)
  const [editingContainerId, setEditingContainerId] = useState<string | null>(null)
  
  // Form state
  const [sampleForm, setSampleForm] = useState({
    name: '',
    description: '',
    color: '#6b7280',
    default_temperature: '-80°C'
  })
  
  const [containerForm, setContainerForm] = useState({
    name: '',
    description: '',
    rows: 9,
    columns: 9,
    default_temperature: '-80°C'
  })
  
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Auto-clear notices
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])
  
  // Load sample types
  useEffect(() => {
    loadSampleTypes()
  }, [])
  
  // Load container types
  useEffect(() => {
    loadContainerTypes()
  }, [])
  
  async function loadSampleTypes() {
    try {
      setLoadingSamples(true)
      const data = await apiFetch('/api/sample_types').then(r => r.json())
      setSampleTypes(data)
    } catch (e) {
      console.error('Failed to load sample types:', e)
      setNotice({ type: 'error', text: 'Failed to load sample types' })
    } finally {
      setLoadingSamples(false)
    }
  }
  
  async function loadContainerTypes() {
    try {
      setLoadingContainers(true)
      const data = await apiFetch('/api/container_types').then(r => r.json())
      setContainerTypes(data)
    } catch (e) {
      console.error('Failed to load container types:', e)
      setNotice({ type: 'error', text: 'Failed to load container types' })
    } finally {
      setLoadingContainers(false)
    }
  }
  
  async function handleCreateSampleType() {
    try {
      const res = await apiFetch('/api/sample_types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleForm)
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create sample type')
      }
      
      setNotice({ type: 'success', text: 'Sample type created successfully' })
      setSampleForm({ name: '', description: '', color: '#6b7280', default_temperature: '-80°C' })
      setShowAddSample(false)
      loadSampleTypes()
      // Notify other components that types have changed
      window.dispatchEvent(new Event('sample_types_updated'))
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'Failed to create sample type' })
    }
  }
  
  async function handleUpdateSampleType(id: string, updates: Partial<SampleType>) {
    try {
      const res = await apiFetch('/api/sample_types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update sample type')
      }
      
      setNotice({ type: 'success', text: 'Sample type updated successfully' })
      setEditingSampleId(null)
      loadSampleTypes()
      window.dispatchEvent(new Event('sample_types_updated'))
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'Failed to update sample type' })
    }
  }
  
  async function handleDeleteSampleType(id: string, name: string) {
    if (!confirm(`Delete sample type "${name}"? This cannot be undone.`)) return
    
    try {
      const res = await apiFetch(`/api/sample_types?id=${id}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete sample type')
      }
      
      setNotice({ type: 'success', text: 'Sample type deleted successfully' })
      loadSampleTypes()
      window.dispatchEvent(new Event('sample_types_updated'))
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'Failed to delete sample type' })
    }
  }
  
  async function handleCreateContainerType() {
    try {
      const res = await apiFetch('/api/container_types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(containerForm)
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create container type')
      }
      
      setNotice({ type: 'success', text: 'Container type created successfully' })
      setContainerForm({ name: '', description: '', rows: 9, columns: 9, default_temperature: '-80°C' })
      setShowAddContainer(false)
      loadContainerTypes()
      window.dispatchEvent(new Event('container_types_updated'))
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'Failed to create container type' })
    }
  }
  
  async function handleUpdateContainerType(id: string, updates: Partial<ContainerType>) {
    try {
      const res = await apiFetch('/api/container_types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update container type')
      }
      
      setNotice({ type: 'success', text: 'Container type updated successfully' })
      setEditingContainerId(null)
      loadContainerTypes()
      window.dispatchEvent(new Event('container_types_updated'))
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'Failed to update container type' })
    }
  }
  
  async function handleDeleteContainerType(id: string, name: string) {
    if (!confirm(`Delete container type "${name}"? This cannot be undone.`)) return
    
    try {
      const res = await apiFetch(`/api/container_types?id=${id}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete container type')
      }
      
      setNotice({ type: 'success', text: 'Container type deleted successfully' })
      loadContainerTypes()
      window.dispatchEvent(new Event('container_types_updated'))
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'Failed to delete container type' })
    }
  }
  
  return (
    <div>
      {notice && (
        <div style={{
          padding: 10,
          marginBottom: 12,
          borderRadius: 6,
          background: notice.type === 'success' ? '#e6ffed' : '#ffecec',
          border: notice.type === 'success' ? '1px solid #b7f2c9' : '1px solid #f5c6c6',
          color: notice.type === 'success' ? '#0b6b2b' : '#8a1b1b'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>{notice.text}</div>
            <button className="btn ghost" onClick={() => setNotice(null)}>Dismiss</button>
          </div>
        </div>
      )}
      
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={activeTab === 'samples' ? 'btn' : 'btn ghost'}
          onClick={() => setActiveTab('samples')}
        >
          Sample Types
        </button>
        <button
          className={activeTab === 'containers' ? 'btn' : 'btn ghost'}
          onClick={() => setActiveTab('containers')}
        >
          Container Types
        </button>
      </div>
      
      {activeTab === 'samples' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p className="muted">Define custom sample types with colors and default settings</p>
            <button className="btn" onClick={() => setShowAddSample(!showAddSample)}>
              {showAddSample ? 'Cancel' : '+ Add Sample Type'}
            </button>
          </div>
          
          {showAddSample && (
            <div style={{ border: '1px solid #eee', padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>New Sample Type</h3>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Name *</label>
                  <input
                    type="text"
                    value={sampleForm.name}
                    onChange={e => setSampleForm({ ...sampleForm, name: e.target.value })}
                    placeholder="e.g., RNA Tubes"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Description</label>
                  <input
                    type="text"
                    value={sampleForm.description}
                    onChange={e => setSampleForm({ ...sampleForm, description: e.target.value })}
                    placeholder="Optional description"
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Color *</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="color"
                        value={sampleForm.color}
                        onChange={e => setSampleForm({ ...sampleForm, color: e.target.value })}
                      />
                      <input
                        type="text"
                        value={sampleForm.color}
                        onChange={e => setSampleForm({ ...sampleForm, color: e.target.value })}
                        placeholder="#6b7280"
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Default Temperature</label>
                    <select
                      value={sampleForm.default_temperature}
                      onChange={e => setSampleForm({ ...sampleForm, default_temperature: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="-80°C">-80°C</option>
                      <option value="-20°C">-20°C</option>
                      <option value="4°C">4°C</option>
                      <option value="RT">Room Temperature</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={handleCreateSampleType}>Create</button>
                  <button className="btn ghost" onClick={() => {
                    setShowAddSample(false)
                    setSampleForm({ name: '', description: '', color: '#6b7280', default_temperature: '-80°C' })
                  }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          
          {loadingSamples ? (
            <div className="muted">Loading sample types...</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {sampleTypes.map(st => (
                <div
                  key={st.id}
                  style={{
                    border: '1px solid #eee',
                    padding: 12,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                      background: st.color,
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong>{st.name}</strong>
                      {st.is_system && (
                        <span style={{
                          fontSize: 11,
                          padding: '2px 6px',
                          background: '#e5e7eb',
                          color: '#374151',
                          borderRadius: 3,
                          fontWeight: 600
                        }}>SYSTEM</span>
                      )}
                    </div>
                    {st.description && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{st.description}</div>}
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {st.default_temperature && `Default: ${st.default_temperature}`}
                    </div>
                  </div>
                  {!st.is_system && (
                    <button
                      className="btn ghost"
                      onClick={() => handleDeleteSampleType(st.id, st.name)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'containers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p className="muted">Define custom container layouts with grid dimensions</p>
            <button className="btn" onClick={() => setShowAddContainer(!showAddContainer)}>
              {showAddContainer ? 'Cancel' : '+ Add Container Type'}
            </button>
          </div>
          
          {showAddContainer && (
            <div style={{ border: '1px solid #eee', padding: 16, borderRadius: 6, marginBottom: 16 }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>New Container Type</h3>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Name *</label>
                  <input
                    type="text"
                    value={containerForm.name}
                    onChange={e => setContainerForm({ ...containerForm, name: e.target.value })}
                    placeholder="e.g., 12x8 or Large Box"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Description</label>
                  <input
                    type="text"
                    value={containerForm.description}
                    onChange={e => setContainerForm({ ...containerForm, description: e.target.value })}
                    placeholder="Optional description"
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Rows *</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={containerForm.rows}
                      onChange={e => setContainerForm({ ...containerForm, rows: parseInt(e.target.value) || 1 })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Columns *</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={containerForm.columns}
                      onChange={e => setContainerForm({ ...containerForm, columns: parseInt(e.target.value) || 1 })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Temperature</label>
                    <select
                      value={containerForm.default_temperature}
                      onChange={e => setContainerForm({ ...containerForm, default_temperature: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="-80°C">-80°C</option>
                      <option value="-20°C">-20°C</option>
                      <option value="4°C">4°C</option>
                      <option value="RT">Room Temperature</option>
                    </select>
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Total positions: {containerForm.rows * containerForm.columns}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={handleCreateContainerType}>Create</button>
                  <button className="btn ghost" onClick={() => {
                    setShowAddContainer(false)
                    setContainerForm({ name: '', description: '', rows: 9, columns: 9, default_temperature: '-80°C' })
                  }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          
          {loadingContainers ? (
            <div className="muted">Loading container types...</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {containerTypes.map(ct => (
                <div
                  key={ct.id}
                  style={{
                    border: '1px solid #eee',
                    padding: 12,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      border: '2px solid #cbd5e1',
                      borderRadius: 6,
                      display: 'grid',
                      gridTemplateColumns: `repeat(${Math.min(ct.columns, 5)}, 1fr)`,
                      gridTemplateRows: `repeat(${Math.min(ct.rows, 5)}, 1fr)`,
                      gap: 1,
                      background: '#f1f5f9',
                      padding: 4,
                      flexShrink: 0
                    }}
                  >
                    {Array.from({ length: Math.min(ct.rows * ct.columns, 25) }).map((_, i) => (
                      <div key={i} style={{ background: '#cbd5e1', borderRadius: 1 }} />
                    ))}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong>{ct.name}</strong>
                      {ct.is_system && (
                        <span style={{
                          fontSize: 11,
                          padding: '2px 6px',
                          background: '#e5e7eb',
                          color: '#374151',
                          borderRadius: 3,
                          fontWeight: 600
                        }}>SYSTEM</span>
                      )}
                    </div>
                    {ct.description && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{ct.description}</div>}
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {ct.rows} × {ct.columns} ({ct.rows * ct.columns} positions)
                      {ct.default_temperature && ` • ${ct.default_temperature}`}
                    </div>
                  </div>
                  {!ct.is_system && (
                    <button
                      className="btn ghost"
                      onClick={() => handleDeleteContainerType(ct.id, ct.name)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
