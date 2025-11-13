import React, { useState, useRef } from 'react'
import { supabase } from '../lib/api'
import { getToken, getUser } from '../lib/auth'
import { formatDateTime } from '../lib/dateUtils'

interface WorklistSample {
  sample_id: string
  container_id?: string
  container_name?: string
  container_location?: string
  position?: string
  is_checked_out?: boolean
  checked_out_at?: string
  previous_container_id?: string
  previous_position?: string
}

export default function WorklistManager() {
  const [worklist, setWorklist] = useState<WorklistSample[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSamples, setSelectedSamples] = useState<Set<string>>(new Set())
  const [viewingContainer, setViewingContainer] = useState<{id: string, highlightPositions: string[]} | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseCSV = (text: string): string[] => {
    const lines = text.trim().split('\n')
    if (lines.length === 0) return []
    
    // Parse header to find SampleID column index
    const headerLine = lines[0]
    const headers = headerLine.split(/[,\t]/).map(h => h.trim())
    
    // Find sample ID column - try various common names
    const sampleIdIndex = headers.findIndex(h => 
      /^sample.*id$/i.test(h) || 
      h.toLowerCase() === 'sampleid' ||
      h.toLowerCase() === 'barcode' ||
      h.toLowerCase() === 'specimen'
    )
    
    if (sampleIdIndex === -1) {
      console.warn('Could not find SampleID column, using first column')
    }
    
    const columnIndex = sampleIdIndex !== -1 ? sampleIdIndex : 0
    const sampleIds: string[] = []
    const seen = new Set<string>()
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const parts = line.split(/[,\t]/).map(p => p.trim())
      const sampleId = parts[columnIndex]
      
      // Add unique sample IDs only
      if (sampleId && !seen.has(sampleId)) {
        sampleIds.push(sampleId)
        seen.add(sampleId)
      }
    }
    
    return sampleIds
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const text = await file.text()
      const sampleIds = parseCSV(text)
      
      if (sampleIds.length === 0) {
        alert('No sample IDs found in file')
        return
      }

      // Fetch sample data from database
      const { data, error } = await supabase
        .from('samples')
        .select('*, containers!samples_container_id_fkey(id, name, location)')
        .in('sample_id', sampleIds)
      
      if (error) {
        console.error('Database error:', error)
        alert(`Database error: ${error.message}\n\nPlease make sure the database migration has been run. See db/migrations/2025-11-13-add-checkout-fields.sql`)
        return
      }

      // Build worklist with container info
      const worklistData: WorklistSample[] = sampleIds.map(id => {
        const sample = data?.find(s => s.sample_id === id)
        return {
          sample_id: id,
          container_id: sample?.container_id,
          container_name: sample?.containers?.name,
          container_location: sample?.containers?.location,
          position: sample?.position,
          is_checked_out: sample?.is_checked_out || false,
          checked_out_at: sample?.checked_out_at,
          previous_container_id: sample?.previous_container_id,
          previous_position: sample?.previous_position
        }
      })

      setWorklist(worklistData)
      setSelectedSamples(new Set())
    } catch (err: any) {
      console.error('Error processing worklist:', err)
      alert(`Failed to process worklist file: ${err?.message || 'Unknown error'}\n\nCheck console for details.`)
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const toggleSample = (sampleId: string) => {
    const newSelected = new Set(selectedSamples)
    if (newSelected.has(sampleId)) {
      newSelected.delete(sampleId)
    } else {
      newSelected.add(sampleId)
    }
    setSelectedSamples(newSelected)
  }

  const selectAll = () => {
    setSelectedSamples(new Set(worklist.map(s => s.sample_id)))
  }

  const deselectAll = () => {
    setSelectedSamples(new Set())
  }

  const checkoutSamples = async (sampleIds: string[]) => {
    if (sampleIds.length === 0) return

    const user = getUser()
    const token = getToken()
    
    if (!user || !token) {
      alert('You must be signed in to checkout samples')
      return
    }

    setLoading(true)
    try {
      // Get current sample data to save previous positions
      const { data: currentSamples, error: fetchError } = await supabase
        .from('samples')
        .select('id, sample_id, container_id, position, is_checked_out')
        .in('sample_id', sampleIds)
      
      if (fetchError) {
        console.error('Error fetching samples:', fetchError)
        alert(`Error: ${fetchError.message}\n\nMake sure the database migration has been run.`)
        return
      }
      
      // Filter to only non-checked-out samples (do it client-side for compatibility)
      const availableSamples = currentSamples?.filter((s: any) => !s.is_checked_out) || []
      
      if (!availableSamples || availableSamples.length === 0) {
        alert('No samples available to checkout (they may already be checked out)')
        return
      }

      // Update samples to checked out status
      const updates = availableSamples.map((s: any) => ({
        id: s.id,
        is_checked_out: true,
        checked_out_at: new Date().toISOString(),
        checked_out_by: user.initials,
        previous_container_id: s.container_id,
        previous_position: s.position,
        container_id: null,
        position: null
      }))

      const { error: updateError } = await supabase
        .from('samples')
        .upsert(updates)

      if (updateError) {
        console.error('Error updating samples:', updateError)
        alert(`Failed to checkout: ${updateError.message}\n\nMake sure the database migration has been run.`)
        return
      }

      // Refresh worklist
      const { data: refreshed } = await supabase
        .from('samples')
        .select('*, containers!samples_container_id_fkey(id, name, location)')
        .in('sample_id', sampleIds)
      
      // Update worklist state
      setWorklist(prev => prev.map(item => {
        const updated = refreshed?.find(s => s.sample_id === item.sample_id)
        if (updated) {
          return {
            ...item,
            container_id: updated.container_id,
            container_name: updated.containers?.name,
            container_location: updated.containers?.location,
            position: updated.position,
            is_checked_out: updated.is_checked_out,
            checked_out_at: updated.checked_out_at,
            previous_container_id: updated.previous_container_id,
            previous_position: updated.previous_position
          }
        }
        return item
      }))

      alert(`Checked out ${availableSamples.length} sample(s)`)
      setSelectedSamples(new Set())
    } catch (err: any) {
      console.error('Error checking out samples:', err)
      alert(`Failed to checkout samples: ${err?.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const undoCheckout = async (sampleIds: string[]) => {
    if (sampleIds.length === 0) return

    setLoading(true)
    try {
      // Get samples with previous position data
      const { data: samples, error: fetchError } = await supabase
        .from('samples')
        .select('id, sample_id, previous_container_id, previous_position, is_checked_out')
        .in('sample_id', sampleIds)
      
      if (fetchError) {
        console.error('Error fetching samples:', fetchError)
        alert(`Error: ${fetchError.message}\n\nMake sure the database migration has been run.`)
        return
      }
      
      const checkedOutSamples = samples?.filter((s: any) => s.is_checked_out) || []
      
      if (!checkedOutSamples || checkedOutSamples.length === 0) {
        alert('No checked out samples to undo')
        return
      }

      // Restore samples to previous positions
      const updates = checkedOutSamples
        .filter((s: any) => s.previous_container_id && s.previous_position)
        .map((s: any) => ({
          id: s.id,
          container_id: s.previous_container_id,
          position: s.previous_position,
          is_checked_out: false,
          checked_out_at: null,
          checked_out_by: null,
          previous_container_id: null,
          previous_position: null
        }))

      if (updates.length === 0) {
        alert('No samples have previous position data to restore')
        return
      }

      const { error: updateError } = await supabase
        .from('samples')
        .upsert(updates)

      if (updateError) {
        console.error('Error restoring samples:', updateError)
        alert(`Failed to undo checkout: ${updateError.message}`)
        return
      }

      // Refresh worklist
      const { data: refreshed } = await supabase
        .from('samples')
        .select('*, containers!samples_container_id_fkey(id, name, location)')
        .in('sample_id', sampleIds)
      
      setWorklist(prev => prev.map(item => {
        const updated = refreshed?.find(s => s.sample_id === item.sample_id)
        if (updated) {
          return {
            ...item,
            container_id: updated.container_id,
            container_name: updated.containers?.name,
            container_location: updated.containers?.location,
            position: updated.position,
            is_checked_out: updated.is_checked_out,
            checked_out_at: updated.checked_out_at,
            previous_container_id: updated.previous_container_id,
            previous_position: updated.previous_position
          }
        }
        return item
      }))

      alert(`Restored ${updates.length} sample(s) to original positions`)
      setSelectedSamples(new Set())
    } catch (err: any) {
      console.error('Error undoing checkout:', err)
      alert(`Failed to undo checkout: ${err?.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const viewSampleContainer = async (sample: WorklistSample) => {
    if (!sample.container_id) {
      alert('Sample is not currently in a container')
      return
    }

    // Find all samples from worklist that are in the same container
    const samplesInContainer = worklist
      .filter(s => s.container_id === sample.container_id && s.position)
      .map(s => s.position!)

    // Navigate to container with highlighted positions
    window.location.hash = `#/worklist/container/${sample.container_id}?positions=${encodeURIComponent(samplesInContainer.join(','))}`
  }

  if (viewingContainer) {
    // This will be handled by App.tsx routing
    return null
  }

  return (
    <div className="worklist-manager" style={{maxWidth: 1200, margin: '0 auto'}}>
      <div style={{marginBottom: 24}}>
        <h2 style={{fontSize: 24, fontWeight: 600, marginBottom: 8}}>Worklist Manager</h2>
        <p className="muted">Upload a CSV file with sample IDs to view and manage sample checkout</p>
      </div>

      <div style={{marginBottom: 24, padding: 16, background: '#f9fafb', borderRadius: 8, border: '2px dashed #d1d5db'}}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileUpload}
          style={{display: 'none'}}
          id="worklist-upload"
        />
        <label htmlFor="worklist-upload" style={{cursor: 'pointer', display: 'block', textAlign: 'center'}}>
          <div style={{fontSize: 48, marginBottom: 8}}>📄</div>
          <div style={{fontSize: 16, fontWeight: 500, marginBottom: 4}}>Click to upload CSV worklist</div>
          <div className="muted" style={{fontSize: 14}}>Accepted formats: .csv, .txt</div>
        </label>
      </div>

      {loading && <div className="muted">Loading...</div>}

      {worklist.length > 0 && (
        <>
          <div style={{marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap'}}>
            <button className="btn" onClick={selectAll} disabled={loading}>
              Select All ({worklist.length})
            </button>
            <button className="btn ghost" onClick={deselectAll} disabled={loading || selectedSamples.size === 0}>
              Deselect All
            </button>
            <div style={{flex: 1}} />
            <button 
              className="btn" 
              onClick={() => checkoutSamples(Array.from(selectedSamples))}
              disabled={loading || selectedSamples.size === 0}
              style={{background: '#10b981', color: 'white'}}
            >
              Checkout Selected ({selectedSamples.size})
            </button>
            <button 
              className="btn" 
              onClick={() => checkoutSamples(worklist.map(s => s.sample_id))}
              disabled={loading}
              style={{background: '#10b981', color: 'white'}}
            >
              Checkout All
            </button>
            <button 
              className="btn" 
              onClick={() => undoCheckout(Array.from(selectedSamples))}
              disabled={loading || selectedSamples.size === 0}
              style={{background: '#f59e0b', color: 'white'}}
            >
              Undo Checkout
            </button>
          </div>

          <div style={{marginBottom: 16}}>
            <div className="muted">
              Showing {worklist.length} samples • 
              {' '}{worklist.filter(s => s.is_checked_out).length} checked out • 
              {' '}{worklist.filter(s => s.container_id).length} in containers • 
              {' '}{worklist.filter(s => !s.container_id && !s.is_checked_out).length} not found
            </div>
          </div>

          <div style={{border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden'}}>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead style={{background: '#f3f4f6'}}>
                <tr>
                  <th style={{padding: 12, textAlign: 'left', width: 40}}>
                    <input
                      type="checkbox"
                      checked={selectedSamples.size === worklist.length}
                      onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                    />
                  </th>
                  <th style={{padding: 12, textAlign: 'left'}}>Sample ID</th>
                  <th style={{padding: 12, textAlign: 'left'}}>Container</th>
                  <th style={{padding: 12, textAlign: 'left'}}>Location</th>
                  <th style={{padding: 12, textAlign: 'left'}}>Position</th>
                  <th style={{padding: 12, textAlign: 'left'}}>Status</th>
                  <th style={{padding: 12, textAlign: 'left'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {worklist.map((sample, index) => (
                  <tr 
                    key={sample.sample_id}
                    style={{
                      borderTop: index > 0 ? '1px solid #e5e7eb' : 'none',
                      background: selectedSamples.has(sample.sample_id) ? '#eff6ff' : 'white'
                    }}
                  >
                    <td style={{padding: 12}}>
                      <input
                        type="checkbox"
                        checked={selectedSamples.has(sample.sample_id)}
                        onChange={() => toggleSample(sample.sample_id)}
                      />
                    </td>
                    <td style={{padding: 12, fontWeight: 600}}>{sample.sample_id}</td>
                    <td style={{padding: 12}}>
                      {sample.container_name || <span className="muted">—</span>}
                    </td>
                    <td style={{padding: 12}}>
                      {sample.container_location || <span className="muted">—</span>}
                    </td>
                    <td style={{padding: 12}}>
                      {sample.position || <span className="muted">—</span>}
                    </td>
                    <td style={{padding: 12}}>
                      {sample.is_checked_out ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          background: '#fef3c7',
                          color: '#92400e',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500
                        }}>
                          Checked Out {sample.checked_out_at && `• ${formatDateTime(sample.checked_out_at)}`}
                        </span>
                      ) : sample.container_id ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          background: '#d1fae5',
                          color: '#065f46',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500
                        }}>
                          In Container
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          background: '#fee2e2',
                          color: '#991b1b',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500
                        }}>
                          Not Found
                        </span>
                      )}
                    </td>
                    <td style={{padding: 12}}>
                      {sample.container_id && (
                        <button
                          className="btn ghost"
                          onClick={() => viewSampleContainer(sample)}
                          style={{fontSize: 12, padding: '4px 8px'}}
                        >
                          View Container
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
