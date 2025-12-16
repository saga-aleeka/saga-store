import React, {useState, useRef, useEffect} from 'react'
import { apiFetch, supabase } from '../lib/api'
import { TEMPS } from '../constants'

// Template configurations for each sample type
const SAMPLE_TYPE_TEMPLATES: Record<string, { layout: string, temperature: string, description: string }> = {
  'cfDNA Tubes': {
    layout: '9x9',
    temperature: '-20°C',
    description: 'Cell-free DNA samples stored in 9×9 grid at -20°C'
  },
  'DP Pools': {
    layout: '9x9',
    temperature: '-20°C',
    description: 'DNA Pool samples in 9×9 grid (80 positions, I9 unavailable) at -20°C'
  },
  'DTC Tubes': {
    layout: '9x9',
    temperature: '4°C',
    description: 'Direct-to-consumer samples in 9×9 grid at 4°C'
  },
  'PA Pools': {
    layout: '9x9',
    temperature: '-20°C',
    description: 'Plasma pool samples in 9×9 grid at -20°C'
  },
  'MNC Tubes': {
    layout: '9x9',
    temperature: '-20°C',
    description: 'Mononuclear cell samples in 9×9 grid at -20°C'
  },
  'Plasma Tubes': {
    layout: '9x9',
    temperature: '-80°C',
    description: 'Plasma samples in 9×9 grid at -80°C'
  },
  'BC Tubes': {
    layout: '9x9',
    temperature: '-80°C',
    description: 'Buffy coat samples in 9×9 grid at -80°C'
  },
  'IDT Plates': {
    layout: '14x7',
    temperature: '-20°C',
    description: 'IDT plates with 14 rows × 7 columns at -20°C'
  }
}

