import React, {useEffect, useState} from 'react'
import ContainerGridView from './ContainerGridView'
import SampleHistorySidebar from './SampleHistorySidebar'
import { getApiUrl } from '../lib/api'
import { getToken } from '../lib/auth'

export default function ContainerDetails({ id }: { id: string | number }){
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [selectedSample, setSelectedSample] = useState<any | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)

  const loadContainer = async () => {
    setLoading(true)
    try{
      const res = await fetch(getApiUrl(`/api/containers/${encodeURIComponent(String(id))}`))
      if (!res.ok) throw new Error('not found')
      const j = await res.json()
      setData(j.data ?? j)
    }catch(e){
      console.warn('failed to load container', e)
      setData(null)
    }finally{ 
      setLoading(false) 
    }
  }

  useEffect(() => {
    loadContainer()
  }, [id])

  const handleSampleClick = (sample: any | null, position: string) => {
    if (!editMode) return
    
    if (sample) {
      // Existing sample clicked - show sidebar
      setSelectedSample(sample)
      setShowSidebar(true)
    } else {
      // Empty cell clicked - prompt for sample ID
      const sampleId = prompt(`Add sample to position ${position}:`)
      if (!sampleId) return
      
      handleAddSample(sampleId.trim(), position)
    }
  }

  const handleAddSample = async (sampleId: string, position: string) => {
    try {
      const token = getToken()
      
      // Create or move sample to this position
      const res = await fetch('/api/samples/upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sample_id: sampleId,
          container_id: data.id,
          position: position,
          data: {
            added_via: 'grid_edit',
            added_at: new Date().toISOString()
          }
        })
      })

      if (!res.ok) throw new Error('Failed to add sample')
      
      // Reload container
      await loadContainer()
    } catch (error) {
      console.error('Add sample error:', error)
      alert('Failed to add sample')
    }
  }

  const handleSidebarUpdate = async () => {
    setShowSidebar(false)
    setSelectedSample(null)
    await loadContainer()
  }

  if (loading) return <div className="muted">Loading container...</div>
  if (!data) return <div className="muted">Container not found</div>

  const samples = data.samples || []
  const activeCount = samples.filter((s: any) => !s.is_archived).length

  return (
    <div style={{ position: 'relative' }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:20}}>
        <div>
          <h2 style={{margin:0}}>{data.name || `Container ${data.id}`}</h2>
          <div className="muted">Location: {data.location || 'Not specified'}</div>
          <div className="muted">
            ID: {data.id} • {data.type} • {data.layout} • {data.temperature}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{
            padding: '8px 12px',
            background: '#eff6ff',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            color: '#1e40af'
          }}>
            {activeCount}/{data.total} filled
          </div>
          <button 
            className="btn ghost" 
            onClick={() => { window.location.hash = '#/containers' }}
          >
            Back
          </button>
          <button 
            className="btn"
            onClick={() => setEditMode(!editMode)}
            style={{
              background: editMode ? '#10b981' : '#3b82f6',
              color: 'white'
            }}
          >
            {editMode ? '✓ Done Editing' : '✏️ Edit'}
          </button>
        </div>
      </div>

      {editMode && (
        <div style={{
          padding: '12px 16px',
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '14px',
          color: '#92400e'
        }}>
          <strong>Edit Mode:</strong> Click empty cells to add samples, or click filled cells to view history and archive.
        </div>
      )}

      <div style={{marginTop:20}}>
        <ContainerGridView 
          container={data}
          samples={samples}
          editMode={editMode}
          onSampleClick={handleSampleClick}
        />
      </div>

      {showSidebar && selectedSample && (
        <SampleHistorySidebar
          sample={selectedSample}
          onClose={() => {
            setShowSidebar(false)
            setSelectedSample(null)
          }}
          onUpdate={handleSidebarUpdate}
          onArchive={handleSidebarUpdate}
        />
      )}
    </div>
  )
}
