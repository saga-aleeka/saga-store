import React, {useState, useEffect, useRef} from 'react'
import { SAMPLE_TYPES, LAYOUTS, TEMPS } from '../constants'
import { supabase } from '../lib/api'
import { getUser } from '../lib/auth'

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
  const defaultForm = {
    id: '',
    name: '',
    cold_storage_id: '',
    rack_id: '',
    rack_position: '',
    layout: LAYOUTS[0],
    temperature: TEMPS[0],
    type: SAMPLE_TYPES[0] || '',
    used: 0,
    total: 0,
    archived: false,
    training: false,
    is_rnd: false,
  }

  const buildFormFromContainer = (c: any) => ({
    ...defaultForm,
    id: c?.id ?? '',
    name: c?.name ?? '',
    cold_storage_id: c?.cold_storage_id ?? '',
    rack_id: c?.rack_id ?? '',
    rack_position: c?.rack_position ?? '',
    layout: c?.layout ?? LAYOUTS[0],
    temperature: c?.temperature ?? TEMPS[0],
    type: c?.type ?? (SAMPLE_TYPES[0] || ''),
    used: c?.used ?? 0,
    total: c?.total ?? 0,
    archived: c?.archived ?? false,
    training: c?.training ?? false,
    is_rnd: c?.is_rnd ?? false,
  })

  const [form, setForm] = useState<any>(container ? buildFormFromContainer(container) : defaultForm)
  useEffect(() => setForm(container ? buildFormFromContainer(container) : defaultForm), [container])

  const [errors, setErrors] = useState<{name?:string, cold_storage_id?:string, rack_id?:string, rack_position?:string}>({})
  const nameRef = useRef<HTMLInputElement | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [coldStorageOptions, setColdStorageOptions] = useState<any[]>([])
  const [rackOptions, setRackOptions] = useState<any[]>([])
  const [loadingStorage, setLoadingStorage] = useState(false)
  const [showNewRack, setShowNewRack] = useState(false)
  const [newRackForm, setNewRackForm] = useState({ name: '', position: '', grid_rows: '', grid_cols: '' })
  const [savingRack, setSavingRack] = useState(false)
  const [rackPositionAssignments, setRackPositionAssignments] = useState<Record<string, string>>({})

  const logAudit = async (payload: any) => {
    try {
      await supabase.from('audit_logs').insert([payload])
    } catch (e) {
      console.warn('Failed to write audit log', e)
    }
  }

  if (!container) return null

  const layoutLocked = !!container?.layout

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

        const coldStorageId = form.cold_storage_id || data?.[0]?.id || ''
        if (coldStorageId) {
          await loadRacks(coldStorageId)
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
    if (!form.cold_storage_id) {
      setRackOptions([])
      return
    }
    loadRacks(form.cold_storage_id)
  }, [form.cold_storage_id])

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

  const applyTemplate = (sampleType: string) => {
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
    for (let c = 0; c < cols; c++) {
      const colLabel = indexToLetters(c)
      for (let r = 1; r <= rows; r++) {
        positions.push(`${colLabel}${r}`)
      }
    }
    return positions
  }

  const handleColdStorageChange = async (coldStorageId: string) => {
    setErrors((s) => ({ ...s, cold_storage_id: undefined }))
    if (!coldStorageId) {
      setForm((prev: any) => ({ ...prev, cold_storage_id: '', rack_id: '', rack_position: '' }))
      setRackOptions([])
      return
    }

    const currentRackId = form.rack_id
    const currentColdStorageId = form.cold_storage_id
    let currentRackName = rackOptions.find((rack) => rack.id === currentRackId)?.name

    if (!currentRackName && currentRackId) {
      try {
        const { data } = await supabase
          .from('racks')
          .select('name')
          .eq('id', currentRackId)
          .single()
        currentRackName = data?.name
      } catch (e) {
        console.warn('Failed to load rack name', e)
      }
    }

    const isUnassignedRack = currentRackName?.toUpperCase() === 'UNASSIGNED'

    if (currentRackId && coldStorageId !== currentColdStorageId && !isUnassignedRack) {
      const confirmMove = window.confirm(
        'This container is assigned to a rack. Do you want to move the entire rack to the new storage unit?\n\n' +
        'Selecting “OK” will move all containers in that rack to the new storage unit.\n' +
        'Selecting “Cancel” will unassign this container from its rack.'
      )

      if (confirmMove) {
        try {
          const { error } = await supabase
            .from('racks')
            .update({ cold_storage_id: coldStorageId })
            .eq('id', currentRackId)

          if (error) throw error

          const user = getUser()
          await logAudit({
            user_initials: user?.initials || null,
            user_name: user?.name || null,
            entity_type: 'rack',
            entity_id: currentRackId,
            action: 'moved',
            entity_name: currentRackName || currentRackId,
            changes: { from: currentColdStorageId, to: coldStorageId },
            metadata: {
              rack_id: currentRackId,
              rack_name: currentRackName,
              from_cold_storage_id: currentColdStorageId,
              to_cold_storage_id: coldStorageId
            },
            description: `Rack ${currentRackName || currentRackId} moved to new storage unit`
          })

          setForm((prev: any) => ({ ...prev, cold_storage_id: coldStorageId }))
          await loadRacks(coldStorageId)
          return
        } catch (e) {
          console.error('Failed to move rack:', e)
          alert('Failed to move rack to the new storage unit')
          return
        }
      }
    }

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

  const handleNewRackField = (key: 'name' | 'position' | 'grid_rows' | 'grid_cols', value: string) => {
    setNewRackForm((prev) => ({ ...prev, [key]: value }))
  }

  const createNewRack = async () => {
    if (!form.cold_storage_id) {
      alert('Select a cold storage unit first.')
      return
    }
    if (!newRackForm.name.trim()) {
      alert('Rack name is required.')
      return
    }

    setSavingRack(true)
    try {
      const { data, error } = await supabase
        .from('racks')
        .insert([
          {
            cold_storage_id: form.cold_storage_id,
            name: newRackForm.name.trim(),
            position: newRackForm.position.trim() || null,
            grid_rows: newRackForm.grid_rows ? parseInt(newRackForm.grid_rows, 10) : null,
            grid_cols: newRackForm.grid_cols ? parseInt(newRackForm.grid_cols, 10) : null
          }
        ])
        .select()
        .single()

      if (error) throw error

      await loadRacks(form.cold_storage_id)
      setForm((prev: any) => ({ ...prev, rack_id: data.id }))
      setNewRackForm({ name: '', position: '', grid_rows: '', grid_cols: '' })
      setShowNewRack(false)
    } catch (e) {
      console.error('Failed to create rack:', e)
      alert('Failed to create rack')
    } finally {
      setSavingRack(false)
    }
  }

  async function save(){
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

    setSaving(true)
    try {
      // Check for rack position conflicts
      if (form.rack_id && form.rack_position) {
        const { data: conflicting, error: conflictError } = await supabase
          .from('containers')
          .select('id, name, rack_id, rack_position')
          .eq('rack_id', form.rack_id)
          .eq('rack_position', form.rack_position)
          .neq('id', container.id)
          .limit(1)

        if (conflictError) {
          throw conflictError
        }

        const selectedRack = rackOptions.find((rack) => rack.id === form.rack_id)
        const isUnassigned = selectedRack?.name?.toUpperCase() === 'UNASSIGNED'

        if (!isUnassigned && conflicting && conflicting.length > 0) {
          const existing = conflicting[0]
          const confirmMove = window.confirm(
            `Rack position ${form.rack_position} is already assigned to "${existing.name || existing.id}".\n\n` +
            `Do you want to reassign it to "${form.name}"? This will clear the position on the previous container.`
          )

          if (!confirmMove) {
            setSaving(false)
            return
          }

          const { error: clearError } = await supabase
            .from('containers')
            .update({ rack_position: null })
            .eq('id', existing.id)

          if (clearError) {
            throw clearError
          }
        }
      }

      const payload = {
        name: form.name,
        type: form.type,
        layout: form.layout,
        temperature: form.temperature,
        total: form.total,
        used: form.used,
        archived: form.archived,
        training: form.training,
        is_rnd: form.is_rnd,
        cold_storage_id: form.cold_storage_id || null,
        rack_id: form.rack_id || null,
        rack_position: form.rack_id ? form.rack_position || null : null
      }

      const { error } = await supabase
        .from('containers')
        .update(payload)
        .eq('id', container.id)

      if (error) {
        throw error
      }

      const { data: confirmed, error: confirmError } = await supabase
        .from('containers')
        .select('id, name, type, layout, temperature, total, used, archived, training, is_rnd, cold_storage_id, rack_id, rack_position')
        .eq('id', container.id)
        .single()

      if (confirmError) {
        throw confirmError
      }

      window.dispatchEvent(new CustomEvent('container-updated', { detail: confirmed }))
      window.dispatchEvent(new CustomEvent('refresh-container', { detail: confirmed }))
      onClose()
    } catch (e) {
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
      const { error } = await supabase
        .from('containers')
        .delete()
        .eq('id', container.id)

      if (error) {
        throw error
      }

      window.dispatchEvent(new CustomEvent('container-updated'))
      window.location.hash = '#/containers'
      onClose()
    } catch (e) {
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
              value={form.type ?? SAMPLE_TYPES[0]} 
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
            Container name
            <input ref={nameRef} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'error-name' : undefined} value={form.name ?? ''} onChange={(e) => { updateField('name', e.target.value); setErrors((s)=> ({...s, name: undefined})) }} />
            {errors.name ? <div id="error-name" style={{color:'var(--danger)',fontSize:12,marginTop:4}}>{errors.name}</div> : null}
          </label>

          <label>
            Cold Storage
            <select
              value={form.cold_storage_id ?? ''}
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
            Rack
            <select
              value={form.rack_id ?? ''}
              onChange={(e) => {
                const value = e.target.value
                if (value === '__new__') {
                  setShowNewRack(true)
                  handleRackChange('')
                } else if (value === '__na__') {
                  setShowNewRack(false)
                  handleRackChange('__na__')
                } else {
                  setShowNewRack(false)
                  handleRackChange(value)
                }
              }}
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
              <option value="__new__">+ Add new rack...</option>
            </select>
            {errors.rack_id ? <div id="error-rack" style={{color:'var(--danger)',fontSize:12,marginTop:4}}>{errors.rack_id}</div> : null}
          </label>

          {showNewRack && (
            <div style={{border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, display: 'grid', gap: 8}}>
              <div style={{fontWeight: 600}}>New Rack</div>
              <input
                value={newRackForm.name}
                onChange={(e) => handleNewRackField('name', e.target.value)}
                placeholder="Rack name"
              />
              <input
                value={newRackForm.position}
                onChange={(e) => handleNewRackField('position', e.target.value)}
                placeholder="Position (optional)"
              />
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                <input
                  type="number"
                  value={newRackForm.grid_rows}
                  onChange={(e) => handleNewRackField('grid_rows', e.target.value)}
                  placeholder="Rows"
                  min={1}
                />
                <input
                  type="number"
                  value={newRackForm.grid_cols}
                  onChange={(e) => handleNewRackField('grid_cols', e.target.value)}
                  placeholder="Cols"
                  min={1}
                />
              </div>
              <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
                <button className="btn ghost" onClick={() => setShowNewRack(false)} disabled={savingRack}>Cancel</button>
                <button className="btn" onClick={createNewRack} disabled={savingRack || !newRackForm.name.trim()}>
                  {savingRack ? 'Adding...' : 'Add Rack'}
                </button>
              </div>
            </div>
          )}

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
                    value={form.rack_position ?? ''}
                    onChange={(e) => { updateField('rack_position', e.target.value); setErrors((s) => ({ ...s, rack_position: undefined })) }}
                    aria-invalid={!!errors.rack_position}
                    aria-describedby={errors.rack_position ? 'error-rack-position' : undefined}
                    disabled={!form.rack_id}
                  >
                    <option value="">Select rack position</option>
                    {positions.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}{rackPositionAssignments[pos] ? ` • ${rackPositionAssignments[pos]}` : ''}
                      </option>
                    ))}
                  </select>
                )
              }

              return (
                <input
                  value={form.rack_position ?? ''}
                  onChange={(e) => { updateField('rack_position', e.target.value); setErrors((s) => ({ ...s, rack_position: undefined })) }}
                  aria-invalid={!!errors.rack_position}
                  aria-describedby={errors.rack_position ? 'error-rack-position' : undefined}
                />
              )
            })()}
            {errors.rack_position ? <div id="error-rack-position" style={{color:'var(--danger)',fontSize:12,marginTop:4}}>{errors.rack_position}</div> : null}
          </label>

          <label>
            Dimension
            <select
              value={form.layout ?? LAYOUTS[0]}
              onChange={(e)=> updateField('layout', e.target.value)}
              disabled={layoutLocked}
            >
              {LAYOUTS.map(l => <option key={l}>{l}</option>)}
            </select>
            {layoutLocked ? (
              <div className="muted" style={{fontSize:12,marginTop:4}}>
                Dimensions are locked after creation.
              </div>
            ) : null}
          </label>

          <label>
            Storage condition
            <select value={form.temperature ?? TEMPS[0]} onChange={(e)=> updateField('temperature', e.target.value)}>
              {TEMPS.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>

          <div style={{display:'grid',gap:8}}>
            <label className="toggle-row">
              <input className="toggle-input" type="checkbox" checked={!!form.archived} onChange={(e)=> updateField('archived', e.target.checked)} />
              <span style={{whiteSpace:'nowrap'}}>Archived</span>
            </label>

            <label className="toggle-row">
              <input className="toggle-input" type="checkbox" checked={!!form.training} onChange={(e)=> updateField('training', e.target.checked)} />
              <span style={{whiteSpace:'nowrap'}}>Training only</span>
            </label>

            <label className="toggle-row">
              <input className="toggle-input" type="checkbox" checked={!!form.is_rnd} onChange={(e)=> updateField('is_rnd', e.target.checked)} />
              <span style={{whiteSpace:'nowrap'}}>R&amp;D only</span>
            </label>
          </div>

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
              <button
                className="btn"
                onClick={save}
                disabled={saving || deleting}
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
