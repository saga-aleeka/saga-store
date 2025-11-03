import React, {useEffect, useState} from 'react'
import Header from './components/HeaderBar'
import ContainerCard from './components/ContainerCard'
import AdminDashboard from './components/AdminDashboard'
import ContainerDetails from './components/ContainerDetails'
import ContainerCreateDrawer from './components/ContainerCreateDrawer'
import LoginModal from './components/LoginModal'
import { getApiUrl } from './lib/api'
import { getUser } from './lib/auth'

export default function App() {
  const [route, setRoute] = useState<string>(window.location.hash || '#/containers')
  const [user, setUser] = useState<any | null>(getUser())

  useEffect(() => {
    setUser(getUser())
  }, [])

  function signOut(){
    try{ const { clearToken, setUser: setUserStorage } = require('./lib/auth') as any; clearToken(); setUserStorage(null) }catch{}
    setUser(null)
  }

  const [containers, setContainers] = useState<any[] | null>(null)
  const [loadingContainers, setLoadingContainers] = useState(false)
  const [archivedContainers, setArchivedContainers] = useState<any[] | null>(null)
  const [loadingArchived, setLoadingArchived] = useState(false)
  const [samples, setSamples] = useState<any[] | null>(null)
  const [loadingSamples, setLoadingSamples] = useState(false)

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || '#/containers')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    // load containers when on containers route
    let mounted = true
    async function load(){
      setLoadingContainers(true)
      try{
  const res = await fetch(getApiUrl('/api/containers'))
        const j = await res.json()
        if (!mounted) return
        setContainers(j.data ?? j)
      }catch(e){
        console.warn('failed to load containers', e)
        if (mounted) setContainers([])
      }finally{ if (mounted) setLoadingContainers(false) }
    }

    if (route === '#/containers') load()
    return () => { mounted = false }
  }, [route])

  useEffect(() => {
    function onUpdated(e: any){
      // refresh lists when a container is updated
      if (route === '#/containers'){
  fetch(getApiUrl('/api/containers')).then(r=>r.json()).then(j=>setContainers(j.data ?? j))
      }
      if (route === '#/archive'){
  fetch(getApiUrl('/api/containers?archived=true')).then(r=>r.json()).then(j=>setArchivedContainers(j.data ?? j))
      }
    }
    window.addEventListener('container-updated', onUpdated)
    return () => window.removeEventListener('container-updated', onUpdated)
  }, [route])

  useEffect(() => {
    // load archived containers when on archive route
    let mounted = true
    async function loadArchived(){
      setLoadingArchived(true)
      try{
  const res = await fetch(getApiUrl('/api/containers?archived=true'))
        const j = await res.json()
        if (!mounted) return
        setArchivedContainers(j.data ?? j)
      }catch(e){
        console.warn('failed to load archived containers', e)
        if (mounted) setArchivedContainers([])
      }finally{ if (mounted) setLoadingArchived(false) }
    }

    if (route === '#/archive') loadArchived()
    return () => { mounted = false }
  }, [route])

  useEffect(() => {
    // load samples when on samples route
    let mounted = true
    async function loadSamples(){
      setLoadingSamples(true)
      try{
  const res = await fetch(getApiUrl('/api/samples'))
        const j = await res.json()
        if (!mounted) return
        setSamples(j.data ?? j)
      }catch(e){
        console.warn('failed to load samples', e)
        if (mounted) setSamples([])
      }finally{ if (mounted) setLoadingSamples(false) }
    }

    if (route === '#/samples') loadSamples()
    return () => { mounted = false }
  }, [route])

  // container detail route: #/containers/:id
  if (route.startsWith('#/containers/') && route.split('/').length >= 3) {
    const parts = route.split('/')
    const id = decodeURIComponent(parts[2])
    return (
      <div className="app">
        <Header route={route} />
        <div style={{marginTop:18}}>
          <ContainerDetails id={id} />
        </div>
      </div>
    )
  }

  if (route === '#/new'){
    return (
      <div className="app">
        <Header route={route} />
        <div style={{marginTop:18}}>
          <ContainerCreateDrawer onClose={() => { window.location.hash = '#/containers' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="app">
  <Header route={route} user={user} onSignOut={signOut} />

      {!user && (
        <LoginModal onSuccess={(u:any) => setUser(u)} />
      )}

      <div style={{marginTop:18}}>
        {route === '#/containers' && (
          <>
            <div className="muted">Showing {containers ? containers.length : '...'} active containers</div>
            <div className="container-list">
              {loadingContainers && <div className="muted">Loading containers...</div>}
              {!loadingContainers && containers && containers.length === 0 && <div className="muted">No active containers</div>}
              {!loadingContainers && containers && containers.map(c => (
                <ContainerCard key={c.id} id={c.id} name={c.name} type={c.type} temperature={c.temperature} layout={c.layout} occupancy={{used:c.used,total:c.total}} updatedAt={c.updated_at} />
              ))}
            </div>
          </>
        )}

        {route === '#/archive' && (
          <>
            <div className="muted">Showing {archivedContainers ? archivedContainers.length : '...'} archived containers</div>
            <div className="container-list">
              {loadingArchived && <div className="muted">Loading archived containers...</div>}
              {!loadingArchived && archivedContainers && archivedContainers.length === 0 && <div className="muted">No archived containers</div>}
              {!loadingArchived && archivedContainers && archivedContainers.map((c:any) => (
                <ContainerCard key={c.id} id={c.id} name={c.name} type={c.type} temperature={c.temperature} layout={c.layout} occupancy={{used:c.used,total:c.total}} updatedAt={c.updated_at} />
              ))}
            </div>
          </>
        )}

        {route === '#/samples' && (
          <div>
            <div className="muted">Showing {samples ? samples.length : '...'} samples</div>
            <div style={{marginTop:12}}>
              {loadingSamples && <div className="muted">Loading samples...</div>}
              {!loadingSamples && samples && samples.length === 0 && <div className="muted">No samples</div>}
              {!loadingSamples && samples && samples.map((s:any) => (
                <div key={s.id} className="sample-row" style={{marginTop:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',gap:12,alignItems:'center'}}>
                    <div style={{width:36,height:36,flex:'none',borderRadius:6,background:'#eee',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12}}>{s.owner ? s.owner[0].toUpperCase() : s.id.slice(-2)}</div>
                    <div>
                      <div style={{fontWeight:700}}>{s.id}</div>
                      <div className="muted">Container: {s.container_id} • Pos: {s.position} • {s.status} • Owner: {s.owner}</div>
                    </div>
                  </div>
                  <div className="muted">{s.collected_at ? s.collected_at : new Date(s.updated_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {route === '#/admin' && (
          <AdminDashboard />
        )}
      </div>
    </div>
  )
}