export default function ContainerCreateDrawer({ onClose }: { onClose: ()=>void }){
  const [sampleTypes, setSampleTypes] = useState<string[]>([])
  const [containerTypes, setContainerTypes] = useState<any[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)
  
  // Load dynamic types
  useEffect(() => {
    loadTypes()
    
    // Listen for updates
    const handleSampleUpdate = () => loadTypes()
    const handleContainerUpdate = () => loadTypes()
    window.addEventListener('sample_types_updated', handleSampleUpdate)
    window.addEventListener('container_types_updated', handleContainerUpdate)
    return () => {
      window.removeEventListener('sample_types_updated', handleSampleUpdate)
      window.removeEventListener('container_types_updated', handleContainerUpdate)
    }
  }, [])
  
  async function loadTypes() {
    try {
      const [sampleData, containerData] = await Promise.all([
        apiFetch('/api/sample_types').then(r => r.json()),
        apiFetch('/api/container_types').then(r => r.json())
      ])
      
      // Add "Sample Type" as first option for sample types
      setSampleTypes(['Sample Type', ...sampleData.map((st: any) => st.name)])
      setContainerTypes(containerData)
    } catch (e) {
      console.error('Failed to load types:', e)
    } finally {
      setLoadingTypes(false)
    }
  }
  const defaultForm = {
    name: '',
    location: '',
    layout: '9x9',
    temperature: '-80°C',
    type: '',
    used: 0,
    total: 81,
    archived: false,
    training: false,
  }

  const [form, setForm] = useState<any>(defaultForm)
  const [errors, setErrors] = useState<{name?:string, location?:string}>({})
  const nameRef = useRef<HTMLInputElement | null>(null)
  const locationRef = useRef<HTMLInputElement | null>(null)

  // Predict next container name based on sample type
  const predictNextName = async (sampleType: string) => {
    if (!sampleType || sampleType === 'Sample Type') return
    
    try {
      const { data, error } = await supabase
        .from('containers')
        .select('name')
        .eq('type', sampleType)
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (!error && data && data.name) {
        // Extract number from end of container name
        const match = data.name.match(/(\d+)$/)
        if (match) {
          const lastNumber = parseInt(match[1])
          const prefix = data.name.substring(0, data.name.length - match[1].length)
          const nextNumber = lastNumber + 1
          // Pad with zeros to match original length
          const paddedNumber = String(nextNumber).padStart(match[1].length, '0')
          const predictedName = prefix + paddedNumber
          
          setForm((prev: any) => ({ ...prev, name: predictedName }))
        }
      }
    } catch (e) {
      console.warn('Could not predict container name:', e)
    }
  }
  
  const applyTemplate = async (sampleType: string) => {
    const template = SAMPLE_TYPE_TEMPLATES[sampleType]
    if (!template) return

    const newForm = {
      ...form,
      type: sampleType,
      layout: template.layout,
      temperature: template.temperature
    }

    // Calculate total capacity based on layout
    const containerType = containerTypes.find(ct => ct.name === template.layout)
    if (containerType) {
      const maxPositions = containerType.rows * containerType.columns
      
      // DP Pools always have 80 capacity (I9 is unavailable)
      if (sampleType === 'DP Pools' && template.layout === '9x9') {
        newForm.total = 80
      } else {
        newForm.total = maxPositions
      }
    } else {
      // Fallback to parsing layout string
      const [rows, cols] = template.layout.split('x').map((n: string) => parseInt(n))
      const maxPositions = rows * cols
      
      if (sampleType === 'DP Pools' && template.layout === '9x9') {
        newForm.total = 80
      } else {
        newForm.total = maxPositions
      }
    }

    setForm(newForm)
    
    // Predict next container name for this type
    await predictNextName(sampleType)
  }
  
  const updateField = (k: string, v: any) => {
    const newForm = {...form, [k]: v}
    
    // Auto-update total capacity based on layout and type
    if (k === 'layout' || k === 'type') {
      const layout = k === 'layout' ? v : form.layout
      const type = k === 'type' ? v : form.type
      
      // Find container type to get dimensions
      const containerType = containerTypes.find(ct => ct.name === layout)
      if (containerType) {
        const maxPositions = containerType.rows * containerType.columns
        
        // DP Pools always have 80 capacity (I9 is unavailable)
        if (type === 'DP Pools' && layout === '9x9') {
          newForm.total = 80
        } else {
          newForm.total = maxPositions
        }
      } else {
        // Fallback to parsing layout string
        const [rows, cols] = layout.split('x').map((n: string) => parseInt(n))
        const maxPositions = rows * cols
        
        if (type === 'DP Pools' && layout === '9x9') {
          newForm.total = 80
        } else {
          newForm.total = maxPositions
        }
      }
    }
    
    setForm(newForm)
  }

  async function create(){
    // validation with inline errors and focus
    const newErrors: any = {}
    if (!form.name) newErrors.name = 'Name is required'
    if (!form.location) newErrors.location = 'Location is required'
    setErrors(newErrors)
    if (Object.keys(newErrors).length) {
      if (newErrors.name) nameRef.current?.focus()
      else if (newErrors.location) locationRef.current?.focus()
      return
    }

    // Insert directly via Supabase
    const { data, error } = await supabase
      .from('containers')
      .insert([{
        name: form.name,
        location: form.location,
        layout: form.layout,
        temperature: form.temperature,
        type: form.type,
        used: form.used,
        total: form.total,
        archived: form.archived,
        training: form.training
      }])
      .select()
      .single()

    if (error) {
      console.error('Failed to create container:', error)
      alert('Failed to create container: ' + error.message)
      return
    }

    // Dispatch event to refresh container list
    window.dispatchEvent(new CustomEvent('container-updated', { detail: data }))
    
    // Navigate to the new container's detail view
    if (data && data.id) {
      window.location.hash = `#/containers/${data.id}`
    } else {
      onClose()
    }
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0}}>Create New Container</h3>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>

        <div style={{marginTop:12,display:'grid',gap:10}}>
          <label>
            Sample Type
            <select 
              value={form.type} 
              onChange={(e) => {
                const selectedType = e.target.value
                if (selectedType !== 'Sample Type' && SAMPLE_TYPE_TEMPLATES[selectedType]) {
                  applyTemplate(selectedType)
                } else {
                  updateField('type', selectedType)
                }
              }}
            >
              {sampleTypes.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>

          <label>
            Container Name
            <input 
              ref={nameRef} 
              aria-invalid={!!errors.name} 
              aria-describedby={errors.name ? 'error-name' : undefined} 
              value={form.name} 
              onChange={(e) => { updateField('name', e.target.value); setErrors((s)=> ({...s, name: undefined})) }} 
              placeholder="e.g., cfDNA_BOX_001"
            />
            {errors.name ? <div id="error-name" style={{color:'var(--danger)',fontSize:12,marginTop:4}}>{errors.name}</div> : null}
          </label>

          <label>
            Location
            <input 
              ref={locationRef} 
              aria-invalid={!!errors.location} 
              aria-describedby={errors.location ? 'error-location' : undefined} 
              value={form.location} 
              onChange={(e) => { updateField('location', e.target.value); setErrors((s)=> ({...s, location: undefined})) }} 
              placeholder="e.g., Freezer A / Shelf 3"
            />
            {errors.location ? <div id="error-location" style={{color:'var(--danger)',fontSize:12,marginTop:4}}>{errors.location}</div> : null}
          </label>

          <label>
            Dimension
            <select value={form.layout} onChange={(e)=> updateField('layout', e.target.value)}>
              {containerTypes.map(ct => (
                <option key={ct.id} value={ct.name}>
                  {ct.name} ({ct.rows}×{ct.columns} = {ct.rows * ct.columns} positions)
                </option>
              ))}
            </select>
          </label>

          <label>
            Storage Temperature
            <select value={form.temperature} onChange={(e)=> updateField('temperature', e.target.value)}>
              {TEMPS.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>

          <label style={{display:'flex',alignItems:'center',gap:8}}>
            <input type="checkbox" checked={!!form.archived} onChange={(e)=> updateField('archived', e.target.checked)} /> Archive Container
          </label>

          <label style={{display:'flex',alignItems:'center',gap:8}}>
            <input type="checkbox" checked={!!form.training} onChange={(e)=> updateField('training', e.target.checked)} /> Training Container
          </label>

          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn" onClick={create} disabled={!form.name || !form.location}>Create Container</button>
          </div>
        </div>
      </div>
    </div>
  )
}
