import React, {useEffect, useState} from 'react'
import ContainerGridView from './ContainerGridView'
import SampleHistorySidebar from './SampleHistorySidebar'
import { supabase } from '../lib/api'
import { getToken } from '../lib/auth'

export default function ContainerDetails({ id }: { id: string | number }){
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [selectedSample, setSelectedSample] = useState<any | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  
  // Scanning state
  const [scanningMode, setScanningMode] = useState(false)
  const [currentPosition, setCurrentPosition] = useState<string | null>(null)
  const [scanInput, setScanInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [lastScannedId, setLastScannedId] = useState<string | null>(null)
  const scanInputRef = React.useRef<HTMLInputElement>(null)

  const loadContainer = async () => {
    setLoading(true)
    try{
      const { data, error } = await supabase
        .from('containers')
        .select('*, samples(*)')
        .eq('id', id)
        .single()
      
      if (error) throw error
      setData(data)
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
  
  // Focus input when scanning mode starts or position changes
  useEffect(() => {
    if (scanningMode && scanInputRef.current) {
      scanInputRef.current.focus()
    }
  }, [scanningMode, currentPosition])
  
  // Helper to find next empty position
  const findNextEmptyPosition = (): string | null => {
    if (!data) return null
    const samples = data.samples || []
    const occupiedPositions = new Set(
      samples
        .filter((s: any) => !s.is_archived)
        .map((s: any) => s.position?.toUpperCase())
    )
    
    // Parse layout
    const layoutParts = (data.layout || '9x9').toLowerCase().split('x')
    const rows = parseInt(layoutParts[0]) || 9
    const cols = parseInt(layoutParts[1]) || 9
    
    // Find first empty position (row by row)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const position = `${String.fromCharCode(65 + r)}${c + 1}`
        if (!occupiedPositions.has(position)) {
          return position
        }
      }
    }
    return null
  }

  const handleSampleClick = (sample: any | null, position: string) => {
    if (scanningMode) {
      // In scanning mode, clicking sets the current position
      if (!sample) {
        setCurrentPosition(position)
        setScanInput('')
        setLastScannedId(null)
      }
      return
    }
    
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
  
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scanInput.trim() || !currentPosition || scanning) return
    
    setScanning(true)
    setLastScannedId(null)
    
    try {
      const token = getToken()
      const sampleId = scanInput.trim()
      
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
          position: currentPosition,
          data: {
            added_via: 'scan',
            added_at: new Date().toISOString()
          }
        })
      })

      if (!res.ok) throw new Error('Failed to add sample')
      
      // Show success feedback
      setLastScannedId(sampleId)
      setScanInput('')
      
      // Reload container
      await loadContainer()
      
      // Auto-advance to next empty position
      setTimeout(() => {
        const nextPosition = findNextEmptyPosition()
        if (nextPosition) {
          setCurrentPosition(nextPosition)
          setLastScannedId(null)
        } else {
          // No more empty positions
          alert('Container is full!')
          setScanningMode(false)
          setCurrentPosition(null)
        }
      }, 100)
    } catch (error) {
      console.error('Scan error:', error)
      alert('Failed to add sample')
    } finally {
      setScanning(false)
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
          <h2 style={{margin:0}}>{data.name || 'Unnamed Container'}</h2>
          <div className="muted">Location: {data.location || 'Not specified'}</div>
          <div className="muted">
            {data.type} • {data.layout} • {data.temperature}
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
          {!scanningMode && (
            <>
              <button 
                className="btn"
                onClick={() => {
                  const nextPos = findNextEmptyPosition()
                  if (nextPos) {
                    setScanningMode(true)
                    setCurrentPosition(nextPos)
                    setEditMode(false)
                    setScanInput('')
                    setLastScannedId(null)
                  } else {
                    alert('Container is full!')
                  }
                }}
                style={{
                  background: '#8b5cf6',
                  color: 'white'
                }}
              >
                📷 Start Scanning
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
            </>
          )}
          {scanningMode && (
            <button 
              className="btn"
              onClick={() => {
                setScanningMode(false)
                setCurrentPosition(null)
                setScanInput('')
                setLastScannedId(null)
              }}
              style={{
                background: '#ef4444',
                color: 'white'
              }}
            >
              ✓ Done Scanning
            </button>
          )}
        </div>
      </div>

      {editMode && !scanningMode && (
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
      
      {scanningMode && (
        <div style={{
          padding: '16px',
          background: '#f0f9ff',
          border: '2px solid #7c3aed',
          borderRadius: '12px',
          marginBottom: '16px'
        }}>
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:12}}>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:'#5b21b6',marginBottom:8}}>
                📷 Scanning Mode Active
              </div>
              <div style={{fontSize:13,color:'#6b7280'}}>
                Scan or type sample ID, then press Enter. Click empty cells to change position.
              </div>
            </div>
            {lastScannedId && (
              <div style={{
                padding: '8px 16px',
                background: '#d1fae5',
                border: '1px solid #6ee7b7',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#065f46',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span>✓</span>
                <span>Saved: {lastScannedId}</span>
              </div>
            )}
          </div>
          
          <form onSubmit={handleScanSubmit} style={{display:'flex',gap:12,alignItems:'center'}}>
            <div style={{
              padding: '12px 16px',
              background: '#8b5cf6',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 700,
              color: 'white',
              minWidth: '80px',
              textAlign: 'center'
            }}>
              {currentPosition || 'Select position'}
            </div>
            
            <input
              ref={scanInputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Scan or type sample ID..."
              disabled={!currentPosition || scanning}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '16px',
                border: '2px solid #a78bfa',
                borderRadius: '8px',
                outline: 'none',
                fontFamily: 'monospace'
              }}
              onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
              onBlur={(e) => e.target.style.borderColor = '#a78bfa'}
            />
            
            <button
              type="submit"
              disabled={!scanInput.trim() || !currentPosition || scanning}
              className="btn"
              style={{
                padding: '12px 24px',
                background: scanning ? '#9ca3af' : '#7c3aed',
                color: 'white',
                fontSize: '16px',
                fontWeight: 600
              }}
            >
              {scanning ? 'Saving...' : 'Add →'}
            </button>
          </form>
        </div>
      )}

      <div style={{marginTop:20}}>
        <ContainerGridView 
          container={data}
          samples={samples}
          editMode={editMode || scanningMode}
          onSampleClick={handleSampleClick}
          scanningPosition={scanningMode ? currentPosition : null}
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
