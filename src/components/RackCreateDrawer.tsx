import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/api'

export default function RackCreateDrawer({
  onClose,
  initialColdStorageId
}: {
  onClose: () => void
  initialColdStorageId?: string
}){
  const nameRef = useRef<HTMLInputElement | null>(null)
  const [form, setForm] = useState({
    name: '',
    position: '',
    cold_storage_id: initialColdStorageId || '',
    grid_rows: '',
    grid_cols: ''
  })
  const [errors, setErrors] = useState<{ name?: string; cold_storage_id?: string }>({})
  const [saving, setSaving] = useState(false)
  const [coldStorageOptions, setColdStorageOptions] = useState<any[]>([])
  const [loadingStorage, setLoadingStorage] = useState(false)

  useEffect(() => {
    let mounted = true
    async function loadStorage() {
      setLoadingStorage(true)
      try {
        const { data } = await supabase
          .from('cold_storage_units')
          .select('id, name, temperature')
          .order('name', { ascending: true })
        if (!mounted) return
        setColdStorageOptions(data || [])
        if (!form.cold_storage_id && data?.[0]?.id) {
          setForm((prev) => ({ ...prev, cold_storage_id: data[0].id }))
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

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleCreate = async () => {
    const nextErrors: any = {}
    if (!form.name.trim()) nextErrors.name = 'Rack name is required'
    if (!form.cold_storage_id) nextErrors.cold_storage_id = 'Cold storage is required'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      if (nextErrors.name) nameRef.current?.focus()
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        position: form.position.trim() || null,
        cold_storage_id: form.cold_storage_id,
        grid_rows: form.grid_rows ? parseInt(form.grid_rows, 10) : null,
        grid_cols: form.grid_cols ? parseInt(form.grid_cols, 10) : null
      }
      const { data, error } = await supabase
        .from('racks')
        .insert([payload])
        .select()
        .single()
      if (error) throw error
      window.location.hash = `#/racks/${data.id}`
    } catch (e: any) {
      console.error('Failed to create rack', e)
      alert(`Failed to create rack: ${e?.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Create Rack</h3>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <label>
            Rack Name
            <input
              ref={nameRef}
              value={form.name}
              onChange={(e) => { updateField('name', e.target.value); setErrors((s) => ({ ...s, name: undefined })) }}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'error-rack-name' : undefined}
              placeholder="e.g., Rack A"
            />
            {errors.name ? <div id="error-rack-name" style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{errors.name}</div> : null}
          </label>

          <label>
            Cold Storage
            <select
              value={form.cold_storage_id}
              onChange={(e) => { updateField('cold_storage_id', e.target.value); setErrors((s) => ({ ...s, cold_storage_id: undefined })) }}
              disabled={loadingStorage}
              aria-invalid={!!errors.cold_storage_id}
              aria-describedby={errors.cold_storage_id ? 'error-rack-storage' : undefined}
            >
              <option value="">Select cold storage</option>
              {coldStorageOptions.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} {unit.temperature ? `(${unit.temperature})` : ''}
                </option>
              ))}
            </select>
            {errors.cold_storage_id ? <div id="error-rack-storage" style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{errors.cold_storage_id}</div> : null}
          </label>

          <label>
            Position (optional)
            <input
              value={form.position}
              onChange={(e) => updateField('position', e.target.value)}
              placeholder="e.g., Top row"
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label>
              Grid Rows (optional)
              <input
                type="number"
                min={1}
                value={form.grid_rows}
                onChange={(e) => updateField('grid_rows', e.target.value)}
              />
            </label>
            <label>
              Grid Cols (optional)
              <input
                type="number"
                min={1}
                value={form.grid_cols}
                onChange={(e) => updateField('grid_cols', e.target.value)}
              />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating...' : 'Create Rack'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
