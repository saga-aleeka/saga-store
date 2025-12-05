import React, { useState } from 'react'
import ContainerEditDrawer from './ContainerEditDrawer'
import { getApiUrl } from '../lib/api'
import { formatDateTime } from '../lib/dateUtils'

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
  isFavorite?: boolean
  onToggleFavorite?: () => void
  training?: boolean
}

export default function ContainerCard({id=1,name, type='Sample Type', temperature='-80°C', layout='9x9', occupancy = {used:0,total:80}, updatedAt, isFavorite = false, onToggleFavorite, ...rest}: Props & any){
  // DP Pools 9x9 have I9 unavailable, so effective capacity is 80 not 81
  let effectiveTotal = occupancy.total
  if (type === 'DP Pools' && layout === '9x9' && occupancy.total === 81) {
    effectiveTotal = 80
  }
  
  const pct = Math.round((occupancy.used / Math.max(1, effectiveTotal)) * 100)
  const available = Math.max(0, (effectiveTotal - occupancy.used))
  const [openEdit, setOpenEdit] = useState(false)
  
  return (
    <>
    <div className="container-card rounded-lg p-4 bg-white shadow-sm" role="button" tabIndex={0} onClick={() => { window.location.hash = `#/containers/${id}` }} onKeyDown={(e) => { if (e.key === 'Enter') window.location.hash = `#/containers/${id}` }}>
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            {isFavorite && (
              <span style={{fontSize: 18, lineHeight: 1}} title="Favorited">⭐</span>
            )}
            <div className="text-base font-semibold whitespace-nowrap">{name ?? 'Unnamed Container'}</div>
            <div className="flex-shrink-0">
              <TypeBadge type={type} />
            </div>
            <span className="px-2 py-1 text-xs bg-gray-100 rounded font-medium whitespace-nowrap">{temperature}</span>
            <span className="px-2 py-1 text-xs bg-gray-100 rounded whitespace-nowrap">{layout}</span>
            {rest.training && (
              <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded font-medium whitespace-nowrap">🎓 Training</span>
            )}
          </div>
          <div className="text-sm text-gray-600 mt-1">{rest.location ?? ''}</div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="flex items-center gap-2" onClick={(e)=> e.stopPropagation()}>
            {onToggleFavorite && (
              <button 
                className="card-menu" 
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite()
                }}
                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                {isFavorite ? '★' : '☆'}
              </button>
            )}
            <button className="card-menu" aria-label="open menu" onClick={() => setOpenEdit(true)}>⋮</button>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm flex-shrink-0">
            <span 
              className="px-2 py-0.5 rounded text-sm font-medium whitespace-nowrap"
              style={{
                background: pct >= 100 ? '#fee2e2' : pct >= 80 ? '#fef3c7' : '#dbeafe',
                color: pct >= 100 ? '#991b1b' : pct >= 80 ? '#92400e' : '#1e40af'
              }}
            >
              {occupancy.used}/{effectiveTotal}
            </span>
            <span className="ml-2 text-sm text-gray-500 whitespace-nowrap">{available} available</span>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2 mt-2 overflow-hidden">
          <div 
            className="h-2"
            style={{
              width: `${Math.min(pct, 100)}%`,
              background: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#3b82f6'
            }} 
          />
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-400">Updated {formatDateTime(updatedAt)}</div>
    </div>
    {openEdit && <ContainerEditDrawer container={{id,name,type,temperature,layout,used:occupancy.used,total:occupancy.total,updated_at:updatedAt,archived:rest.archived,location:rest.location,training:rest.training}} onClose={() => setOpenEdit(false)} />}
    </>
  )
}
