import React, {useEffect, useState} from 'react'
import Header from './components/HeaderBar'
import ContainerFilters from './components/ContainerFilters'
import ContainerCard from './components/ContainerCard'
import AdminDashboard from './components/AdminDashboard'
import ContainerDetails from './components/ContainerDetails'
import ContainerCreateDrawer from './components/ContainerCreateDrawer'
import LoginModal from './components/LoginModal'
import WorklistManager from './components/WorklistManager'
import WorklistContainerView from './components/WorklistContainerView'
import { supabase } from './lib/api'
import { getUser } from './lib/auth'
import { formatDateTime, formatDate } from './lib/dateUtils'

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

  // Load counts for badges on mount and when route changes
  useEffect(() => {
    let mounted = true
    
    // Load active containers count
    async function loadContainersCount() {
      try {
        const { count, error } = await supabase
          .from('containers')
          .select('*', { count: 'exact', head: true })
          .eq('archived', false)
        
        if (!mounted) return
        if (error) throw error
        if (!containers) setContainers(new Array(count || 0))
      } catch(e) {
        console.warn('failed to load containers count', e)
      }
    }
    
    // Load archived containers count
    async function loadArchivedCount() {
      try {
        const { count, error } = await supabase
          .from('containers')
          .select('*', { count: 'exact', head: true })
          .eq('archived', true)
        
        if (!mounted) return
        if (error) throw error
        if (!archivedContainers) setArchivedContainers(new Array(count || 0))
      } catch(e) {
        console.warn('failed to load archived count', e)
      }
    }
    
    // Load samples count
    async function loadSamplesCount() {
      try {
        const { count, error } = await supabase
          .from('samples')
          .select('*', { count: 'exact', head: true })
          .eq('is_archived', false)
        
        if (!mounted) return
        if (error) throw error
        if (!samples) setSamples(new Array(count || 0))
      } catch(e) {
        console.warn('failed to load samples count', e)
      }
    }
    
    loadContainersCount()
    loadArchivedCount()
    loadSamplesCount()
    
    return () => { mounted = false }
  }, [route])

  useEffect(() => {
    // load containers when on containers route
    let mounted = true
    async function load(){
      setLoadingContainers(true)
      try{
        const { data, error } = await supabase
          .from('containers')
          .select('*, samples(id, is_archived)')
          .eq('archived', false)
          .order('updated_at', { ascending: false })
        
        if (!mounted) return
        if (error) throw error
        
        // Count active samples for each container
        const containersWithCounts = (data ?? []).map((c: any) => ({
          ...c,
          used: (c.samples || []).filter((s: any) => !s.is_archived).length
        }))
        
        setContainers(containersWithCounts)
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
    async function onUpdated(e: any){
      // refresh both lists when a container is updated (might be archived/unarchived)
      try {
        const [activeRes, archivedRes] = await Promise.all([
          supabase
            .from('containers')
            .select('*, samples(id, is_archived)')
            .eq('archived', false)
            .order('updated_at', { ascending: false }),
          supabase
            .from('containers')
            .select('*, samples(id, is_archived)')
            .eq('archived', true)
            .order('updated_at', { ascending: false })
        ])
        
        if (activeRes.data) {
          const containersWithCounts = activeRes.data.map((c: any) => ({
            ...c,
            used: (c.samples || []).filter((s: any) => !s.is_archived).length
          }))
          setContainers(containersWithCounts)
        }
        
        if (archivedRes.data) {
          const containersWithCounts = archivedRes.data.map((c: any) => ({
            ...c,
            used: (c.samples || []).filter((s: any) => !s.is_archived).length
          }))
          setArchivedContainers(containersWithCounts)
        }
      } catch(e) {
        console.warn('Failed to refresh containers after update', e)
      }
    }
    window.addEventListener('container-updated', onUpdated)
    return () => window.removeEventListener('container-updated', onUpdated)
  }, [])

  useEffect(() => {
    // load archived containers when on archive route
    let mounted = true
    async function load(){
      setLoadingArchived(true)
      try{
        const { data, error } = await supabase
          .from('containers')
          .select('*, samples(id, is_archived)')
          .eq('archived', true)
          .order('updated_at', { ascending: false })
        
        if (!mounted) return
        if (error) throw error
        
        // Count active samples for each container
        const containersWithCounts = (data ?? []).map((c: any) => ({
          ...c,
          used: (c.samples || []).filter((s: any) => !s.is_archived).length
        }))
        
        setArchivedContainers(containersWithCounts)
      }catch(e){
        console.warn('failed to load archived', e)
        if (mounted) setArchivedContainers([])
      }finally{ if (mounted) setLoadingArchived(false) }
    }

    if (route === '#/archive') load()
    return () => { mounted = false }
  }, [route])

  useEffect(() => {
    // load samples when on samples route or archive route
    let mounted = true
    async function loadSamples(){
      setLoadingSamples(true)
      try{
        const isArchiveRoute = route === '#/archive'
        const { data, error } = await supabase
          .from('samples')
          .select('*, containers(name, location)')
          .eq('is_archived', isArchiveRoute ? true : false)
          .order('created_at', { ascending: false })
        
        if (!mounted) return
        if (error) throw error
        setSamples(data ?? [])
      }catch(e){
        console.warn('failed to load samples', e)
        if (mounted) setSamples([])
      }finally{ if (mounted) setLoadingSamples(false) }
    }

    if (route === '#/samples' || route === '#/archive') loadSamples()
    return () => { mounted = false }
  }, [route])

  // worklist container view route: #/worklist/container/:id
  if (route.startsWith('#/worklist/container/') && route.split('/').length >= 4) {
    const parts = route.split('/')
    const idWithQuery = decodeURIComponent(parts[3])
    const id = idWithQuery.split('?')[0]
    
    // Parse positions from query string
    const positionsMatch = route.match(/[?&]positions=([^&]+)/)
    const positions = positionsMatch 
      ? decodeURIComponent(positionsMatch[1]).split(',')
      : []

    return (
      <div className="app">
        <Header route="#/worklist" user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samples?.length ?? 0} />
        <div style={{marginTop:18}}>
          <WorklistContainerView 
            containerId={id} 
            highlightPositions={positions}
            onBack={() => { window.location.hash = '#/worklist' }}
          />
        </div>
      </div>
    )
  }

  // container detail route: #/containers/:id
  if (route.startsWith('#/containers/') && route.split('/').length >= 3) {
    const parts = route.split('/')
    const idWithQuery = decodeURIComponent(parts[2])
    const id = idWithQuery.split('?')[0]
    return (
      <div className="app">
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samples?.length ?? 0} />
        <div style={{marginTop:18}}>
          <ContainerDetails id={id} />
        </div>
      </div>
    )
  }

  if (route === '#/new'){
    return (
      <div className="app">
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samples?.length ?? 0} />
        <div style={{marginTop:18}}>
          <ContainerCreateDrawer onClose={() => { window.location.hash = '#/containers' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="app">
  <Header route={route} user={user} onSignOut={signOut} isAdmin={route === '#/admin'} onExitAdmin={() => { window.location.hash = '#/containers' }} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samples?.length ?? 0} />

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
                <ContainerCard key={c.id} id={c.id} name={c.name} type={c.type} temperature={c.temperature} layout={c.layout} occupancy={{used:c.used,total:c.total}} updatedAt={c.updated_at} location={c.location} training={c.training} archived={c.archived} />
              ))}
            </div>
            
            <div style={{marginTop:32,paddingTop:24,borderTop:'1px solid #e5e7eb'}}>
              <h3 style={{fontSize:18,fontWeight:600,marginBottom:12}}>Archived Samples</h3>
              <div className="muted" style={{marginBottom:12}}>Samples marked as archived</div>
              {loadingSamples && <div className="muted">Loading archived samples...</div>}
              {!loadingSamples && (
                <div>
                  {samples && samples.filter((s: any) => s.is_archived).length === 0 && (
                    <div className="muted">No archived samples</div>
                  )}
                  {samples && samples.filter((s: any) => s.is_archived).map((s:any) => {
                    const handleSampleClick = async () => {
                      window.location.hash = `#/containers/${s.container_id}?highlight=${encodeURIComponent(s.position)}`
                    }
                    
                    const containerName = s.containers?.name || s.container_id
                    const containerLocation = s.containers?.location || 'Location unknown'
                    
                    return (
                      <div key={s.id} className="sample-row" style={{marginTop:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div style={{display:'flex',gap:12,alignItems:'center',flex:1}}>
                          <div style={{width:36,height:36,flex:'none',borderRadius:6,background:'#eee',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12}}>{s.owner ? s.owner[0].toUpperCase() : (s.sample_id || s.id).slice(-2)}</div>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:14}}>{s.sample_id}</div>
                            <div style={{marginTop:4}}>
                              <button
                                onClick={handleSampleClick}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 10px',
                                  background: '#fef3c7',
                                  border: '1px solid #fde68a',
                                  borderRadius: 6,
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  color: '#92400e'
                                }}
                              >
                                {containerName} • {s.position}
                              </button>
                            </div>
                            {s.data?.collected_at && (
                              <div className="muted" style={{marginTop:4}}>Collected: {formatDate(s.data.collected_at)}</div>
                            )}
                          </div>
                        </div>
                        <div className="muted" style={{fontSize:13}}>Archived {formatDateTime(s.updated_at)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {route === '#/samples' && (
          <div>
            <div className="muted">Showing {samples ? samples.length : '...'} samples</div>
            <div style={{marginTop:12}}>
              {loadingSamples && <div className="muted">Loading samples...</div>}
              {!loadingSamples && samples && samples.length === 0 && <div className="muted">No samples</div>}
              {!loadingSamples && samples && samples.map((s:any) => {
                const handleSampleClick = async () => {
                  // Navigate to container detail with highlighted sample
                  window.location.hash = `#/containers/${s.container_id}?highlight=${encodeURIComponent(s.position)}`
                }
                
                const containerName = s.containers?.name || s.container_id
                const containerLocation = s.containers?.location || 'Location unknown'
                
                return (
                  <div key={s.id} className="sample-row" style={{marginTop:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{display:'flex',gap:12,alignItems:'center',flex:1}}>
                      <div style={{width:36,height:36,flex:'none',borderRadius:6,background:'#eee',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12}}>{s.owner ? s.owner[0].toUpperCase() : (s.sample_id || s.id).slice(-2)}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:14}}>{s.sample_id}</div>
                        <div style={{marginTop:4}}>
                          <button
                            onClick={handleSampleClick}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 10px',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#1e40af',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = '#dbeafe'
                              e.currentTarget.style.borderColor = '#93c5fd'
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = '#eff6ff'
                              e.currentTarget.style.borderColor = '#bfdbfe'
                            }}
                            title="Click to view in container grid"
                          >
                            <span>📦</span>
                            <span>{containerName}</span>
                            <span style={{color:'#60a5fa'}}>•</span>
                            <span>{s.position}</span>
                            <span style={{color:'#60a5fa'}}>•</span>
                            <span style={{fontSize:11,color:'#3b82f6'}}>{containerLocation}</span>
                          </button>
                        </div>
                        <div className="muted" style={{marginTop:4,fontSize:12}}>Owner: {s.owner || 'N/A'} • Collected: {formatDate(s.collected_at)}</div>
                      </div>
                    </div>
                    <div className="muted" style={{fontSize:12,whiteSpace:'nowrap'}}>{formatDateTime(s.updated_at)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {route === '#/admin' && (
          <AdminDashboard />
        )}

        {route === '#/worklist' && (
          <WorklistManager />
        )}
      </div>
    </div>
  )
}
