import React, {useState} from 'react'
import ContainerEditDrawer from './ContainerEditDrawer'
import { getApiUrl } from '../lib/api'

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
    <div className="container-card" role="button" tabIndex={0} onClick={() => { window.location.hash = `#/containers/${id}` }} onKeyDown={(e) => { if (e.key === 'Enter') window.location.hash = `#/containers/${id}` }}>
      <div className="meta">
        <div>
          <div style={{display:'flex',alignItems:'baseline',gap:8}}>
            <div className="container-title">{name ?? id}</div>
            <div className="muted" style={{fontSize:13}}>ID: {id}</div>
          </div>
          <div className="meta-small">{type} • {layout}</div>
          <div className="meta-small">Location: {rest.location ?? ''}</div>
        </div>
        <div style={{textAlign:'right', display:'flex', alignItems:'center', gap:8}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end'}}>
            <div className="badge">{temperature}</div>
            <div style={{height:8}} />
            <div className="badge" style={{marginTop:6}}>{layout}</div>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:8}} onClick={(e)=> e.stopPropagation()}>
            <button className="card-action" aria-label="archive" title="Archive" onClick={async () => {
              // toggle archived state
              try{
                await fetch(getApiUrl(`/api/containers/${id}`), { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ archived: true }) })
                window.dispatchEvent(new CustomEvent('container-updated'))
              }catch(e){ console.warn(e) }
            }}>Archive</button>
            <button className="card-menu" aria-label="open menu" onClick={() => setOpenEdit(true)}>⋮</button>
          </div>
        </div>
      </div>

      <div className="occupancy">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div className="muted">Capacity</div>
          <div className="badge">{occupancy.used}/{occupancy.total} • {available} available</div>
        </div>
        <div className="bar" style={{marginTop:8}}>
          <div className="fill" style={{width:`${pct}%`}}></div>
        </div>
      </div>

      <div className="meta-small">Sample type: {type}</div>
      <div className="meta-small">Last updated: {updatedAt ?? new Date().toLocaleString()}</div>
    </div>
    {openEdit && <ContainerEditDrawer container={{id,name,type,temperature,layout,used:occupancy.used,total:occupancy.total,updated_at:updatedAt}} onClose={() => setOpenEdit(false)} />}
    </>
  )
}
