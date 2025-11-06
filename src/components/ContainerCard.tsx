import React, { useState } from 'react'
import ContainerEditDrawer from './ContainerEditDrawer'
import { getApiUrl } from '../lib/api'

function TypeBadge({ type }: { type?: string }){
  const map: Record<string,string> = {
    'PA Pools': '#fb923c',
    'DP Pools': '#10b981',
    'cfDNA Tubes': '#9ca3af',
    'DTC Tubes': '#7c3aed',
    'MNC Tubes': '#ef4444',
    'Plasma Tubes': '#f59e0b',
    'BC Tubes': '#3b82f6',
    'IDT Plates': '#06b6d4'
  }
  const color = map[type ?? ''] ?? '#94a3b8'
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ background: `${color}22`, color }}>
      {type}
    </span>
  )
}

type Props = {
  id?: string | number
  name?: string
  type?: string
  temperature?: string
  layout?: string
  occupancy?: { used:number; total:number }
  updatedAt?: string
}

export default function ContainerCard({id=1,name, type='Sample Type', temperature='-80°C', layout='9x9', occupancy = {used:0,total:80}, updatedAt, ...rest}: Props & any){
  const pct = Math.round((occupancy.used / Math.max(1, occupancy.total)) * 100)
  const available = Math.max(0, (occupancy.total - occupancy.used))
  const [openEdit, setOpenEdit] = useState(false)
  return (
    <>
    <div className="container-card rounded-lg p-4 bg-white shadow-sm" role="button" tabIndex={0} onClick={() => { window.location.hash = `#/containers/${id}` }} onKeyDown={(e) => { if (e.key === 'Enter') window.location.hash = `#/containers/${id}` }}>
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <div className="flex items-baseline gap-3">
            <div className="text-lg font-semibold truncate">{name ?? id}</div>
            <div className="text-sm text-gray-500">ID: {id}</div>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="text-sm text-gray-600 truncate">{rest.location ?? ''}</div>
            <div>
              <TypeBadge type={type} />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex items-center gap-2">
            <span className="px-2 py-1 text-xs bg-gray-100 rounded font-medium">{temperature}</span>
            <span className="px-2 py-1 text-xs bg-gray-100 rounded">{layout}</span>
          </div>
          <div className="flex items-center gap-2" onClick={(e)=> e.stopPropagation()}>
            <button className="card-action" aria-label="archive" title="Archive" onClick={async () => {
              try{
                await fetch(getApiUrl(`/api/containers/${id}`), { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ archived: true }) })
                window.dispatchEvent(new CustomEvent('container-updated'))
              }catch(e){ console.warn(e) }
            }}>Archive</button>
            <button className="card-menu" aria-label="open menu" onClick={() => setOpenEdit(true)}>⋮</button>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between">
    <div className="text-sm text-gray-500">Sample type: {type}</div>
          <div className="text-sm">
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-sm font-medium">{occupancy.used}/{occupancy.total}</span>
            <span className="ml-2 text-sm text-gray-500">{available} available</span>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2 mt-2 overflow-hidden">
          <div className="h-2 bg-blue-500" style={{width: `${pct}%`}} />
        </div>
      </div>

      <div className="mt-3 text-sm text-gray-500">Last updated: {updatedAt ?? new Date().toLocaleString()}</div>
    </div>
    {openEdit && <ContainerEditDrawer container={{id,name,type,temperature,layout,used:occupancy.used,total:occupancy.total,updated_at:updatedAt}} onClose={() => setOpenEdit(false)} />}
    </>
  )
}
