import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/api'
import { CONTAINER_LOCATION_SELECT, formatContainerLocation } from '../lib/locationUtils'
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
  sample_type?: string
  shelf_id?: string
  shelf_name?: string
  cold_storage_id?: string
  cold_storage_name?: string
  shelf_item_type?: string
}

// Helper function to detect sample type from container name or sample ID
const detectSampleType = (sampleId: string, containerName?: string): string => {
  // First try to detect from container name (more reliable)
  if (containerName) {
    const name = containerName.toUpperCase()
    if (name.includes('CFDNA') || name.includes('CF DNA')) return 'cfDNA'
    if (name.includes('DTC')) return 'DTC'
    if (name.includes('PA POOL') || name.includes('PAPOOL') || name.includes('PAP_POOL_RACK') || name.includes('PAP_POOL_BOX') || name.includes('PAP RACK') || name.includes('PAP BOX') || name.includes('PAP_RACK') || name.includes('PAP_BOX')) return 'PA Pools'
    if (name.includes('DP POOL') || name.includes('DPPOOL') || name.includes('DP TUBE')) return 'DP Pools'
    if (name.includes('MNC')) return 'MNC'
    if (name.includes('IDT')) return 'IDT'
    if (name.includes('BC TUBE') || name.includes('BCTUBE')) return 'BC Tubes'
    if (name.includes('PLASMA')) return 'Plasma'
  }
  
  // Fallback to sample ID pattern matching
  const id = sampleId.toUpperCase()
  if (/CD\d+$/i.test(id)) return 'cfDNA'
  if (/TC\d+$/i.test(id)) return 'DTC'
  if (/PAP\d+$/i.test(id)) return 'PA Pools'
  if (/DPP\d+[A-D]$/i.test(id)) return 'DP Pools'
  if (/NC\d+$/i.test(id)) return 'MNC'
  if (/PP\d+$/i.test(id)) return 'IDT'
  if (/BC\d+$/i.test(id)) return 'BC Tubes'
  if (/PL\d+$/i.test(id)) return 'Plasma'
  
  return 'Unknown'
}

