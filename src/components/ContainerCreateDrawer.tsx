import React, {useState, useRef, useEffect} from 'react'
import { SAMPLE_TYPES, LAYOUTS, TEMPS } from '../constants'
import { supabase } from '../lib/api'

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

export default function ContainerCreateDrawer({
  onClose,
  initialColdStorageId,
  initialRackId,
  initialRackPosition,
  initialName,
  initialMode
}: {
  onClose: () => void
  initialColdStorageId?: string
  initialRackId?: string
  initialRackPosition?: string
  initialName?: string
  initialMode?: 'container' | 'storage'
}){
  const INTERIOR_IMAGE_BUCKET = 'cold-storage-interiors'
  const [mode, setMode] = useState<'container' | 'storage'>(initialMode || 'container')
  const defaultForm = {
    name: initialName || '',
    cold_storage_id: initialColdStorageId || '',
    rack_id: initialRackId || '',
    rack_position: initialRackPosition || '',
    layout: '9x9',
    temperature: '-80°C',
    type: '',
    used: 0,
    total: 81,
    archived: false,
    training: false,
    is_rnd: false,
  }

  const defaultStorageForm = {
    name: '',
    type: '',
    temperature: '',
    location: '',
    interior_image_url: '',
    pm_due_date: '',
    model: '',
    serial_number: '',
    status: 'active'
  }

  const [form, setForm] = useState<any>(defaultForm)
  const [errors, setErrors] = useState<{name?:string, cold_storage_id?:string, rack_id?:string, rack_position?:string}>({})
  const [storageForm, setStorageForm] = useState<any>(defaultStorageForm)
  const [storageErrors, setStorageErrors] = useState<{name?:string, type?:string}>({})
  const [rackDrafts, setRackDrafts] = useState<Array<{name: string; position: string; grid_rows: string; grid_cols: string}>>([])
  const [savingStorage, setSavingStorage] = useState(false)
  const [storageImageFile, setStorageImageFile] = useState<File | null>(null)
  const nameRef = useRef<HTMLInputElement | null>(null)
  const [coldStorageOptions, setColdStorageOptions] = useState<any[]>([])
  const [rackOptions, setRackOptions] = useState<any[]>([])
  const [loadingStorage, setLoadingStorage] = useState(false)
  const [rackPositionAssignments, setRackPositionAssignments] = useState<Record<string, string>>({})

  const loadRacks = async (coldStorageId: string) => {
    if (!coldStorageId) {
      setRackOptions([])
      return
    }
    const { data: racks } = await supabase
      .from('racks')
      .select('*')
      .eq('cold_storage_id', coldStorageId)
      .order('name', { ascending: true })
    setRackOptions(racks || [])
  }

  useEffect(() => {
    let mounted = true
    async function loadStorage() {
      setLoadingStorage(true)
      try {
        const { data } = await supabase
          .from('cold_storage_units')
          .select('*')
          .order('name', { ascending: true })

        if (!mounted) return
        setColdStorageOptions(data || [])

        const initialColdStorageId = form.cold_storage_id || data?.[0]?.id || ''
        if (initialColdStorageId) {
          setForm((prev: any) => ({ ...prev, cold_storage_id: initialColdStorageId }))
          await loadRacks(initialColdStorageId)
        }
      } catch (e) {
        console.warn('Failed to load cold storage units', e)
      } finally {
        if (mounted) setLoadingStorage(false)
      }
    }

    loadStorage()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (form.rack_id && !rackOptions.find((rack) => rack.id === form.rack_id)) {
      setForm((prev: any) => ({ ...prev, rack_id: '', rack_position: '' }))
    }
  }, [rackOptions, form.rack_id])

  useEffect(() => {
    let mounted = true
    async function loadAssignments() {
      if (!form.rack_id) {
        if (mounted) setRackPositionAssignments({})
        return
      }
      try {
        const { data } = await supabase
          .from('containers')
          .select('id, name, rack_position')
          .eq('rack_id', form.rack_id)
          .eq('archived', false)
          .not('rack_position', 'is', null)

        if (!mounted) return
        const mapping = (data || []).reduce<Record<string, string>>((acc, container) => {
          if (container.rack_position) {
            acc[container.rack_position] = container.name || container.id
          }
          return acc
        }, {})
        setRackPositionAssignments(mapping)
      } catch (e) {
        console.warn('Failed to load rack assignments', e)
        if (mounted) setRackPositionAssignments({})
      }
    }

    loadAssignments()
    return () => {
      mounted = false
    }
  }, [form.rack_id])

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

    // Calculate total capacity
    const [rows, cols] = template.layout.split('x').map((n: string) => parseInt(n))
    const maxPositions = rows * cols
    
    // DP Pools always have 80 capacity (I9 is unavailable)
    if (sampleType === 'DP Pools' && template.layout === '9x9') {
      newForm.total = 80
    } else {
      newForm.total = maxPositions
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
      const [rows, cols] = layout.split('x').map((n: string) => parseInt(n))
      const maxPositions = rows * cols
      
      // DP Pools always have 80 capacity (I9 is unavailable)
      if (type === 'DP Pools' && layout === '9x9') {
        newForm.total = 80
      } else {
        newForm.total = maxPositions
      }
    }
    
    setForm(newForm)
  }

  const handleColdStorageChange = async (coldStorageId: string) => {
    setErrors((s) => ({ ...s, cold_storage_id: undefined }))
    setForm((prev: any) => ({ ...prev, cold_storage_id: coldStorageId, rack_id: '', rack_position: '' }))
    await loadRacks(coldStorageId)
  }

  const handleRackChange = (rackId: string) => {
    setErrors((s) => ({ ...s, rack_id: undefined }))
    if (rackId === '__na__') {
      setForm((prev: any) => ({ ...prev, rack_id: '', rack_position: '' }))
      return
    }
    setForm((prev: any) => ({ ...prev, rack_id: rackId, rack_position: '' }))
  }

  const indexToLetters = (index: number) => {
    let result = ''
    let i = index
    while (i >= 0) {
      result = String.fromCharCode(65 + (i % 26)) + result
      i = Math.floor(i / 26) - 1
    }
    return result
  }

  const buildRackPositions = (rows: number, cols: number) => {
    const positions: string[] = []
    for (let r = 1; r <= rows; r++) {
      for (let c = 0; c < cols; c++) {
        const colLabel = indexToLetters(c)
        positions.push(`${colLabel}${r}`)
      }
    }
    return positions
  }

  async function createContainer(){
    // validation with inline errors and focus
    const newErrors: any = {}
    if (!form.name) newErrors.name = 'Name is required'
    if (!form.cold_storage_id) newErrors.cold_storage_id = 'Cold storage is required'
    if (form.rack_id && !form.rack_position) newErrors.rack_position = 'Rack position is required'
    setErrors(newErrors)
    if (Object.keys(newErrors).length) {
      if (newErrors.name) nameRef.current?.focus()
      return
    }

    // Insert directly via Supabase
    const { data, error } = await supabase
      .from('containers')
      .insert([{
        name: form.name,
        cold_storage_id: form.cold_storage_id,
        rack_id: form.rack_id || null,
        rack_position: form.rack_id ? form.rack_position : null,
        layout: form.layout,
        temperature: form.temperature,
        type: form.type,
        used: form.used,
        total: form.total,
        archived: form.archived,
        training: form.training,
        is_rnd: form.is_rnd
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

  const updateStorageField = (key: string, value: string) => {
    setStorageForm((prev: any) => ({ ...prev, [key]: value }))
  }

  const handleStorageTemperatureChange = (value: string) => {
    const temp = String(value || '').trim()
    let nextType = storageForm.type
    if (temp === '4°C') nextType = 'Refrigerator'
    if (temp === '-20°C' || temp === '-80°C') nextType = 'Freezer'
    setStorageForm((prev: any) => ({
      ...prev,
      temperature: value,
      type: nextType
    }))
  }

  const updateRackDraft = (index: number, key: keyof typeof rackDrafts[number], value: string) => {
    setRackDrafts((prev) => prev.map((rack, idx) => idx === index ? { ...rack, [key]: value } : rack))
  }

  const addRackDraft = () => {
    setRackDrafts((prev) => [...prev, { name: '', position: '', grid_rows: '', grid_cols: '' }])
  }

  const removeRackDraft = (index: number) => {
    setRackDrafts((prev) => prev.filter((_, idx) => idx !== index))
  }

  const createStorageLocation = async () => {
    const newErrors: any = {}
    if (!storageForm.name.trim()) newErrors.name = 'Name is required'
    if (!storageForm.type.trim()) newErrors.type = 'Type is required'
    setStorageErrors(newErrors)
    if (Object.keys(newErrors).length) return

    setSavingStorage(true)
    try {
      const { data: unit, error } = await supabase
        .from('cold_storage_units')
        .insert([
          {
            name: storageForm.name.trim(),
            type: storageForm.type.trim(),
            temperature: storageForm.temperature.trim() || null,
            location: storageForm.location.trim() || null,
            interior_image_url: storageForm.interior_image_url.trim() || null,
            pm_due_date: storageForm.pm_due_date || null,
            model: storageForm.model.trim() || null,
            serial_number: storageForm.serial_number.trim() || null,
            status: storageForm.status.trim() || 'active'
          }
        ])
        .select()
        .single()

      if (error) throw error

      if (storageImageFile) {
        const safeName = storageImageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const filePath = `cold-storage/${unit.id}/${Date.now()}-${safeName}`
        const { error: uploadError } = await supabase
          .storage
          .from(INTERIOR_IMAGE_BUCKET)
          .upload(filePath, storageImageFile, { upsert: true })

        if (uploadError) throw uploadError

        const { error: updateError } = await supabase
          .from('cold_storage_units')
          .update({ interior_image_path: filePath })
          .eq('id', unit.id)

        if (updateError) throw updateError
      }

      const racksToInsert = rackDrafts
        .filter((rack) => rack.name.trim())
        .map((rack) => ({
          cold_storage_id: unit.id,
          name: rack.name.trim(),
          position: rack.position.trim() || null,
          grid_rows: rack.grid_rows ? parseInt(rack.grid_rows, 10) : null,
          grid_cols: rack.grid_cols ? parseInt(rack.grid_cols, 10) : null
        }))

      if (racksToInsert.length > 0) {
        const { error: rackError } = await supabase
          .from('racks')
          .insert(racksToInsert)

        if (rackError) throw rackError
      }

      window.location.hash = `#/cold-storage/${unit.id}`
    } catch (e: any) {
      console.error('Failed to create cold storage unit:', e)
      alert(`Failed to create storage location: ${e?.message || 'Unknown error'}`)
    } finally {
      setSavingStorage(false)
    }
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0}}>{mode === 'container' ? 'Create New Container' : 'Create Storage Location'}</h3>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>

        {mode === 'container' && (
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
              {SAMPLE_TYPES.map(s => <option key={s}>{s}</option>)}
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
            Cold Storage
            <select
              value={form.cold_storage_id}
              onChange={(e) => handleColdStorageChange(e.target.value)}
              aria-invalid={!!errors.cold_storage_id}
              aria-describedby={errors.cold_storage_id ? 'error-cold-storage' : undefined}
              disabled={loadingStorage}
            >
              <option value="">Select cold storage</option>
              {coldStorageOptions.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} {unit.temperature ? `(${unit.temperature})` : ''}
                </option>
              ))}
            </select>
            {errors.cold_storage_id ? <div id="error-cold-storage" style={{color:'var(--danger)',fontSize:12,marginTop:4}}>{errors.cold_storage_id}</div> : null}
          </label>

          <label>
            Rack (optional)
            <select
              value={form.rack_id}
              onChange={(e) => handleRackChange(e.target.value)}
              aria-invalid={!!errors.rack_id}
              aria-describedby={errors.rack_id ? 'error-rack' : undefined}
              disabled={!form.cold_storage_id || loadingStorage}
            >
              <option value="">Select rack</option>
              <option value="__na__">N/A (no rack)</option>
              {rackOptions.map((rack) => (
                <option key={rack.id} value={rack.id}>
                  {rack.name} {rack.position ? `(${rack.position})` : ''}
                </option>
              ))}
            </select>
            {errors.rack_id ? <div id="error-rack" style={{color:'var(--danger)',fontSize:12,marginTop:4}}>{errors.rack_id}</div> : null}
          </label>

          <label>
            Rack Position
            {(() => {
              const selectedRack = rackOptions.find((rack) => rack.id === form.rack_id)
              const rows = Number(selectedRack?.grid_rows || 0)
              const cols = Number(selectedRack?.grid_cols || 0)
              const total = rows * cols

              if (rows > 0 && cols > 0 && total <= 500) {
                const positions = buildRackPositions(rows, cols)
                return (
                  <select
                    value={form.rack_position}
                    onChange={(e) => { updateField('rack_position', e.target.value); setErrors((s) => ({ ...s, rack_position: undefined })) }}
                    aria-invalid={!!errors.rack_position}
                    aria-describedby={errors.rack_position ? 'error-rack-position' : undefined}
                    disabled={!form.rack_id}
                  >
                    <option value="">Select rack position</option>
                    {positions.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}{rackPositionAssignments[pos] ? ` - ${rackPositionAssignments[pos]}` : ''}
                      </option>
                    ))}
                  </select>
                )
              }

              return (
                <input
                  value={form.rack_position}
                  onChange={(e) => { updateField('rack_position', e.target.value); setErrors((s) => ({ ...s, rack_position: undefined })) }}
                  aria-invalid={!!errors.rack_position}
                  aria-describedby={errors.rack_position ? 'error-rack-position' : undefined}
                  disabled={!form.rack_id}
                  placeholder="e.g., Shelf 2 / Slot B3"
                />
              )
            })()}
            {errors.rack_position ? <div id="error-rack-position" style={{color:'var(--danger)',fontSize:12,marginTop:4}}>{errors.rack_position}</div> : null}
            {rackOptions.find((rack) => rack.id === form.rack_id && rack.grid_rows && rack.grid_cols) && (
              <div className="muted" style={{fontSize:12,marginTop:4}}>
                Uses rack grid. Adjust rows/cols in rack settings if needed.
              </div>
            )}
          </label>

          <label>
            Dimension
            <select value={form.layout} onChange={(e)=> updateField('layout', e.target.value)}>
              {LAYOUTS.map(l => <option key={l}>{l}</option>)}
            </select>
          </label>

          <label>
            Storage Temperature
            <select value={form.temperature} onChange={(e)=> updateField('temperature', e.target.value)}>
              {TEMPS.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>

          <div style={{display:'grid',gap:8}}>
            <label style={{display:'grid',gridTemplateColumns:'16px 1fr',alignItems:'center',gap:8}}>
              <input style={{margin:0}} type="checkbox" checked={!!form.archived} onChange={(e)=> updateField('archived', e.target.checked)} />
              <span style={{whiteSpace:'nowrap'}}>Archive Container</span>
            </label>

            <label style={{display:'grid',gridTemplateColumns:'16px 1fr',alignItems:'center',gap:8}}>
              <input style={{margin:0}} type="checkbox" checked={!!form.training} onChange={(e)=> updateField('training', e.target.checked)} />
              <span style={{whiteSpace:'nowrap'}}>Training Container</span>
            </label>

            <label style={{display:'grid',gridTemplateColumns:'16px 1fr',alignItems:'center',gap:8}}>
              <input style={{margin:0}} type="checkbox" checked={!!form.is_rnd} onChange={(e)=> updateField('is_rnd', e.target.checked)} />
              <span style={{whiteSpace:'nowrap'}}>R&amp;D Container</span>
            </label>
          </div>

          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn" onClick={createContainer} disabled={!form.name || !form.cold_storage_id}>Create Container</button>
          </div>
        </div>
        )}

        {mode === 'storage' && (
          <div style={{marginTop:12,display:'grid',gap:10}}>
            <label>
              Unit Name
              <input
                value={storageForm.name}
                onChange={(e) => { updateStorageField('name', e.target.value); setStorageErrors((s) => ({ ...s, name: undefined })) }}
                aria-invalid={!!storageErrors.name}
                aria-describedby={storageErrors.name ? 'error-storage-name' : undefined}
                placeholder="e.g., INV-451"
              />
              {storageErrors.name ? <div id="error-storage-name" style={{color:'var(--danger)',fontSize:12,marginTop:4}}>{storageErrors.name}</div> : null}
            </label>

            <label>
              Temperature
              <select
                value={storageForm.temperature}
                onChange={(e) => handleStorageTemperatureChange(e.target.value)}
              >
                <option value="">Select temperature</option>
                {TEMPS.map((temp) => (
                  <option key={temp} value={temp}>{temp}</option>
                ))}
              </select>
            </label>

            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{minWidth: 80, fontWeight: 600}}>Type</div>
              <div className="muted" style={{fontSize: 13}}>{storageForm.type || '-'}</div>
            </div>

            <label>
              Location
              <input
                value={storageForm.location}
                onChange={(e) => updateStorageField('location', e.target.value)}
                placeholder="e.g., Lab A"
              />
            </label>

            <label>
              Interior Image
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('storage-interior-upload') as HTMLInputElement | null
                    input?.click()
                  }}
                >
                  Upload Image
                </button>
                <input
                  id="storage-interior-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => setStorageImageFile(e.target.files?.[0] || null)}
                />
                <span className="muted" style={{ fontSize: 12 }}>
                  {storageImageFile ? storageImageFile.name : 'No image selected'}
                </span>
                {storageImageFile && (
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => setStorageImageFile(null)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </label>

            <label>
              Next PM Due Date
              <input
                type="date"
                value={storageForm.pm_due_date}
                onChange={(e) => updateStorageField('pm_due_date', e.target.value)}
              />
            </label>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <label>
                Model
                <input
                  value={storageForm.model}
                  onChange={(e) => updateStorageField('model', e.target.value)}
                />
              </label>
              <label>
                Serial Number
                <input
                  value={storageForm.serial_number}
                  onChange={(e) => updateStorageField('serial_number', e.target.value)}
                />
              </label>
            </div>

            <label>
              Status
              <select
                value={storageForm.status}
                onChange={(e) => updateStorageField('status', e.target.value)}
              >
                <option value="active">In Service</option>
                <option value="out_of_service">Out of Service</option>
              </select>
            </label>

            <div style={{marginTop:8,paddingTop:12,borderTop:'1px solid #e5e7eb'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontWeight:600}}>Racks</div>
                <button className="btn ghost" onClick={addRackDraft}>Add Rack</button>
              </div>
              {rackDrafts.length === 0 && (
                <div className="muted" style={{fontSize:13}}>Add racks if you want a grid layout for this unit.</div>
              )}
              {rackDrafts.map((rack, idx) => (
                <div key={`rack-${idx}`} style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 0.8fr 0.8fr auto',gap:8,marginBottom:8}}>
                  <input
                    value={rack.name}
                    onChange={(e) => updateRackDraft(idx, 'name', e.target.value)}
                    placeholder="Rack name"
                  />
                  <input
                    value={rack.position}
                    onChange={(e) => updateRackDraft(idx, 'position', e.target.value)}
                    placeholder="Position"
                  />
                  <input
                    type="number"
                    value={rack.grid_rows}
                    onChange={(e) => updateRackDraft(idx, 'grid_rows', e.target.value)}
                    placeholder="Rows"
                    min={1}
                  />
                  <input
                    type="number"
                    value={rack.grid_cols}
                    onChange={(e) => updateRackDraft(idx, 'grid_cols', e.target.value)}
                    placeholder="Cols"
                    min={1}
                  />
                  <button className="btn ghost" onClick={() => removeRackDraft(idx)}>Remove</button>
                </div>
              ))}
            </div>

            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
              <button className="btn ghost" onClick={onClose}>Cancel</button>
              <button className="btn" onClick={createStorageLocation} disabled={savingStorage}>
                {savingStorage ? 'Creating...' : 'Create Storage Location'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
