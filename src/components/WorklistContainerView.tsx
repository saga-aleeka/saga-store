import React, {useEffect, useState} from 'react'
import ContainerGridView from './ContainerGridView'
import { supabase } from '../lib/api'

interface Props {
  containerId: string
  highlightPositions: string[]
  onBack: () => void
}

export default function WorklistContainerView({ containerId, highlightPositions, onBack }: Props) {
  const [container, setContainer] = useState<any | null>(null)
  const [samples, setSamples] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
    // In worklist view mode, just show sample info, no editing
    if (sample) {
      alert(`Sample: ${sample.sample_id}\nPosition: ${position}`)
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
        marginBottom: 24
      }}>
        <div style={{fontWeight: 600, marginBottom: 4}}>
          Worklist Samples in this Container: {highlightPositions.length}
        </div>
        <div style={{fontSize: 14, color: '#1e40af'}}>
          Highlighted positions: {highlightPositions.join(', ')}
        </div>
      </div>

      <ContainerGridView
        container={container}
        samples={samples}
        onSampleClick={handleSampleClick}
        editMode={false}
        highlightedPositions={highlightPositions}
      />
    </div>
  )
}
