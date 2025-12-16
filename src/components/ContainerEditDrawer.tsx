import React, {useState, useEffect, useRef} from 'react'
import { apiFetch } from '../lib/api'
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

export default function ContainerEditDrawer({ container, onClose }: { container: any, onClose: ()=>void }){
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
    id: '',
    name: '',
    location: '',
    layout: '9x9',
    temperature: TEMPS[0],
    type: '',
    used: 0,
    total: 0,
    archived: false,
    training: false,
  }

  const [form, setForm] = useState<any>(container ? {...defaultForm, ...container} : defaultForm)
  useEffect(() => setForm(container ? {...defaultForm, ...container} : defaultForm), [container])

  const [errors, setErrors] = useState<{name?:string, location?:string}>({})
  const nameRef = useRef<HTMLInputElement | null>(null)
  const locationRef = useRef<HTMLInputElement | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!container) return null

  const applyTemplate = (sampleType: string) => {
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

  async function save(){
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

    setSaving(true)
    try {
      const res = await apiFetch(`/api/containers/${container.id}`, { 
        method: 'PUT', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify(form) 
      })
      
      if (!res.ok) {
        throw new Error('Failed to update container')
      }
      
      const j = await res.json()
      // notify app that container updated
      window.dispatchEvent(new CustomEvent('container-updated', { detail: j.data }))
      onClose()
    } catch(e) {
      console.error('Save failed:', e)
      alert('Failed to save changes. Please try again.')
      setSaving(false)
    }
  }

  async function deleteContainer(){
    if (!window.confirm('Are you sure you want to delete this container? This will permanently delete the container and all its samples. This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const res = await apiFetch(`/api/containers/${container.id}`, { 
        method: 'DELETE', 
        headers: {'Content-Type':'application/json'} 
      })
      
      if (!res.ok) {
        throw new Error('Failed to delete container')
      }
      
      // notify app that container was deleted
      window.dispatchEvent(new CustomEvent('container-updated'))
      // redirect to containers list
      window.location.hash = '#/containers'
      onClose()
    } catch(e) {
      console.error('Delete failed:', e)
      alert('Failed to delete container. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0}}>Edit container</h3>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>

        <div style={{marginTop:12,display:'grid',gap:10}}>
          <label>
            Sample Type
            <select 
              value={form.type ?? sampleTypes[0] ?? ''} 
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
            Container name
            <input ref={nameRef} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'error-name' : undefined} value={form.name ?? ''} onChange={(e) => { updateField('name', e.target.value); setErrors((s)=> ({...s, name: undefined})) }} />
            {errors.name ? <div id="error-name" style={{color:'var(--danger)',fontSize:12,marginTop:4}}>{errors.name}</div> : null}
          </label>

          <label>
            Location
            <input ref={locationRef} aria-invalid={!!errors.location} aria-describedby={errors.location ? 'error-location' : undefined} value={form.location ?? ''} onChange={(e) => { updateField('location', e.target.value); setErrors((s)=> ({...s, location: undefined})) }} />
            {errors.location ? <div id="error-location" style={{color:'var(--danger)',fontSize:12,marginTop:4}}>{errors.location}</div> : null}
          </label>

          <label>
            Dimension
            <select value={form.layout ?? '9x9'} onChange={(e)=> updateField('layout', e.target.value)}>
              {containerTypes.map(ct => (
                <option key={ct.id} value={ct.name}>
                  {ct.name} ({ct.rows}×{ct.columns} = {ct.rows * ct.columns} positions)
                </option>
              ))}
            </select>
          </label>

          <label>
            Storage condition
            <select value={form.temperature ?? TEMPS[0]} onChange={(e)=> updateField('temperature', e.target.value)}>
              {TEMPS.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>

          <label style={{display:'flex',alignItems:'center',gap:8}}>
            <input type="checkbox" checked={!!form.archived} onChange={(e)=> updateField('archived', e.target.checked)} /> Archived
          </label>

          <label style={{display:'flex',alignItems:'center',gap:8}}>
            <input type="checkbox" checked={!!form.training} onChange={(e)=> updateField('training', e.target.checked)} /> Training only
          </label>

          <div style={{display:'flex',gap:8,justifyContent:'space-between',marginTop:16,paddingTop:16,borderTop:'1px solid #e5e7eb'}}>
            <button 
              className="btn" 
              onClick={deleteContainer} 
              disabled={deleting || saving}
              style={{background:'#ef4444',color:'white',borderColor:'#ef4444'}}
            >
              {deleting ? 'Deleting...' : 'Delete Container'}
            </button>
            <div style={{display:'flex',gap:8}}>
              <button className="btn ghost" onClick={onClose} disabled={saving || deleting}>Cancel</button>
              <button className="btn" onClick={save} disabled={!form.name || !form.location || saving || deleting}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
