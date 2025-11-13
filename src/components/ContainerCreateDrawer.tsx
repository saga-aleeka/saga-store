import React, {useState, useRef} from 'react'
import { SAMPLE_TYPES, LAYOUTS, TEMPS } from '../constants'
import { supabase } from '../lib/api'

export default function ContainerCreateDrawer({ onClose }: { onClose: ()=>void }){
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
  const updateField = (k: string, v: any) => setForm((f:any)=> ({...f, [k]: v}))

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
          <h3 style={{margin:0}}>Create new container</h3>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>

        <div style={{marginTop:12,display:'grid',gap:10}}>
          <label>
            Container name
            <input ref={nameRef} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'error-name' : undefined} value={form.name} onChange={(e) => { updateField('name', e.target.value); setErrors((s)=> ({...s, name: undefined})) }} />
            {errors.name ? <div id="error-name" style={{color:'var(--danger)',fontSize:12,marginTop:4}}>{errors.name}</div> : null}
          </label>

          <label>
            Location
            <input ref={locationRef} aria-invalid={!!errors.location} aria-describedby={errors.location ? 'error-location' : undefined} value={form.location} onChange={(e) => { updateField('location', e.target.value); setErrors((s)=> ({...s, location: undefined})) }} />
            {errors.location ? <div id="error-location" style={{color:'var(--danger)',fontSize:12,marginTop:4}}>{errors.location}</div> : null}
          </label>

          <label>
            Dimension
            <select value={form.layout} onChange={(e)=> updateField('layout', e.target.value)}>
              {LAYOUTS.map(l => <option key={l}>{l}</option>)}
            </select>
          </label>

          <label>
            Storage condition
            <select value={form.temperature} onChange={(e)=> updateField('temperature', e.target.value)}>
              {TEMPS.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>

          <label>
            Sample type
            <select value={form.type} onChange={(e)=> updateField('type', e.target.value)}>
              {SAMPLE_TYPES.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>

          <label style={{display:'flex',alignItems:'center',gap:8}}>
            <input type="checkbox" checked={!!form.archived} onChange={(e)=> updateField('archived', e.target.checked)} /> Archived
          </label>

          <label style={{display:'flex',alignItems:'center',gap:8}}>
            <input type="checkbox" checked={!!form.training} onChange={(e)=> updateField('training', e.target.checked)} /> Training only
          </label>

          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn" onClick={create} disabled={!form.name || !form.location}>Create container</button>
          </div>
        </div>
      </div>
    </div>
  )
}
