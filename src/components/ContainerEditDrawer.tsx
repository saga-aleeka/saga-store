import React, {useState, useEffect, useRef} from 'react'
import { SAMPLE_TYPES, LAYOUTS, TEMPS } from '../constants'
import { apiFetch } from '../lib/api'

export default function ContainerEditDrawer({ container, onClose }: { container: any, onClose: ()=>void }){
  const defaultForm = {
    id: '',
    name: '',
    location: '',
    layout: LAYOUTS[0],
    temperature: TEMPS[0],
    type: SAMPLE_TYPES[0] || '',
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
            <select value={form.layout ?? LAYOUTS[0]} onChange={(e)=> updateField('layout', e.target.value)}>
              {LAYOUTS.map(l => <option key={l}>{l}</option>)}
            </select>
          </label>

          <label>
            Storage condition
            <select value={form.temperature ?? TEMPS[0]} onChange={(e)=> updateField('temperature', e.target.value)}>
              {TEMPS.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>

          <label>
            Sample type
            <select value={form.type ?? SAMPLE_TYPES[0]} onChange={(e)=> updateField('type', e.target.value)}>
              {SAMPLE_TYPES.map(s => <option key={s}>{s}</option>)}
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
