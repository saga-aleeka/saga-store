import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

interface SampleType {
  key: string
  label: string
  color: string
}

export default function ContainerFilters({ selected, onChange, availableOnly, onAvailableChange, trainingOnly, onTrainingChange }: any){
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([])
  const [loading, setLoading] = useState(true)
  
  // Load sample types from database
  useEffect(() => {
    loadSampleTypes()
    
    // Listen for updates
    const handleUpdate = () => loadSampleTypes()
    window.addEventListener('sample_types_updated', handleUpdate)
    return () => window.removeEventListener('sample_types_updated', handleUpdate)
  }, [])
  
  async function loadSampleTypes() {
    try {
      const data = await apiFetch('/api/sample_types').then(r => r.json())
      const types = data.map((st: any) => ({
        key: st.name,
        label: st.name,
        color: st.color
      }))
      setSampleTypes(types)
    } catch (e) {
      console.error('Failed to load sample types:', e)
    } finally {
      setLoading(false)
    }
  }
  
  const toggle = (key: string) => {
    const next = new Set(selected || [])
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange(Array.from(next))
  }

  // compute readable text color (white or black) based on background hex
  function readableTextColor(hex: string){
    try{
      const h = hex.replace('#','')
      const r = parseInt(h.substring(0,2),16)/255
      const g = parseInt(h.substring(2,4),16)/255
      const b = parseInt(h.substring(4,6),16)/255
      // linearize
      const Rs = r <= 0.03928 ? r/12.92 : Math.pow((r+0.055)/1.055, 2.4)
      const Gs = g <= 0.03928 ? g/12.92 : Math.pow((g+0.055)/1.055, 2.4)
      const Bs = b <= 0.03928 ? b/12.92 : Math.pow((b+0.055)/1.055, 2.4)
      const lum = 0.2126 * Rs + 0.7152 * Gs + 0.0722 * Bs
      return lum > 0.6 ? '#111827' : '#ffffff'
    }catch(e){ return '#ffffff' }
  }

  return (
    <div className="filters flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        {loading ? (
          <div className="muted">Loading sample types...</div>
        ) : (
          sampleTypes.map(st => {
            const active = (selected || []).includes(st.key)
            const textColor = readableTextColor(st.color)
            // inactive: pastel background (20% alpha), text uses full color for contrast; active: fully saturated background with readable text
            const inactiveBg = `${st.color}22`
            const activeBg = st.color
            const style = active ? { background: activeBg, color: readableTextColor(activeBg), boxShadow: `0 0 0 3px ${st.color}33` } : { background: inactiveBg, color: st.color }
            return (
              <button
                key={st.key}
                onClick={() => toggle(st.key)}
                className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 focus:outline-none transition-shadow`}
                style={style}
              >
                <span>{st.label}</span>
              </button>
            )
          })
        )}
      </div>

      <div className="flex items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={availableOnly} onChange={(e)=> onAvailableChange(e.target.checked)} />
          <span>Available slots only</span>
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={trainingOnly} onChange={(e)=> onTrainingChange(e.target.checked)} />
          <span>Training only</span>
        </label>
      </div>
    </div>
  )
}
