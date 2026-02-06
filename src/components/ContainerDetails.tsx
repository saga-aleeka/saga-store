import React, {useEffect, useState} from 'react'
import ContainerGridView from './ContainerGridView'
import SampleHistorySidebar from './SampleHistorySidebar'
import { supabase } from '../lib/api'
import { getToken } from '../lib/auth'
import { CONTAINER_LOCATION_SELECT, formatContainerLocation } from '../lib/locationUtils'
import LocationBreadcrumb from './LocationBreadcrumb'

export default function ContainerDetails({ id }: { id: string | number }){
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [selectedSample, setSelectedSample] = useState<any | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  
  // Multi-select state for edit mode
  const [selectedSampleIds, setSelectedSampleIds] = useState<Set<string>>(new Set())
  const [deleteConfirmationActive, setDeleteConfirmationActive] = useState(false)
  const [deleteComment, setDeleteComment] = useState('')
  const [archiveComment, setArchiveComment] = useState('')
  const [showArchiveComment, setShowArchiveComment] = useState(false)
  const [showDeleteComment, setShowDeleteComment] = useState(false)
  const [batchActionInProgress, setBatchActionInProgress] = useState(false)
  
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
        .select(`${CONTAINER_LOCATION_SELECT}, samples!samples_container_id_fkey(*)`)
        .eq('id', id)
        .single()
      
      if (error) throw error

      let enriched = containerData

      if (containerData && !containerData.racks && containerData.rack_id) {
        const { data: rackData } = await supabase
          .from('racks')
          .select('id, name, position, cold_storage_id, cold_storage_units: cold_storage_units!racks_cold_storage_id_fkey(id, name, type, temperature, location)')
          .eq('id', containerData.rack_id)
          .single()

        if (rackData) {
          enriched = { ...enriched, racks: rackData }
        }
      }

      if (containerData && !enriched.cold_storage_units && containerData.cold_storage_id) {
        const { data: coldData } = await supabase
          .from('cold_storage_units')
          .select('id, name, type, temperature, location')
          .eq('id', containerData.cold_storage_id)
          .single()

        if (coldData) {
          enriched = { ...enriched, cold_storage_units: coldData }
        }
      }

      setData(enriched)
      return enriched
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

  useEffect(() => {
    const handleRefresh = () => {
      loadContainer(true)
    }
    window.addEventListener('refresh-container', handleRefresh)
    return () => window.removeEventListener('refresh-container', handleRefresh)
  }, [id])
  
  // Focus input only when scanning mode starts (not on every position change)
  useEffect(() => {
    if (scanningMode && scanInputRef.current) {
      scanInputRef.current.focus()
    }
  }, [scanningMode])
  
  // Helper to find next empty position starting from current position or from beginning
  const findNextEmptyPosition = (startFrom?: string | null, containerData?: any): string | null => {
    const dataToUse = containerData || data
    if (!dataToUse) return null
    const samples = dataToUse.samples || []
    // Include ALL samples (archived and active) as occupied positions
    const occupiedPositions = new Set(
      samples.map((s: any) => s.position?.toUpperCase())
    )
    
    // Parse layout
    const layoutParts = (dataToUse.layout || '9x9').toLowerCase().split('x')
    const rows = parseInt(layoutParts[0]) || 9
    const cols = parseInt(layoutParts[1]) || 9
    
    // For DP Pools, I9 is unavailable
    const isUnavailable = (pos: string) => {
      return pos === 'I9' && dataToUse.type === 'DP Pools' && dataToUse.layout === '9x9'
    }
    
    // Determine if we should start from a specific position
    let startCol = 0
    let startRow = 0
    let skipToNext = false
    
    if (startFrom) {
      const startFromUpper = startFrom.toUpperCase()
      if (dataToUse.type === 'IDT Plates') {
        // IDT Plates: column letter + row number (A1, B2, C3)
        const colMatch = startFromUpper.match(/^([A-Z])/)
        const rowMatch = startFromUpper.match(/(\d+)$/)
        if (colMatch && rowMatch) {
          startCol = colMatch[1].charCodeAt(0) - 65
          startRow = parseInt(rowMatch[1]) - 1
          skipToNext = true // Skip the starting position itself
        }
      } else {
        // Standard: row letter + column number (A1, B2, C3)
        const rowMatch = startFromUpper.match(/^([A-Z])/)
        const colMatch = startFromUpper.match(/(\d+)$/)
        if (rowMatch && colMatch) {
          startRow = rowMatch[1].charCodeAt(0) - 65
          startCol = parseInt(colMatch[1]) - 1
          skipToNext = true
        }
      }
    }
    
    // Scan for next empty position
    // For IDT Plates: scan column by column (A1, A2, A3... then B1, B2, B3...)
    // For others: scan column by column (A1, B1, C1... then A2, B2, C2...)
    if (dataToUse.type === 'IDT Plates') {
      // IDT Plates: iterate columns first, then rows
      for (let c = startCol; c < cols; c++) {
        const rStart = (c === startCol && skipToNext) ? startRow + 1 : 0
        for (let r = rStart; r < rows; r++) {
          const position = `${String.fromCharCode(65 + c)}${r + 1}`
          if (!occupiedPositions.has(position) && !isUnavailable(position)) {
            return position
          }
        }
      }
    } else {
      // Standard containers: iterate columns first, then rows
      for (let c = startCol; c < cols; c++) {
        const rStart = (c === startCol && skipToNext) ? startRow + 1 : 0
        for (let r = rStart; r < rows; r++) {
          const position = `${String.fromCharCode(65 + r)}${c + 1}`
          if (!occupiedPositions.has(position) && !isUnavailable(position)) {
            return position
          }
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
    
    if (editMode) {
      // In edit mode (multi-select), toggle sample selection
      if (sample) {
        setSelectedSampleIds(prev => {
          const newSet = new Set(prev)
          if (newSet.has(sample.id)) {
            newSet.delete(sample.id)
          } else {
            newSet.add(sample.id)
          }
          return newSet
        })
      }
      return
    }
    
    // Not in edit mode - allow viewing sample details or adding new samples
    if (sample) {
      // Existing sample clicked - show sidebar for viewing
      setSelectedSample(sample)
      setShowSidebar(true)
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
  
  const handleBatchArchive = async () => {
    if (selectedSampleIds.size === 0) return
    
    setBatchActionInProgress(true)
    try {
      const token = getToken()
      
      // Archive all selected samples
      for (const sampleId of selectedSampleIds) {
        await fetch(`/api/samples/${sampleId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            is_archived: true,
            archive_comment: archiveComment.trim() || undefined
          })
        })
      }
      
      // Reload and clear selection
      await loadContainer()
      setSelectedSampleIds(new Set())
      setArchiveComment('')
      setShowArchiveComment(false)
    } catch (error) {
      console.error('Batch archive error:', error)
      alert('Failed to archive some samples')
    } finally {
      setBatchActionInProgress(false)
    }
  }
  
  const handleBatchCheckout = async () => {
    if (selectedSampleIds.size === 0) return
    if (!window.confirm(`Check out ${selectedSampleIds.size} sample(s)?`)) return
    
    setBatchActionInProgress(true)
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const userInitials = user.initials || 'Unknown'
      
      // Checkout all selected samples
      for (const sampleId of selectedSampleIds) {
        const sample = data.samples.find((s: any) => s.id === sampleId)
        if (sample) {
          await supabase
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
            .eq('id', sampleId)
        }
      }
      
      // Reload and clear selection
      await loadContainer()
      setSelectedSampleIds(new Set())
    } catch (error) {
      console.error('Batch checkout error:', error)
      alert('Failed to checkout some samples')
    } finally {
      setBatchActionInProgress(false)
    }
  }
  
  const handleBatchTrainingToggle = async () => {
    if (selectedSampleIds.size === 0) return
    if (!window.confirm(`Toggle training status for ${selectedSampleIds.size} sample(s)?`)) return
    
    setBatchActionInProgress(true)
    try {
      const token = getToken()
      
      // Toggle training for all selected samples
      for (const sampleId of selectedSampleIds) {
        const sample = data.samples.find((s: any) => s.id === sampleId)
        if (sample) {
          await fetch(`/api/samples/${sampleId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ is_training: !sample.is_training })
          })
        }
      }
      
      // Reload and clear selection
      await loadContainer()
      setSelectedSampleIds(new Set())
    } catch (error) {
      console.error('Batch training toggle error:', error)
      alert('Failed to update training status for some samples')
    } finally {
      setBatchActionInProgress(false)
    }
  }
  
  const handleBatchDelete = async () => {
    if (selectedSampleIds.size === 0) return
    
    setBatchActionInProgress(true)
    try {
      const token = getToken()
      
      // Delete all selected samples
      for (const sampleId of selectedSampleIds) {
        await fetch(`/api/samples/${sampleId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            delete_comment: deleteComment.trim() || undefined
          })
        })
      }
      
      // Reload and clear selection
      await loadContainer()
      setSelectedSampleIds(new Set())
      setDeleteComment('')
      setDeleteConfirmationActive(false)
      setShowDeleteComment(false)
    } catch (error) {
      console.error('Batch delete error:', error)
      alert('Failed to delete some samples')
    } finally {
      setBatchActionInProgress(false)
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
      
      // After reload, advance to next position using the helper function
      if (updatedData) {
        // Find next position after current position using updated data
        const nextPosition = findNextEmptyPosition(currentPosition, updatedData)
        
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
  const usedCount = samples.length  // Count all samples including archived

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

  const rack = data.racks
  const coldStorage = rack?.cold_storage_units || data.cold_storage_units
  const breadcrumbItems = [
    ...(coldStorage ? [{ label: coldStorage.name, href: `#/cold-storage/${coldStorage.id}` }] : []),
    ...(rack ? [{ label: rack.name, href: `#/racks/${rack.id}` }] : []),
    { label: data.name || String(data.id) }
  ]

  return (
    <div style={{ position: 'relative' }}>
      <LocationBreadcrumb items={breadcrumbItems} />
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:20}}>
        <div>
          <h2 style={{margin:0}}>{data.name || 'Unnamed Container'}</h2>
          <div className="muted">Storage Path: {formatContainerLocation(data) || data.location || 'Not specified'}</div>
          {data.rack_position && (
            <div className="muted">Rack Position: {data.rack_position}</div>
          )}
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
            {usedCount}/{effectiveTotal} filled
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
                onClick={() => {
                  setEditMode(!editMode)
                  setSelectedSampleIds(new Set())
                  setDeleteConfirmationActive(false)
                  setShowArchiveComment(false)
                  setShowDeleteComment(false)
                  setArchiveComment('')
                  setDeleteComment('')
                }}
                style={{
                  background: editMode ? '#10b981' : '#3b82f6',
                  color: 'white'
                }}
              >
                {editMode ? '✓ Done' : '☑️ Multi-Select'}
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
          padding: '16px',
          background: '#f0f9ff',
          border: '2px solid #3b82f6',
          borderRadius: '12px',
          marginBottom: '16px'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{fontSize: 16, fontWeight: 700, color: '#1e40af', marginBottom: 8}}>
              ☑️ Multi-Select Mode ({selectedSampleIds.size} selected)
            </div>
            <div style={{fontSize: 13, color: '#6b7280'}}>
              Click samples to select/deselect them for batch operations
            </div>
          </div>
          
          {selectedSampleIds.size > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowArchiveComment(!showArchiveComment)}
                  disabled={batchActionInProgress}
                  className="btn"
                  style={{
                    background: '#fbbf24',
                    color: '#78350f',
                    padding: '8px 16px',
                    fontSize: '14px'
                  }}
                >
                  🗄️ Archive ({selectedSampleIds.size})
                </button>
                
                <button
                  onClick={handleBatchCheckout}
                  disabled={batchActionInProgress}
                  className="btn"
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    padding: '8px 16px',
                    fontSize: '14px'
                  }}
                >
                  📤 Checkout ({selectedSampleIds.size})
                </button>
                
                <button
                  onClick={handleBatchTrainingToggle}
                  disabled={batchActionInProgress}
                  className="btn"
                  style={{
                    background: '#6366f1',
                    color: 'white',
                    padding: '8px 16px',
                    fontSize: '14px'
                  }}
                >
                  🎓 Toggle Training ({selectedSampleIds.size})
                </button>
                
                <button
                  onClick={() => {
                    setDeleteConfirmationActive(true)
                    setShowDeleteComment(false)
                  }}
                  disabled={batchActionInProgress || deleteConfirmationActive}
                  className="btn"
                  style={{
                    background: '#fef2f2',
                    color: '#991b1b',
                    border: '1px solid #fecaca',
                    padding: '8px 16px',
                    fontSize: '14px'
                  }}
                >
                  🗑️ Delete ({selectedSampleIds.size})
                </button>
                
                <button
                  onClick={() => setSelectedSampleIds(new Set())}
                  disabled={batchActionInProgress}
                  className="btn ghost"
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px'
                  }}
                >
                  Clear Selection
                </button>
              </div>
              
              {showArchiveComment && (
                <div style={{
                  padding: '12px',
                  background: '#fffbeb',
                  border: '1px solid #fbbf24',
                  borderRadius: '8px'
                }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#78350f' }}>
                    Archive Comment (optional)
                  </label>
                  <textarea
                    value={archiveComment}
                    onChange={(e) => setArchiveComment(e.target.value)}
                    placeholder="Add a comment about why these samples are being archived..."
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      minHeight: '60px',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      onClick={handleBatchArchive}
                      disabled={batchActionInProgress}
                      className="btn"
                      style={{
                        background: '#fbbf24',
                        color: '#78350f',
                        padding: '6px 12px',
                        fontSize: '14px'
                      }}
                    >
                      {batchActionInProgress ? 'Archiving...' : 'Confirm Archive'}
                    </button>
                    <button
                      onClick={() => setShowArchiveComment(false)}
                      className="btn ghost"
                      style={{ padding: '6px 12px', fontSize: '14px' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {deleteConfirmationActive && (
                <div style={{
                  padding: '16px',
                  background: '#fef2f2',
                  border: '2px solid #ef4444',
                  borderRadius: '8px'
                }}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>
                      ⚠️ Confirm Deletion
                    </div>
                    <div style={{ fontSize: '14px', color: '#991b1b' }}>
                      You are about to permanently delete {selectedSampleIds.size} sample(s). This action cannot be undone.
                    </div>
                  </div>
                  
                  {!showDeleteComment ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setShowDeleteComment(true)}
                        className="btn"
                        style={{
                          background: '#ef4444',
                          color: 'white',
                          padding: '8px 16px',
                          fontSize: '14px',
                          fontWeight: 600
                        }}
                      >
                        Continue
                      </button>
                      <button
                        onClick={() => setDeleteConfirmationActive(false)}
                        className="btn ghost"
                        style={{ padding: '8px 16px', fontSize: '14px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#991b1b' }}>
                        Deletion Comment (optional)
                      </label>
                      <textarea
                        value={deleteComment}
                        onChange={(e) => setDeleteComment(e.target.value)}
                        placeholder="Add a comment about why these samples are being deleted..."
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          fontSize: '14px',
                          minHeight: '60px',
                          resize: 'vertical',
                          marginBottom: '8px'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={handleBatchDelete}
                          disabled={batchActionInProgress}
                          className="btn"
                          style={{
                            background: '#991b1b',
                            color: 'white',
                            padding: '8px 16px',
                            fontSize: '14px',
                            fontWeight: 600
                          }}
                        >
                          {batchActionInProgress ? 'Deleting...' : 'Delete Forever'}
                        </button>
                        <button
                          onClick={() => {
                            setDeleteConfirmationActive(false)
                            setShowDeleteComment(false)
                            setDeleteComment('')
                          }}
                          className="btn ghost"
                          style={{ padding: '8px 16px', fontSize: '14px' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
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
          selectedSampleIds={editMode ? selectedSampleIds : undefined}
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
