import React, {useEffect, useState} from 'react'
import ContainerGridView from './ContainerGridView'
import { supabase } from '../lib/api'
import { getToken, getUser } from '../lib/auth'

interface Props {
  containerId: string
  highlightPositions: string[]
  onBack: () => void
}

export default function WorklistContainerView({ containerId, highlightPositions, onBack }: Props) {
  const [container, setContainer] = useState<any | null>(null)
  const [samples, setSamples] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadContainer()
  }, [containerId])

  const loadContainer = async () => {
    setLoading(true)
    try {
      const { data: containerData, error } = await supabase
        .from('containers')
        .select('*, samples!samples_container_id_fkey(*)')
        .eq('id', containerId)
        .single()
      
      if (error) throw error
      setContainer(containerData)
      setSamples(containerData.samples || [])
    } catch (err) {
      console.error('Failed to load container:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSampleClick = (sample: any | null, position: string) => {
    // Toggle selection for highlighted worklist samples
    if (sample && highlightPositions.includes(position)) {
      const newSelected = new Set(selectedPositions)
      if (newSelected.has(position)) {
        newSelected.delete(position)
      } else {
        newSelected.add(position)
      }
      setSelectedPositions(newSelected)
    }
  }

  const getWorklistSamplesInContainer = () => {
    return samples.filter(s => 
      highlightPositions.includes(s.position) && !s.is_archived
    )
  }

  const checkoutSamples = async (samplesToCheckout: any[]) => {
    if (samplesToCheckout.length === 0) return

    const user = getUser()
    const token = getToken()
    
    if (!user || !token) {
      alert('You must be signed in to checkout samples')
      return
    }

    setProcessing(true)
    try {
      // Checkout each sample using Supabase directly
      for (const sample of samplesToCheckout) {
        const { error } = await supabase
          .from('samples')
          .update({
            is_checked_out: true,
            checked_out_at: new Date().toISOString(),
            checked_out_by: user.initials,
            previous_container_id: sample.container_id,
            previous_position: sample.position,
            container_id: null,
            position: null
          })
          .eq('id', sample.id)
        
        if (error) {
          console.error('Error checking out sample:', error)
          alert(`Failed to checkout ${sample.sample_id}: ${error.message}`)
          return
        }
      }

      alert(`Checked out ${samplesToCheckout.length} sample(s)`)
      setSelectedPositions(new Set())
      await loadContainer()
    } catch (err: any) {
      console.error('Error checking out samples:', err)
      alert(`Failed to checkout samples: ${err?.message || 'Unknown error'}`)
    } finally {
      setProcessing(false)
    }
  }

  const undoCheckout = async () => {
    const user = getUser()
    
    if (!user) {
      alert('You must be signed in to undo checkout')
      return
    }

    setProcessing(true)
    try {
      // Find all samples that were checked out from this container by current user
      const { data: checkedOutSamples, error: fetchError } = await supabase
        .from('samples')
        .select('*')
        .eq('is_checked_out', true)
        .eq('previous_container_id', containerId)
        .eq('checked_out_by', user.initials)
      
      if (fetchError) {
        console.error('Error fetching checked out samples:', fetchError)
        alert(`Error: ${fetchError.message}`)
        return
      }

      if (!checkedOutSamples || checkedOutSamples.length === 0) {
        alert('No samples from this container to restore')
        return
      }

      // Restore each sample
      for (const sample of checkedOutSamples) {
        const { error } = await supabase
          .from('samples')
          .update({
            container_id: sample.previous_container_id,
            position: sample.previous_position,
            is_checked_out: false,
            checked_out_at: null,
            checked_out_by: null,
            previous_container_id: null,
            previous_position: null
          })
          .eq('id', sample.id)
        
        if (error) {
          console.error('Error restoring sample:', error)
          alert(`Failed to restore ${sample.sample_id}: ${error.message}`)
          return
        }
      }

      alert(`Restored ${checkedOutSamples.length} sample(s) to this container`)
      await loadContainer()
    } catch (err: any) {
      console.error('Error undoing checkout:', err)
      alert(`Failed to undo checkout: ${err?.message || 'Unknown error'}`)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return <div className="muted">Loading container...</div>
  }

  if (!container) {
    return (
      <div>
        <div className="muted">Container not found</div>
        <button className="btn" onClick={onBack}>Back to Worklist</button>
      </div>
    )
  }

  const worklistSamples = getWorklistSamplesInContainer()
  const selectedSamples = worklistSamples.filter(s => selectedPositions.has(s.position))

  return (
    <div style={{maxWidth: 1400, margin: '0 auto'}}>
      <div style={{marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16}}>
        <button className="btn" onClick={onBack}>
          ← Back to Worklist
        </button>
        <div style={{flex: 1}}>
          <h2 style={{fontSize: 24, fontWeight: 600, margin: 0}}>{container.name}</h2>
          <div className="muted">{container.location} • {container.type} • {container.layout}</div>
        </div>
      </div>

      <div style={{
        padding: 16,
        background: '#eff6ff',
        border: '2px solid #3b82f6',
        borderRadius: 8,
        marginBottom: 16
      }}>
        <div style={{fontWeight: 600, marginBottom: 4}}>
          Worklist Samples in this Container: {worklistSamples.length}
        </div>
        <div style={{fontSize: 14, color: '#1e40af'}}>
          Highlighted positions: {highlightPositions.join(', ')}
        </div>
        {selectedPositions.size > 0 && (
          <div style={{fontSize: 14, color: '#1e40af', marginTop: 4}}>
            Selected: {selectedPositions.size} sample(s)
          </div>
        )}
      </div>

      <div style={{marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap'}}>
        <button 
          className="btn"
          onClick={() => setSelectedPositions(new Set(worklistSamples.map(s => s.position)))}
          disabled={processing || worklistSamples.length === 0}
        >
          Select All ({worklistSamples.length})
        </button>
        <button 
          className="btn ghost"
          onClick={() => setSelectedPositions(new Set())}
          disabled={processing || selectedPositions.size === 0}
        >
          Deselect All
        </button>
        <div style={{flex: 1}} />
        <button 
          className="btn"
          onClick={() => checkoutSamples(selectedSamples)}
          disabled={processing || selectedSamples.length === 0}
          style={{background: '#10b981', color: 'white'}}
        >
          Checkout Selected ({selectedSamples.length})
        </button>
        <button 
          className="btn"
          onClick={() => checkoutSamples(worklistSamples)}
          disabled={processing || worklistSamples.length === 0}
          style={{background: '#10b981', color: 'white'}}
        >
          Checkout All from Container ({worklistSamples.length})
        </button>
        <button 
          className="btn"
          onClick={undoCheckout}
          disabled={processing}
          style={{background: '#f59e0b', color: 'white'}}
        >
          Undo Checkout
        </button>
      </div>

      <ContainerGridView
        container={container}
        samples={samples}
        onSampleClick={handleSampleClick}
        editMode={false}
        highlightedPositions={highlightPositions}
        selectedPositions={Array.from(selectedPositions)}
      />
    </div>
  )
}
