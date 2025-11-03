import React, {useEffect, useState} from 'react'
import ContainerCard from './ContainerCard'
import { getApiUrl } from '../lib/api'

export default function ContainerDetails({ id }: { id: string | number }){
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load(){
      setLoading(true)
      try{
  const res = await fetch(getApiUrl(`/api/containers/${encodeURIComponent(String(id))}`))
        if (!res.ok) throw new Error('not found')
        const j = await res.json()
        if (!mounted) return
        setData(j.data ?? j)
      }catch(e){
        console.warn('failed to load container', e)
        if (mounted) setData(null)
      }finally{ if (mounted) setLoading(false) }
    }
    load()
    return () => { mounted = false }
  }, [id])

  if (loading) return <div className="muted">Loading container...</div>
  if (!data) return <div className="muted">Container not found</div>

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
        <div>
          <h2 style={{margin:0}}>{data.name}</h2>
          <div className="muted">Location: {data.location}</div>
          <div className="muted">ID: {data.id} • {data.type} • {data.layout}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn ghost" onClick={() => { window.location.hash = '#/containers' }}>Back</button>
          <button className="btn">Edit</button>
        </div>
      </div>

      <div style={{marginTop:12}}>
        <ContainerCard id={data.id} name={data.name} type={data.type} temperature={data.temperature} layout={data.layout} occupancy={{used:data.used,total:data.total}} updatedAt={data.updated_at} />
      </div>

      <div style={{marginTop:18}}>
        <h3>Samples in this container</h3>
        {(!data.samples || data.samples.length === 0) && <div className="muted">No samples in this container</div>}
        {data.samples && data.samples.map((s:any) => (
          <div key={s.id} className="sample-row" style={{marginTop:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:40,height:40,flex:'none',borderRadius:6,background:'#eee',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>
                {s.owner ? s.owner[0].toUpperCase() : s.id.slice(-2)}
              </div>
              <div>
                <div style={{fontWeight:700}}>{s.id} • {s.position}</div>
                <div className="muted">Status: {s.status} • Owner: {s.owner} • Collected: {s.collected_at}</div>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn ghost" onClick={async () => {
                const target = prompt('Move sample to container id:')
                if (!target) return
                try{
                  await fetch(getApiUrl(`/api/samples/${s.id}/move`), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ target_container_id: Number(target) }) })
                  // reload container detail to show change
                  window.location.hash = '#/containers/' + data.id
                }catch(e){ console.warn(e) }
              }}>Move</button>
              <button className="btn" onClick={async () => {
                try{
                  await fetch(getApiUrl(`/api/samples/${s.id}`), { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: 'archived' }) })
                  window.location.hash = '#/containers/' + data.id
                }catch(e){ console.warn(e) }
              }}>Archive</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
