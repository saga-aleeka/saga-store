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
  
  // Calculate recommended type based on layout
  const getRecommendedType = () => {
    if (form.layout === '9x9') return 'Recommended container type: 9x9 Box'
    if (form.layout === '8x12') return 'Recommended'
    return ''
  }
  
  // Get grid preview dimensions
  const getGridDimensions = () => {
    const [rows, cols] = form.layout.split('x').map((n: string) => parseInt(n))
    return { rows, cols }
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
      <div className="drawer" style={{maxWidth: 400}} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold m-0">Create New Container</h3>
            <p className="text-sm text-gray-600 mt-1">Create a new plasma storage container. Choose the appropriate container type based on your sample requirements.</p>
          </div>
          <button className="text-2xl text-gray-400 hover:text-gray-600 leading-none" onClick={onClose}>×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Container Name</label>
            <input 
              ref={nameRef} 
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-invalid={!!errors.name} 
              aria-describedby={errors.name ? 'error-name' : undefined} 
              value={form.name} 
              onChange={(e) => { updateField('name', e.target.value); setErrors((s)=> ({...s, name: undefined})) }} 
              placeholder="1"
            />
            {errors.name ? <div id="error-name" className="text-red-600 text-xs mt-1">{errors.name}</div> : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input 
              ref={locationRef} 
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-invalid={!!errors.location} 
              aria-describedby={errors.location ? 'error-location' : undefined} 
              value={form.location} 
              onChange={(e) => { updateField('location', e.target.value); setErrors((s)=> ({...s, location: undefined})) }} 
              placeholder="-1"
            />
            {errors.location ? <div id="error-location" className="text-red-600 text-xs mt-1">{errors.location}</div> : null}
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                checked={!!form.archived} 
                onChange={(e)=> updateField('archived', e.target.checked)} 
              />
              <span className="text-sm text-gray-700">Archive Container</span>
            </label>
            <div className="text-xs text-gray-500">Create this container in the archive (for long-term storage)</div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                checked={!!form.training} 
                onChange={(e)=> updateField('training', e.target.checked)} 
              />
              <span className="text-sm text-gray-700">Training Container</span>
            </label>
            <div className="text-xs text-gray-500">Mark this container as a training container (flagged in orange)</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sample Type</label>
            <select 
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.type} 
              onChange={(e)=> updateField('type', e.target.value)}
            >
              {SAMPLE_TYPES.map(s => <option key={s}>{s}</option>)}
            </select>
            {form.layout === '9x9' && (
              <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Recommended container type: 9x9 Box</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Container Type</label>
            <select 
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.layout} 
              onChange={(e)=> updateField('layout', e.target.value)}
            >
              {LAYOUTS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Storage Temperature</label>
            <select 
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.temperature} 
              onChange={(e)=> updateField('temperature', e.target.value)}
            >
              {TEMPS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="border-t pt-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <span>Container Preview</span>
                {form.layout === '9x9' && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                    Recommended
                  </span>
                )}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium">{form.layout} Box</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Grid Size:</span>
                  <span className="font-medium">{form.layout}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Capacity:</span>
                  <span className="font-medium">{form.total} positions</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sample Type:</span>
                  <span className="font-medium">{form.type || 'Sample Type'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Temperature:</span>
                  <span className="font-medium">{form.temperature}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Purpose:</span>
                  <span className="font-medium">{form.training ? 'Training Container' : 'Production Container'}</span>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-gray-600 mb-2">Grid Layout Preview:</div>
                <div className="flex flex-wrap gap-0.5" style={{maxWidth: '100%'}}>
                  {Array.from({length: Math.min(getGridDimensions().rows, 9)}, (_, r) =>
                    Array.from({length: Math.min(getGridDimensions().cols, 9)}, (_, c) => {
                      const pos = `${String.fromCharCode(65 + r)}${c + 1}`
                      const isI9 = pos === 'I9' && form.type === 'DP Pools' && form.layout === '9x9'
                      return (
                        <div
                          key={pos}
                          className={`w-6 h-6 border rounded text-xs flex items-center justify-center ${
                            isI9 ? 'bg-gray-300 border-gray-400 text-gray-500' : 'bg-white border-gray-300'
                          }`}
                          style={{fontSize: '8px'}}
                        >
                          {isI9 ? '×' : ''}
                        </div>
                      )
                    })
                  ).flat()}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button 
              className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors" 
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
              onClick={create} 
              disabled={!form.name || !form.location}
            >
              Create Container
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