export default function WorklistManager() {
  const [worklist, setWorklist] = useState<WorklistSample[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSamples, setSelectedSamples] = useState<Set<string>>(new Set())
  const [viewingContainer, setViewingContainer] = useState<{id: string, highlightPositions: string[]} | null>(null)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [sortState, setSortState] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
    if (chunkSize <= 0) return [items]
    const chunks: T[][] = []
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize))
    }
    return chunks
  }

  const splitDelimitedLine = (line: string, delimiter: string): string[] => {
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const next = line[i + 1]

      if (char === '"') {
        // Handle escaped double quote: ""
        if (inQuotes && next === '"') {
          current += '"'
          i++
          continue
        }
        inQuotes = !inQuotes
        continue
      }

      if (!inQuotes && char === delimiter) {
        values.push(current.trim())
        current = ''
        continue
      }

      current += char
    }

    values.push(current.trim())
    return values
  }

  const pickDelimiter = (headerLine: string): string => {
    const delimiters = [',', ';', '\t']
    let best = ','
    let bestCount = -1

    for (const delimiter of delimiters) {
      const count = splitDelimitedLine(headerLine, delimiter).length
      if (count > bestCount) {
        bestCount = count
        best = delimiter
      }
    }

    return best
  }

  const normalizeHeader = (header: string): string =>
    header.toLowerCase().replace(/[^a-z0-9]/g, '')

  const fetchSamplesByIds = async (sampleIds: string[]) => {
    const uniqueIds = Array.from(new Set(sampleIds.map(id => id.trim()).filter(Boolean)))
    if (uniqueIds.length === 0) return []

    const idChunks = chunkArray(uniqueIds, 250)
    const merged: any[] = []

    for (const chunk of idChunks) {
      const { data, error } = await supabase
        .from('samples')
        .select(`*, containers:containers!samples_container_id_fkey(${CONTAINER_LOCATION_SELECT})`)
        .in('sample_id', chunk)

      if (error) throw error
      if (data?.length) merged.push(...data)
    }

    return merged
  }

  const fetchShelfItemsByIds = async (sampleIds: string[]) => {
    const uniqueIds = Array.from(new Set(sampleIds.map(id => id.trim()).filter(Boolean)))
    if (uniqueIds.length === 0) return []

    const idChunks = chunkArray(uniqueIds, 250)
    const merged: any[] = []

    for (const chunk of idChunks) {
      const { data, error } = await supabase
        .from('cold_storage_items')
        .select(
          `id,
          item_id,
          item_type,
          shelf_id,
          cold_storage_id,
          cold_storage_shelves: cold_storage_shelves!cold_storage_items_shelf_id_fkey(
            id,
            name,
            cold_storage_id,
            cold_storage_units: cold_storage_units!cold_storage_shelves_cold_storage_id_fkey(id, name)
          )`
        )
        .in('item_id', chunk)

      if (error) throw error
      if (data?.length) merged.push(...data)
    }

    return merged
  }

  // Load worklist from sessionStorage on mount (persists during navigation)
  useEffect(() => {
    const savedWorklist = sessionStorage.getItem('saga_worklist')
    if (savedWorklist) {
      try {
        const parsed = JSON.parse(savedWorklist)
        setWorklist(parsed)
      } catch (e) {
        console.warn('Failed to parse saved worklist:', e)
        sessionStorage.removeItem('saga_worklist')
      }
    }
  }, [])

  // Save worklist to sessionStorage whenever it changes
  useEffect(() => {
    if (worklist.length > 0) {
      sessionStorage.setItem('saga_worklist', JSON.stringify(worklist))
    } else {
      sessionStorage.removeItem('saga_worklist')
    }
  }, [worklist])

  const parseCSV = (text: string): string[] => {
    const lines = text.trim().split('\n')
    if (lines.length === 0) return []
    
    // Parse header to find SampleID, Source_TubeID, and Source_PlateID columns
    const headerLine = lines[0]
    const delimiter = pickDelimiter(headerLine)
    const headers = splitDelimitedLine(headerLine, delimiter)
    const normalizedHeaders = headers.map(normalizeHeader)
    
    // Find sample ID column - try various common names
    const sampleIdIndex = normalizedHeaders.findIndex(h => 
      /^sample.*id$/i.test(h) ||
      h === 'sampleid' ||
      h === 'internalid' ||
      h === 'internalno' ||
      h === 'barcode' ||
      h === 'specimen'
    )
    
    // Find Source_TubeID column - try various common names
    const sourceTubeIndex = normalizedHeaders.findIndex(h => 
      /^source.*tube.*id$/i.test(h) ||
      h === 'sourcetubeid'
    )

    // Find Source_PlateID column - try various common names
    const sourcePlateIndex = normalizedHeaders.findIndex(h =>
      /^source.*plate.*id$/i.test(h) ||
      h === 'sourceplateid'
    )
    
    if (sampleIdIndex === -1 && sourceTubeIndex === -1 && sourcePlateIndex === -1) {
      console.warn('Could not find SampleID, Source_TubeID, or Source_PlateID column, using first column')
    }
    
    const sampleIds: string[] = []
    const seen = new Set<string>()
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const parts = splitDelimitedLine(line, delimiter)
      
      // Try to get value from SampleID column first, then Source_TubeID, then Source_PlateID, then first column
      let sampleId = ''
      if (sampleIdIndex !== -1) {
        sampleId = parts[sampleIdIndex]
      } else if (sourceTubeIndex !== -1) {
        sampleId = parts[sourceTubeIndex]
      } else if (sourcePlateIndex !== -1) {
        sampleId = parts[sourcePlateIndex]
      } else if (parts.length > 0) {
        sampleId = parts[0]
      }
      
      // Also include Source_TubeID if it exists and is different from SampleID
      if (sourceTubeIndex !== -1 && parts[sourceTubeIndex] && parts[sourceTubeIndex] !== sampleId) {
        const tubeSampleId = parts[sourceTubeIndex]
        if (tubeSampleId && !seen.has(tubeSampleId)) {
          sampleIds.push(tubeSampleId)
          seen.add(tubeSampleId)
        }
      }

      // Also include Source_PlateID if it exists and is different from SampleID
      if (sourcePlateIndex !== -1 && parts[sourcePlateIndex] && parts[sourcePlateIndex] !== sampleId) {
        const plateSampleId = parts[sourcePlateIndex]
        if (plateSampleId && !seen.has(plateSampleId)) {
          sampleIds.push(plateSampleId)
          seen.add(plateSampleId)
        }
      }
      
      // Add unique sample IDs only, exclude "See Form" entries
      if (sampleId && !seen.has(sampleId) && !/see\s*form/i.test(sampleId)) {
        sampleIds.push(sampleId)
        seen.add(sampleId)
      }
    }
    
    return sampleIds
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Clear existing worklist before uploading new file
    setWorklist([])
    setSelectedSamples(new Set())

    setLoading(true)
    try {
      const text = await file.text()
      const sampleIds = parseCSV(text)
      
      if (sampleIds.length === 0) {
        alert('No sample IDs found in file')
        return
      }

      // Fetch sample data from database
      // Note: We need to fetch ALL samples (including archived) because archived samples
      // still exist and may be in the worklist. We'll query for each sample ID individually
      // or use a case-insensitive approach.
      
      // First, try to fetch all samples that match (case-insensitive, including archived)
      const data = await fetchSamplesByIds(sampleIds)
      
      if (!data) {
        alert('Database error: failed to load samples')
        return
      }

      let shelfItemsData: any[] = []
      try {
        shelfItemsData = await fetchShelfItemsByIds(sampleIds)
      } catch (shelfItemsError) {
        console.warn('Shelf item lookup error:', shelfItemsError)
      }

      const shelfItemsById = new Map(
        (shelfItemsData || []).map((item: any) => [String(item.item_id || '').toUpperCase(), item])
      )

      // Build worklist with container info and sample type
      // Match samples case-insensitively since database query was case-insensitive
      const worklistData: WorklistSample[] = sampleIds.map(id => {
        const sample = data?.find(s => 
          s.sample_id.trim().toUpperCase() === id.trim().toUpperCase()
        )
        const shelfItem = shelfItemsById.get(id.trim().toUpperCase())
        
        // Fix inconsistent state: if sample has container_id, it shouldn't be checked out
        // This handles cases where samples were put back in containers without using "Undo Checkout"
        const hasContainer = sample?.container_id != null
        const isActuallyCheckedOut = sample?.is_checked_out && !hasContainer
        
        const shelfDetails = shelfItem?.cold_storage_shelves
        const shelfUnit = shelfDetails?.cold_storage_units
        const shelfLocation = shelfUnit?.name && shelfDetails?.name
          ? `${shelfUnit.name} / ${shelfDetails.name}`
          : shelfUnit?.name || shelfDetails?.name || null

        return {
          id: sample?.id,
          sample_id: id,
          container_id: sample?.container_id,
          container_name: sample?.containers?.name,
          container_location: formatContainerLocation(sample?.containers) || shelfLocation,
          position: sample?.position,
          is_checked_out: isActuallyCheckedOut,
          checked_out_at: isActuallyCheckedOut ? sample?.checked_out_at : null,
          previous_container_id: sample?.previous_container_id,
          previous_position: sample?.previous_position,
          sample_type: sample?.containers?.name
            ? detectSampleType(id, sample?.containers?.name)
            : shelfItem?.item_type === 'plate'
              ? 'Plate'
              : shelfItem?.item_type === 'tube'
                ? 'Tube'
                : detectSampleType(id, undefined),
          shelf_id: shelfDetails?.id || shelfItem?.shelf_id,
          shelf_name: shelfDetails?.name,
          cold_storage_id: shelfItem?.cold_storage_id || shelfDetails?.cold_storage_id,
          cold_storage_name: shelfUnit?.name,
          shelf_item_type: shelfItem?.item_type
        }
      })

      // Sort by sample type, maintaining order within each type
      const typeOrder = ['cfDNA', 'DTC', 'PA Pools', 'DP Pools', 'MNC', 'IDT', 'BC Tubes', 'Plasma', 'Unknown']
      const sortedWorklist = worklistData.sort((a, b) => {
        const typeA = typeOrder.indexOf(a.sample_type || 'Unknown')
        const typeB = typeOrder.indexOf(b.sample_type || 'Unknown')
        if (typeA !== typeB) return typeA - typeB
        // Maintain original order within same type
        return sampleIds.indexOf(a.sample_id) - sampleIds.indexOf(b.sample_id)
      })

      setWorklist(sortedWorklist)
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
      // Get current sample data to save previous positions (case-insensitive)
      const currentSamples = await (async () => {
        const uniqueIds = Array.from(new Set(sampleIds.map(id => id.trim()).filter(Boolean)))
        const chunks = chunkArray(uniqueIds, 250)
        const merged: any[] = []
        for (const chunk of chunks) {
          const { data, error } = await supabase
            .from('samples')
            .select('id, sample_id, container_id, position, is_checked_out')
            .in('sample_id', chunk)
          if (error) throw error
          if (data?.length) merged.push(...data)
        }
        return merged
      })()
      
      // Filter to samples that can be checked out:
      // - Must not already be checked out, OR
      // - If marked as checked out but has a container_id, treat as available (inconsistent state)
      const availableSamples = currentSamples?.filter((s: any) => 
        !s.is_checked_out || (s.is_checked_out && s.container_id != null)
      ) || []
      
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

      // Update each sample individually to avoid upsert issues
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('samples')
          .update({
            is_checked_out: update.is_checked_out,
            checked_out_at: update.checked_out_at,
            checked_out_by: update.checked_out_by,
            previous_container_id: update.previous_container_id,
            previous_position: update.previous_position,
            container_id: update.container_id,
            position: update.position
          })
          .eq('id', update.id)
        
        if (updateError) {
          console.error('Error updating sample:', updateError)
          alert(`Failed to checkout: ${updateError.message}\n\nMake sure the database migration has been run.`)
          return
        }
      }

      // Refresh worklist with case-insensitive query
      const refreshed = await fetchSamplesByIds(sampleIds)
      
      // Update worklist state with case-insensitive matching
      setWorklist(prev => prev.map(item => {
        const updated = refreshed?.find(s => 
          s.sample_id.trim().toUpperCase() === item.sample_id.trim().toUpperCase()
        )
        if (updated) {
          return {
            ...item,
            container_id: updated.container_id,
            container_name: updated.containers?.name,
            container_location: formatContainerLocation(updated.containers),
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
      // Get samples with previous position data (case-insensitive)
      const samples = await (async () => {
        const uniqueIds = Array.from(new Set(sampleIds.map(id => id.trim()).filter(Boolean)))
        const chunks = chunkArray(uniqueIds, 250)
        const merged: any[] = []
        for (const chunk of chunks) {
          const { data, error } = await supabase
            .from('samples')
            .select('id, sample_id, previous_container_id, previous_position, is_checked_out')
            .in('sample_id', chunk)
          if (error) throw error
          if (data?.length) merged.push(...data)
        }
        return merged
      })()
      
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

      // Update each sample individually to avoid upsert issues
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('samples')
          .update({
            container_id: update.container_id,
            position: update.position,
            is_checked_out: update.is_checked_out,
            checked_out_at: update.checked_out_at,
            checked_out_by: update.checked_out_by,
            previous_container_id: update.previous_container_id,
            previous_position: update.previous_position
          })
          .eq('id', update.id)
        
        if (updateError) {
          console.error('Error restoring sample:', updateError)
          alert(`Failed to undo checkout: ${updateError.message}\n\nMake sure the database migration has been run.`)
          return
        }
      }

      // Refresh worklist with case-insensitive query
      const refreshed = await fetchSamplesByIds(sampleIds)
      
      setWorklist(prev => prev.map(item => {
        const updated = refreshed?.find(s => 
          s.sample_id.trim().toUpperCase() === item.sample_id.trim().toUpperCase()
        )
        if (updated) {
          return {
            ...item,
            container_id: updated.container_id,
            container_name: updated.containers?.name,
            container_location: formatContainerLocation(updated.containers),
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

      {worklist.length > 0 && (() => {
        // Get unique sample types for filter
        const availableTypes = Array.from(new Set(worklist.map(s => s.sample_type).filter((t): t is string => t !== 'Unknown' && t !== undefined)))
        
        // Apply type filter
        let filteredWorklist = selectedTypes.length > 0 
          ? worklist.filter(s => s.sample_type && selectedTypes.includes(s.sample_type))
          : worklist
        
        if (sortState) {
          const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
          const direction = sortState.direction === 'asc' ? 1 : -1
          const baseOrder = new Map(worklist.map((s, index) => [s.sample_id, index]))
          const statusLabel = (s: WorklistSample) => {
            if (s.is_checked_out) return 'Checked Out'
            if (s.container_id) return 'In Container'
            if (s.shelf_id || s.cold_storage_id) return 'On Shelf'
            return 'Not Found'
          }

          filteredWorklist = [...filteredWorklist].sort((a, b) => {
            const aIndex = baseOrder.get(a.sample_id) ?? 0
            const bIndex = baseOrder.get(b.sample_id) ?? 0
            const tieBreak = () => aIndex - bIndex

            if (sortState.key === 'sample_id') {
              const compare = collator.compare(a.sample_id || '', b.sample_id || '') * direction
              return compare || tieBreak()
            }

            if (sortState.key === 'type') {
              const compare = collator.compare(a.sample_type || '', b.sample_type || '') * direction
              return compare || tieBreak()
            }

            if (sortState.key === 'storage_path') {
              const compare = collator.compare(a.container_location || '', b.container_location || '') * direction
              return compare || tieBreak()
            }

            if (sortState.key === 'container') {
              const compare = collator.compare(a.container_name || a.shelf_item_type || '', b.container_name || b.shelf_item_type || '') * direction
              return compare || tieBreak()
            }

            if (sortState.key === 'position') {
              const compare = collator.compare(a.position || '', b.position || '') * direction
              return compare || tieBreak()
            }

            if (sortState.key === 'status') {
              const compare = collator.compare(statusLabel(a), statusLabel(b)) * direction
              return compare || tieBreak()
            }

            return tieBreak()
          })
        }
        
        // Get unique containers needed from filtered list
        const containersNeeded = Array.from(
          new Map(
            filteredWorklist
              .filter(s => s.container_id && s.container_name)
              .map(s => [s.container_id, { name: s.container_name!, location: s.container_location || 'Unknown' }])
          ).values()
        )
        
        return (
        <>
          {availableTypes.length > 0 && (
            <div style={{marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb'}}>
              <div style={{fontSize: 14, fontWeight: 600, marginBottom: 8}}>Filter by Sample Type:</div>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
                {availableTypes.map(type => (
                  <label key={type} style={{display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'}}>
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTypes([...selectedTypes, type])
                        } else {
                          setSelectedTypes(selectedTypes.filter(t => t !== type))
                        }
                      }}
                    />
                    <span style={{fontSize: 13}}>{type}</span>
                  </label>
                ))}
                {selectedTypes.length > 0 && (
                  <button 
                    className="btn ghost" 
                    onClick={() => setSelectedTypes([])}
                    style={{fontSize: 12, padding: '2px 8px', marginLeft: 8}}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          )}
          
          {containersNeeded.length > 0 && (
            <div style={{marginBottom: 16, padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bfdbfe'}}>
              <h3 style={{fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#1e40af'}}>Containers Needed ({containersNeeded.length})</h3>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
                {containersNeeded.map((container, i) => (
                  <div key={i} style={{padding: '6px 12px', background: 'white', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 14}}>
                    <strong>{container.name}</strong>
                    <span className="muted" style={{marginLeft: 8}}>{container.location}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div style={{marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap'}}>
            <button className="btn" onClick={selectAll} disabled={loading}>
              Select All ({worklist.length})
            </button>
            <button className="btn ghost" onClick={deselectAll} disabled={loading || selectedSamples.size === 0}>
              Deselect All
            </button>
            <button 
              className="btn ghost" 
              onClick={() => {
                if (confirm('Clear worklist? This will remove all loaded samples.')) {
                  setWorklist([])
                  setSelectedSamples(new Set())
                }
              }}
              disabled={loading}
              style={{color: '#ef4444'}}
            >
              Clear Worklist
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

          <div style={{marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
            <div className="muted">
              Showing {filteredWorklist.length} of {worklist.length} samples • 
              {' '}{filteredWorklist.filter(s => s.is_checked_out).length} checked out • 
              {' '}{filteredWorklist.filter(s => s.container_id).length} in containers • 
              {' '}{filteredWorklist.filter(s => s.shelf_id || s.cold_storage_id).length} on shelves •
              {' '}{filteredWorklist.filter(s => !s.container_id && !s.is_checked_out && !s.shelf_id && !s.cold_storage_id).length} not found
            </div>
            {sortState && (
              <button
                className="btn ghost"
                onClick={() => setSortState(null)}
                style={{fontSize: 12, padding: '2px 8px'}}
              >
                Clear Sort
              </button>
            )}
          </div>

          <div style={{border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden'}}>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead style={{background: '#f3f4f6'}}>
                <tr>
                  <th style={{padding: 12, textAlign: 'left', width: 40}}>
                    <input
                      type="checkbox"
                      checked={selectedSamples.size === filteredWorklist.length && filteredWorklist.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSamples(new Set(filteredWorklist.map(s => s.sample_id)))
                        } else {
                          deselectAll()
                        }
                      }}
                    />
                  </th>
                  {([
                    { label: 'Sample ID', key: 'sample_id' },
                    { label: 'Type', key: 'type' },
                    { label: 'Storage Path', key: 'storage_path' },
                    { label: 'Container', key: 'container' },
                    { label: 'Position', key: 'position' },
                    { label: 'Status', key: 'status' }
                  ] as Array<{ label: string; key: string }>).map((col) => {
                    const isActive = sortState?.key === col.key
                    const direction = isActive ? sortState?.direction : 'asc'
                    return (
                      <th key={col.key} style={{padding: 12, textAlign: 'left'}}>
                        <button
                          onClick={() => {
                            setSortState((prev) => {
                              if (prev?.key === col.key) {
                                return { key: col.key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                              }
                              return { key: col.key, direction: 'asc' }
                            })
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            fontWeight: 600,
                            cursor: 'pointer',
                            color: isActive ? '#111827' : '#1f2937'
                          }}
                          aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          {col.label}
                          <span style={{ fontSize: 12, opacity: isActive ? 1 : 0.35 }}>
                            {direction === 'asc' ? '▲' : '▼'}
                          </span>
                        </button>
                      </th>
                    )
                  })}
                  <th style={{padding: 12, textAlign: 'left'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorklist.map((sample, index) => (
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
                      <span style={{
                        padding: '2px 8px',
                        background: sample.sample_type === 'Unknown' ? '#f3f4f6' : '#dbeafe',
                        color: sample.sample_type === 'Unknown' ? '#6b7280' : '#1e40af',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 500
                      }}>
                        {sample.sample_type}
                      </span>
                    </td>
                    <td style={{padding: 12}}>
                      {sample.container_location || <span className="muted">—</span>}
                    </td>
                    <td style={{padding: 12}}>
                      {sample.container_name || (sample.shelf_item_type ? `Shelf ${sample.shelf_item_type}` : <span className="muted">—</span>)}
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
                      ) : sample.shelf_id || sample.cold_storage_id ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          background: '#e0f2fe',
                          color: '#075985',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500
                        }}>
                          On Shelf
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
                      {!sample.container_id && sample.cold_storage_id && (
                        <button
                          className="btn ghost"
                          onClick={() => {
                            const targetId = sample.cold_storage_id
                            if (targetId) window.location.hash = `#/cold-storage/${targetId}`
                          }}
                          style={{fontSize: 12, padding: '4px 8px'}}
                        >
                          View Shelf
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
        )
      })()}
    </div>
  )
}
