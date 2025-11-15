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

  const loadContainer = async (skipLoadingState = false) => {
    if (!skipLoadingState) setLoading(true)
    try{
      const { data: containerData, error } = await supabase
        .from('containers')
        .select('*, samples!samples_container_id_fkey(*)')
        .eq('id', id)
        .single()
      
      if (error) throw error
      setData(containerData)
      return containerData
    }catch(e){
      console.warn('failed to load container', e)
      setData(null)
      return null
    }finally{ 
      if (!skipLoadingState) setLoading(false) 
    }
  }

  useEffect(() => {
    loadContainer()
  }, [id])
  
  // Focus input only when scanning mode starts (not on every position change)
  useEffect(() => {
    if (scanningMode && scanInputRef.current) {
      scanInputRef.current.focus()
    }
  }, [scanningMode])
  
  // Helper to find next empty position (column priority: A1, B1, C1... then A2, B2, C2...)
  const findNextEmptyPosition = (): string | null => {
    if (!data) return null
    const samples = data.samples || []
    // Include ALL samples (archived and active) as occupied positions
    const occupiedPositions = new Set(
      samples.map((s: any) => s.position?.toUpperCase())
    )
    
    // Parse layout
    const layoutParts = (data.layout || '9x9').toLowerCase().split('x')
    const rows = parseInt(layoutParts[0]) || 9
    const cols = parseInt(layoutParts[1]) || 9
    
    // For DP Pools, I9 is unavailable
    const isUnavailable = (pos: string) => {
      return pos === 'I9' && data.type === 'DP Pools' && data.layout === '9x9'
    }
    
    // Find first empty position (column by column, top to bottom, left to right)
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        // IDT Plates use column letter + row number (e.g., A1, B2, C3)
        // For IDT Plates, row 1 is at bottom, so row index 0 = row 14, index 1 = row 13, etc.
        // This makes it scan from top (A14) down (A13, A12...) then next column (B14, B13...)
        // Other containers use row letter + column number (e.g., A1, B2, C3)
        const position = data.type === 'IDT Plates' 
          ? `${String.fromCharCode(65 + c)}${rows - r}`
          : `${String.fromCharCode(65 + r)}${c + 1}`
        if (!occupiedPositions.has(position) && !isUnavailable(position)) {
          return position
        }
      }
    }
    return null
  }

  const handleSampleClick = (sample: any | null, position: string) => {
    // Check if position is unavailable for DP Pools
    const isUnavailable = position === 'I9' && data?.type === 'DP Pools' && data?.layout === '9x9'
    if (isUnavailable) {
      alert('Position I9 is unavailable for DP Pools containers (DP sets come in groups of 4)')
      return
    }
    
    if (scanningMode) {
      // In scanning mode, clicking sets the current position (even if occupied)
      setCurrentPosition(position)
      setScanInput('')
      setLastScannedId(null)
      // Don't auto-focus - user manually selected, they need to click input
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
    
    // Check if position is already occupied
    const samples = data.samples || []
    const existingSample = samples.find(
      (s: any) => !s.is_archived && s.position?.toUpperCase() === currentPosition.toUpperCase()
    )
    
    if (existingSample) {
      const confirmOverwrite = window.confirm(
        `Position ${currentPosition} already contains sample "${existingSample.sample_id}".\n\nDo you want to overwrite it?`
      )
      if (!confirmOverwrite) {
        setScanInput('')
        scanInputRef.current?.focus()
        return
      }
    }
    
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
      
      // Clear input first
      setScanInput('')
      
      // Reload container to get updated sample list (skip loading state to avoid blip)
      const updatedData = await loadContainer(true)
      
      // After reload, advance to next position using fresh data
      if (updatedData && currentPosition) {
        const samples = updatedData.samples || []
        // Include ALL samples (archived and active) as occupied positions
        const occupiedPositions = new Set(
          samples.map((s: any) => s.position?.toUpperCase())
        )
        
        // Parse layout
        const layoutParts = (updatedData.layout || '9x9').toLowerCase().split('x')
        const rows = parseInt(layoutParts[0]) || 9
        const cols = parseInt(layoutParts[1]) || 9
        const isIDTPlates = updatedData.type === 'IDT Plates'
        
        // For DP Pools, I9 is unavailable
        const isUnavailable = (pos: string) => {
          return pos === 'I9' && updatedData.type === 'DP Pools' && updatedData.layout === '9x9'
        }
        
        // Parse current position to get row and column indices
        const currentPosUpper = currentPosition.toUpperCase()
        let currentRow: number, currentCol: number
        
        if (isIDTPlates) {
          // IDT Plates: Column letter + Row number (e.g., A14, B13)
          currentCol = currentPosUpper.charCodeAt(0) - 65 // A=0, B=1, etc.
          currentRow = rows - parseInt(currentPosUpper.slice(1)) // 14=0, 13=1, ..., 1=13
        } else {
          // Regular containers: Row letter + Column number (e.g., A1, B2)
          currentRow = currentPosUpper.charCodeAt(0) - 65 // A=0, B=1, etc.
          currentCol = parseInt(currentPosUpper.slice(1)) - 1 // 1=0, 2=1, etc.
        }
        
        // Find next empty position starting from current position, going down then right
        let nextPosition: string | null = null
        
        // Start from current column, but next row
        for (let c = currentCol; c < cols; c++) {
          // If same column as current, start from next row; otherwise start from top
          const startRow = (c === currentCol) ? currentRow + 1 : 0
          
          for (let r = startRow; r < rows; r++) {
            const position = isIDTPlates
              ? `${String.fromCharCode(65 + c)}${rows - r}` // Column letter + row number (A14, A13...)
              : `${String.fromCharCode(65 + r)}${c + 1}` // Row letter + column number (A1, B1...)
            if (!occupiedPositions.has(position) && !isUnavailable(position)) {
              nextPosition = position
              break
            }
          }
          if (nextPosition) break
        }
        
        // If no position found forward, wrap around from beginning
        if (!nextPosition) {
          for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
              const position = isIDTPlates
                ? `${String.fromCharCode(65 + c)}${rows - r}` // Column letter + row number
                : `${String.fromCharCode(65 + r)}${c + 1}` // Row letter + column number
              if (!occupiedPositions.has(position) && !isUnavailable(position)) {
                nextPosition = position
                break
              }
            }
            if (nextPosition) break
          }
        }
        
        if (nextPosition) {
          setCurrentPosition(nextPosition)
        }
      }
      
      // Always refocus
      setLastScannedId(null)
      setTimeout(() => scanInputRef.current?.focus(), 50)
      
    } catch (error) {
      console.error('Scan error:', error)
      alert('Failed to add sample')
      scanInputRef.current?.focus()
    } finally {
      setScanning(false)
    }
  }

  const handleSidebarUpdate = async () => {
    setShowSidebar(false)
    setSelectedSample(null)
    await loadContainer(true)
  }

  if (loading) return <div className="muted">Loading container...</div>
  if (!data) return <div className="muted">Container not found</div>

  const samples = data.samples || []
  const activeCount = samples.filter((s: any) => !s.is_archived).length

  // Calculate effective total based on layout
  const layoutParts = (data.layout || '9x9').toLowerCase().split('x')
  const rows = parseInt(layoutParts[0]) || 9
  const cols = parseInt(layoutParts[1]) || 9
  let effectiveTotal = rows * cols
  
  // DP Pools 9x9 have I9 unavailable, so effective capacity is 80 not 81
  if (data.type === 'DP Pools' && data.layout === '9x9' && effectiveTotal === 81) {
    effectiveTotal = 80
  }

  // Check for returnTo parameter in URL
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1])
  const returnTo = urlParams.get('returnTo')
  const backUrl = returnTo === 'samples' ? '#/samples' : '#/containers'

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
            {activeCount}/{effectiveTotal} filled
          </div>
          <button 
            className="btn ghost" 
            onClick={() => { window.location.hash = backUrl }}
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
          onDelete={handleSidebarUpdate}
        />
      )}
    </div>
  )
}
