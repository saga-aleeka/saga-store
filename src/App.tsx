import React, {useEffect, useState} from 'react'
import Header from './components/HeaderBar'
import ContainerFilters from './components/ContainerFilters'
import ContainerCard from './components/ContainerCard'
import AdminDashboard from './components/AdminDashboard'
import ContainerDetails from './components/ContainerDetails'
import ContainerCreateDrawer from './components/ContainerCreateDrawer'
import LoginModal from './components/LoginModal'
import { supabase } from './lib/api'
import { getUser } from './lib/auth'

// Allow disabling the login modal in dev by setting VITE_DISABLE_AUTH=true in .env.local
const _rawDisable = (import.meta as any).env?.VITE_DISABLE_AUTH ?? (import.meta as any).VITE_DISABLE_AUTH
const _mode = (import.meta as any).env?.MODE ?? (import.meta as any).MODE ?? 'development'
const explicitDisable = (_rawDisable === '1' || String(_rawDisable || '').toLowerCase() === 'true')
// Default to disabling auth in local development for convenience
const DISABLE_AUTH = explicitDisable || String(_mode) === 'development'

export default function App() {
  const [route, setRoute] = useState<string>(window.location.hash || '#/containers')
  const initialUser = getUser() ?? (DISABLE_AUTH ? { initials: 'DEV', name: 'Developer' } : null)
  const [user, setUser] = useState<any | null>(initialUser)

  useEffect(() => {
    if (!DISABLE_AUTH) setUser(getUser())
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
  // filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [availableOnly, setAvailableOnly] = useState(false)
  const [trainingOnly, setTrainingOnly] = useState(false)

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
        const { data, error } = await supabase
          .from('containers')
          .select('*')
          .eq('archived', false)
          .order('updated_at', { ascending: false })
        
        if (!mounted) return
        if (error) throw error
        setContainers(data ?? [])
      }catch(e){
        console.warn('failed to load containers', e)
        if (mounted) setContainers([])
      }finally{ if (mounted) setLoadingContainers(false) }
    }

    if (route === '#/containers') load()
    return () => { mounted = false }
  }, [route])

  // apply filters client-side to containers list
  const filteredContainers = React.useMemo(() => {
    if (!containers) return []
    return containers.filter((c:any) => {
      // sample type filter (if any selected)
      if (selectedTypes && selectedTypes.length){
        if (!selectedTypes.includes(c.type)) return false
      }
      // available only
      if (availableOnly){
        const used = Number(c.used || 0)
        const total = Number(c.total || 0)
        if ((total - used) <= 0) return false
      }
      // training only
      if (trainingOnly){
        if (!c.training) return false
      }
      return true
    })
  }, [containers, selectedTypes, availableOnly, trainingOnly])

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
    async function load(){
      setLoadingArchived(true)
      try{
        const { data, error } = await supabase
          .from('containers')
          .select('*')
          .eq('archived', true)
          .order('updated_at', { ascending: false })
        
        if (!mounted) return
        if (error) throw error
        setArchivedContainers(data ?? [])
      }catch(e){
        console.warn('failed to load archived', e)
        if (mounted) setArchivedContainers([])
      }finally{ if (mounted) setLoadingArchived(false) }
    }

    if (route === '#/archive') load()
    return () => { mounted = false }
  }, [route])

  useEffect(() => {
    // load samples when on samples route
    let mounted = true
    async function loadSamples(){
      setLoadingSamples(true)
      try{
        const { data, error } = await supabase
          .from('samples')
          .select('*')
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
        
        if (!mounted) return
        if (error) throw error
        setSamples(data ?? [])
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
  <Header route={route} user={user} onSignOut={signOut} isAdmin={route === '#/admin'} onExitAdmin={() => { window.location.hash = '#/containers' }} />

      {!user && (
        <LoginModal onSuccess={(u:any) => setUser(u)} />
      )}

      <div style={{marginTop:18}}>
        {route === '#/containers' && (
          <>
            <div className="muted">Showing {filteredContainers ? filteredContainers.length : '...'} active containers</div>
            {/* Filters */}
            <div style={{marginTop:8}}>
              <ContainerFilters selected={selectedTypes} onChange={(s:any)=> setSelectedTypes(s)} availableOnly={availableOnly} onAvailableChange={setAvailableOnly} trainingOnly={trainingOnly} onTrainingChange={setTrainingOnly} />
            </div>
            <div className="container-list">
              {loadingContainers && <div className="muted">Loading containers...</div>}
              {!loadingContainers && filteredContainers && filteredContainers.length === 0 && <div className="muted">No active containers</div>}
              {!loadingContainers && filteredContainers && filteredContainers.map(c => (
                <ContainerCard key={c.id} id={c.id} name={c.name} type={c.type} temperature={c.temperature} layout={c.layout} occupancy={{used:c.used,total:c.total}} updatedAt={c.updated_at} location={c.location} training={c.training} />
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
