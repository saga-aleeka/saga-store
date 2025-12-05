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
import { ContainerCardSkeleton } from './components/LoadingSkeleton'
import { supabase } from './lib/api'
import { getUser } from './lib/auth'
import { formatDateTime, formatDate } from './lib/dateUtils'
import { SAMPLE_TYPES } from './constants'

// Sample type color mapping (same as ContainerFilters)
const SAMPLE_TYPE_COLORS: { [key: string]: string } = {
  'PA Pools': '#fb923c',
  'DP Pools': '#10b981',
  'cfDNA Tubes': '#9ca3af',
  'DTC Tubes': '#7c3aed',
  'MNC Tubes': '#ef4444',
  'Plasma Tubes': '#f59e0b',
  'BC Tubes': '#3b82f6',
  'IDT Plates': '#06b6d4',
  'Sample Type': '#6b7280'
}

// Compute readable text color (white or black) based on background hex
function readableTextColor(hex: string){
  try{
    const h = hex.replace('#','')
    const r = parseInt(h.substring(0,2),16)/255
    const g = parseInt(h.substring(2,4),16)/255
    const b = parseInt(h.substring(4,6),16)/255
    const Rs = r <= 0.03928 ? r/12.92 : Math.pow((r+0.055)/1.055, 2.4)
    const Gs = g <= 0.03928 ? g/12.92 : Math.pow((g+0.055)/1.055, 2.4)
    const Bs = b <= 0.03928 ? b/12.92 : Math.pow((b+0.055)/1.055, 2.4)
    const lum = 0.2126 * Rs + 0.7152 * Gs + 0.0722 * Bs
    return lum > 0.6 ? '#111827' : '#ffffff'
  }catch(e){ return '#ffffff' }
}

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
  // pagination for samples
  const [samplesPerPage, setSamplesPerPage] = useState(24)
  const [currentPage, setCurrentPage] = useState(1)
  // pagination for containers
  const [containersPerPage, setContainersPerPage] = useState(24)
  const [containersCurrentPage, setContainersCurrentPage] = useState(1)
  // search
  const [searchQuery, setSearchQuery] = useState('')
  // sample type filters for samples page
  const [sampleTypeFilters, setSampleTypeFilters] = useState<string[]>([])

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
    setContainersCurrentPage(1)
  }, [searchQuery])

  // Reset containers page when filters change
  useEffect(() => {
    setContainersCurrentPage(1)
  }, [selectedTypes, availableOnly, trainingOnly])

  // Reset containers page when route changes
  useEffect(() => {
    setContainersCurrentPage(1)
  }, [route])

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
          .select('*, samples!samples_container_id_fkey(*)')
          .eq('archived', false)
          .order('updated_at', { ascending: false })
        
        if (!mounted) return
        if (error) throw error
        
        // Count all samples (including archived) for each container
        const containersWithCounts = (data ?? []).map((c: any) => {
          const sampleCount = (c.samples || []).length
          console.log(`Container ${c.name}: ${sampleCount} samples (including archived)`, c.samples)
          return {
            ...c,
            used: sampleCount
          }
        })
        
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
    let filtered = containers.filter((c:any) => {
      // sample type filter (if any selected)
      if (selectedTypes && selectedTypes.length){
        if (!selectedTypes.includes(c.type)) return false
      }
      // available only
      if (availableOnly){
        const used = Number(c.used || 0)
        let total = Number(c.total || 0)
        
        // DP Pools 9x9 have I9 unavailable, so effective capacity is 80 not 81
        if (c.type === 'DP Pools' && c.layout === '9x9' && total === 81) {
          total = 80
        }
        
        if ((total - used) <= 0) return false
      }
      // training only - show containers marked as training OR containing training samples
      if (trainingOnly){
        const hasTrainingSamples = (c.samples || []).some((s: any) => s.is_training && !s.is_archived)
        if (!c.training && !hasTrainingSamples) return false
      }
      return true
    })
    
    // Apply search filter
    if (searchQuery.trim()) {
      const terms = searchQuery.split(',').map(t => t.trim().toLowerCase()).filter(t => t)
      filtered = filtered.filter((c: any) => {
        const searchText = `${c.id || ''} ${c.name || ''} ${c.location || ''}`.toLowerCase()
        return terms.some(term => searchText.includes(term))
      })
    }
    
    return filtered
  }, [containers, selectedTypes, availableOnly, trainingOnly, searchQuery])

  useEffect(() => {
    async function onUpdated(e: any){
      // refresh both lists when a container is updated (might be archived/unarchived)
      try {
        const [activeRes, archivedRes] = await Promise.all([
          supabase
            .from('containers')
            .select('*, samples!samples_container_id_fkey(*)')
            .eq('archived', false)
            .order('updated_at', { ascending: false }),
          supabase
            .from('containers')
            .select('*, samples!samples_container_id_fkey(*)')
            .eq('archived', true)
            .order('updated_at', { ascending: false })
        ])
        
        if (activeRes.data) {
          const containersWithCounts = activeRes.data.map((c: any) => ({
            ...c,
            used: (c.samples || []).length
          }))
          setContainers(containersWithCounts)
        }
        
        if (archivedRes.data) {
          const containersWithCounts = archivedRes.data.map((c: any) => ({
            ...c,
            used: (c.samples || []).length
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
          .select('*, samples!samples_container_id_fkey(*)')
          .eq('archived', true)
          .order('updated_at', { ascending: false })
        
        if (!mounted) return
        if (error) {
          console.error('Failed to load archived containers:', error)
          throw error
        }
        
        console.log('Loaded archived containers:', data)
        
        // Count all samples (including archived) for each container
        const containersWithCounts = (data ?? []).map((c: any) => ({
          ...c,
          used: (c.samples || []).length
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
          .select(`
            *, 
            containers!samples_container_id_fkey(id, name, location, type),
            previous_containers:containers!samples_previous_container_id_fkey(id, name, location, type)
          `, { count: 'exact' })
          .eq('is_archived', isArchiveRoute ? true : false)
          .order('created_at', { ascending: false })
          .range(0, 999999)
        
        if (!mounted) return
        if (error) throw error
        setSamples(data ?? [])
        setCurrentPage(1) // Reset to first page when reloading
      }catch(e){
        console.warn('failed to load samples', e)
        if (mounted) setSamples([])
      }finally{ if (mounted) setLoadingSamples(false) }
    }

    if (route === '#/samples' || route === '#/archive') loadSamples()
    return () => { mounted = false }
  }, [route])

  // Apply search filter and type filter to samples
  const filteredSamples = React.useMemo(() => {
    if (!samples) return []
    let filtered = samples
    
    // Apply type filter
    if (sampleTypeFilters.length > 0) {
      filtered = filtered.filter((s: any) => {
        // For checked out samples, use previous container type; otherwise use current container type
        const containerType = s.is_checked_out && s.previous_containers?.type
          ? s.previous_containers.type
          : (s.containers?.type || 'Sample Type')
        return sampleTypeFilters.includes(containerType)
      })
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const terms = searchQuery.split(',').map(t => t.trim().toLowerCase()).filter(t => t)
      filtered = filtered.filter((s: any) => {
        const checkedOutText = s.is_checked_out ? 'checked out' : ''
        const searchText = `${s.sample_id || ''} ${s.containers?.name || ''} ${s.containers?.location || ''} ${s.position || ''} ${checkedOutText}`.toLowerCase()
        return terms.some(term => searchText.includes(term))
      })
    }
    
    return filtered
  }, [samples, searchQuery, sampleTypeFilters])

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
        <Header route="#/worklist" user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samples?.length ?? 0} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
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
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samples?.length ?? 0} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div style={{marginTop:18}}>
          <ContainerDetails id={id} />
        </div>
      </div>
    )
  }

  if (route === '#/new'){
    return (
      <div className="app">
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samples?.length ?? 0} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div style={{marginTop:18}}>
          <ContainerCreateDrawer onClose={() => { window.location.hash = '#/containers' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="app">
  <Header route={route} user={user} onSignOut={signOut} isAdmin={route === '#/admin'} onExitAdmin={() => { window.location.hash = '#/containers' }} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samples?.length ?? 0} searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      {!user && (
        <LoginModal onSuccess={(u:any) => setUser(u)} />
      )}

      <div style={{marginTop:18}}>
        {route === '#/containers' && (
          <>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
              <div className="muted">
                Showing {filteredContainers ? `${Math.min((containersCurrentPage - 1) * containersPerPage + 1, filteredContainers.length)}-${Math.min(containersCurrentPage * containersPerPage, filteredContainers.length)} of ${filteredContainers.length}` : '...'} active containers
              </div>
              <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                <span className="muted" style={{fontSize: 13}}>Per page:</span>
                {[24, 48, 96].map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      setContainersPerPage(size)
                      setContainersCurrentPage(1)
                    }}
                    style={{
                      padding: '4px 12px',
                      background: containersPerPage === size ? '#3b82f6' : 'white',
                      color: containersPerPage === size ? 'white' : '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: containersPerPage === size ? 600 : 400
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            {/* Filters */}
            <div style={{marginTop:8}}>
              <ContainerFilters selected={selectedTypes} onChange={(s:any)=> setSelectedTypes(s)} availableOnly={availableOnly} onAvailableChange={setAvailableOnly} trainingOnly={trainingOnly} onTrainingChange={setTrainingOnly} />
            </div>
            <div className="container-list">
              {loadingContainers && [...Array(6)].map((_, i) => <ContainerCardSkeleton key={i} />)}
              {!loadingContainers && filteredContainers && filteredContainers.length === 0 && <div className="muted">No active containers</div>}
              {!loadingContainers && filteredContainers && filteredContainers.slice((containersCurrentPage - 1) * containersPerPage, containersCurrentPage * containersPerPage).map(c => (
                <ContainerCard key={c.id} id={c.id} name={c.name} type={c.type} temperature={c.temperature} layout={c.layout} occupancy={{used:c.used,total:c.total}} updatedAt={c.updated_at} location={c.location} training={c.training} />
              ))}
            </div>
            {!loadingContainers && filteredContainers && filteredContainers.length > containersPerPage && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                marginTop: 16
              }}>
                <button
                  onClick={() => setContainersCurrentPage(p => Math.max(1, p - 1))}
                  disabled={containersCurrentPage === 1}
                  style={{
                    padding: '6px 12px',
                    background: containersCurrentPage === 1 ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: containersCurrentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: containersCurrentPage === 1 ? '#9ca3af' : '#374151'
                  }}
                >
                  Previous
                </button>
                <span className="muted" style={{fontSize: 13}}>
                  Page {containersCurrentPage} of {Math.ceil(filteredContainers.length / containersPerPage)}
                </span>
                <button
                  onClick={() => setContainersCurrentPage(p => Math.min(Math.ceil(filteredContainers.length / containersPerPage), p + 1))}
                  disabled={containersCurrentPage >= Math.ceil(filteredContainers.length / containersPerPage)}
                  style={{
                    padding: '6px 12px',
                    background: containersCurrentPage >= Math.ceil(filteredContainers.length / containersPerPage) ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: containersCurrentPage >= Math.ceil(filteredContainers.length / containersPerPage) ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: containersCurrentPage >= Math.ceil(filteredContainers.length / containersPerPage) ? '#9ca3af' : '#374151'
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {route === '#/archive' && (
          <>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
              <div className="muted">
                Showing {archivedContainers ? `${Math.min((containersCurrentPage - 1) * containersPerPage + 1, archivedContainers.length)}-${Math.min(containersCurrentPage * containersPerPage, archivedContainers.length)} of ${archivedContainers.length}` : '...'} archived containers
              </div>
              <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                <span className="muted" style={{fontSize: 13}}>Per page:</span>
                {[24, 48, 96].map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      setContainersPerPage(size)
                      setContainersCurrentPage(1)
                    }}
                    style={{
                      padding: '4px 12px',
                      background: containersPerPage === size ? '#3b82f6' : 'white',
                      color: containersPerPage === size ? 'white' : '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: containersPerPage === size ? 600 : 400
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <div className="container-list">
              {loadingArchived && [...Array(6)].map((_, i) => <ContainerCardSkeleton key={i} />)}
              {!loadingArchived && archivedContainers && archivedContainers.length === 0 && <div className="muted">No archived containers</div>}
              {!loadingArchived && archivedContainers && archivedContainers.slice((containersCurrentPage - 1) * containersPerPage, containersCurrentPage * containersPerPage).map(c => (
                <ContainerCard key={c.id} id={c.id} name={c.name} type={c.type} temperature={c.temperature} layout={c.layout} occupancy={{used:c.used,total:c.total}} updatedAt={c.updated_at} location={c.location} training={c.training} archived />
              ))}
            </div>
            {!loadingArchived && archivedContainers && archivedContainers.length > containersPerPage && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                marginTop: 16
              }}>
                <button
                  onClick={() => setContainersCurrentPage(p => Math.max(1, p - 1))}
                  disabled={containersCurrentPage === 1}
                  style={{
                    padding: '6px 12px',
                    background: containersCurrentPage === 1 ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: containersCurrentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: containersCurrentPage === 1 ? '#9ca3af' : '#374151'
                  }}
                >
                  Previous
                </button>
                <span className="muted" style={{fontSize: 13}}>
                  Page {containersCurrentPage} of {Math.ceil(archivedContainers.length / containersPerPage)}
                </span>
                <button
                  onClick={() => setContainersCurrentPage(p => Math.min(Math.ceil(archivedContainers.length / containersPerPage), p + 1))}
                  disabled={containersCurrentPage >= Math.ceil(archivedContainers.length / containersPerPage)}
                  style={{
                    padding: '6px 12px',
                    background: containersCurrentPage >= Math.ceil(archivedContainers.length / containersPerPage) ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: containersCurrentPage >= Math.ceil(archivedContainers.length / containersPerPage) ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: containersCurrentPage >= Math.ceil(archivedContainers.length / containersPerPage) ? '#9ca3af' : '#374151'
                  }}
                >
                  Next
                </button>
              </div>
            )}
            
            <div style={{marginTop:32,paddingTop:24,borderTop:'1px solid #e5e7eb'}}>
              <h3 style={{fontSize:18,fontWeight:600,marginBottom:12}}>Archived Samples</h3>
              <div className="muted" style={{marginBottom:12}}>Samples marked as archived</div>
              {loadingSamples && <div className="muted">Loading archived samples...</div>}
              {!loadingSamples && samples && samples.length === 0 && (
                <div className="muted">No archived samples</div>
              )}
              {!loadingSamples && samples && samples.length > 0 && (
                <div>
                  {samples.map((s:any) => {
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
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
              <div className="muted">
                Showing {filteredSamples ? `${Math.min((currentPage - 1) * samplesPerPage + 1, filteredSamples.length)}-${Math.min(currentPage * samplesPerPage, filteredSamples.length)} of ${filteredSamples.length}` : '...'} samples
              </div>
              <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                <span className="muted" style={{fontSize: 13}}>Per page:</span>
                {[24, 48, 96].map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      setSamplesPerPage(size)
                      setCurrentPage(1)
                    }}
                    style={{
                      padding: '4px 12px',
                      background: samplesPerPage === size ? '#3b82f6' : 'white',
                      color: samplesPerPage === size ? 'white' : '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: samplesPerPage === size ? 600 : 400
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Sample Type Filters */}
            {(() => {
              const availableSampleTypes = samples ? Array.from(new Set(samples.map((s: any) => {
                // For checked out samples, use previous container type; otherwise use current container type
                return s.is_checked_out && s.previous_containers?.type
                  ? s.previous_containers.type
                  : (s.containers?.type || 'Sample Type')
              }))).filter(type => type !== 'Sample Type').sort() : []
              
              if (availableSampleTypes.length > 0) {
                return (
                  <div style={{marginTop: 12, marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb'}}>
                    <div style={{fontSize: 14, fontWeight: 600, marginBottom: 8}}>Filter by Sample Type:</div>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center'}}>
                      {availableSampleTypes.map(type => {
                        const active = sampleTypeFilters.includes(type)
                        const color = SAMPLE_TYPE_COLORS[type] || '#6b7280'
                        const inactiveBg = `${color}22`
                        const activeBg = color
                        const style = active 
                          ? { background: activeBg, color: readableTextColor(activeBg), boxShadow: `0 0 0 3px ${color}33`, border: 'none' } 
                          : { background: inactiveBg, color: color, border: 'none' }
                        
                        return (
                          <button
                            key={type}
                            onClick={() => {
                              if (active) {
                                setSampleTypeFilters(sampleTypeFilters.filter(t => t !== type))
                              } else {
                                setSampleTypeFilters([...sampleTypeFilters, type])
                              }
                              setCurrentPage(1)
                            }}
                            style={{
                              ...style,
                              padding: '6px 12px',
                              borderRadius: 9999,
                              fontSize: 14,
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              outline: 'none'
                            }}
                          >
                            {type}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              }
              return null
            })()}
            
            {loadingSamples && <div className="muted">Loading samples...</div>}
            {!loadingSamples && filteredSamples && filteredSamples.length === 0 && <div className="muted">No samples found</div>}
            {!loadingSamples && filteredSamples && filteredSamples.length > 0 && (
              <div style={{border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden'}}>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <thead style={{background: '#f3f4f6'}}>
                    <tr>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600}}>Sample ID</th>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600}}>Type</th>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600}}>Location</th>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600}}>Container</th>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600}}>Position</th>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600}}>Owner</th>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600}}>Collected</th>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSamples.slice((currentPage - 1) * samplesPerPage, currentPage * samplesPerPage).map((s: any, index: number) => {
                      const handleSampleClick = () => {
                        window.location.hash = `#/containers/${s.container_id}?highlight=${encodeURIComponent(s.position)}&returnTo=samples`
                      }
                      
                      const containerName = s.containers?.name || s.container_id || '-'
                      const containerLocation = s.containers?.location || '-'
                      // For checked out samples, use previous container type; otherwise use current container type
                      const containerType = s.is_checked_out && s.previous_containers?.type
                        ? s.previous_containers.type
                        : (s.containers?.type || 'Sample Type')
                      const typeColor = SAMPLE_TYPE_COLORS[containerType] || '#6b7280'
                      
                      return (
                        <tr 
                          key={s.id}
                          style={{
                            borderTop: index > 0 ? '1px solid #e5e7eb' : 'none',
                            background: 'white'
                          }}
                        >
                          <td style={{padding: 12, fontWeight: 600}}>{s.sample_id}</td>
                          <td style={{padding: 12}}>
                            <span style={{
                              padding: '4px 10px',
                              background: `${typeColor}22`,
                              color: typeColor,
                              borderRadius: 9999,
                              fontSize: 13,
                              fontWeight: 500
                            }}>
                              {containerType}
                            </span>
                          </td>
                          <td style={{padding: 12}}>{containerLocation}</td>
                          <td style={{padding: 12}}>{containerName}</td>
                          <td style={{padding: 12}}>
                            <span style={{
                              padding: '2px 8px',
                              background: '#dbeafe',
                              color: '#1e40af',
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600
                            }}>
                              {s.position || '-'}
                            </span>
                          </td>
                          <td style={{padding: 12}}>{s.owner || '-'}</td>
                          <td style={{padding: 12}} className="muted">{formatDate(s.collected_at)}</td>
                          <td style={{padding: 12}}>
                            {s.container_id && (
                              <button
                                className="btn ghost"
                                onClick={handleSampleClick}
                                style={{fontSize: 12, padding: '4px 8px'}}
                              >
                                View in Container
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!loadingSamples && filteredSamples && filteredSamples.length > samplesPerPage && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                marginTop: 16
              }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '6px 12px',
                    background: currentPage === 1 ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: currentPage === 1 ? '#9ca3af' : '#374151'
                  }}
                >
                  Previous
                </button>
                <span className="muted" style={{fontSize: 13}}>
                  Page {currentPage} of {Math.ceil(filteredSamples.length / samplesPerPage)}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredSamples.length / samplesPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(filteredSamples.length / samplesPerPage)}
                  style={{
                    padding: '6px 12px',
                    background: currentPage >= Math.ceil(filteredSamples.length / samplesPerPage) ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: currentPage >= Math.ceil(filteredSamples.length / samplesPerPage) ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: currentPage >= Math.ceil(filteredSamples.length / samplesPerPage) ? '#9ca3af' : '#374151'
                  }}
                >
                  Next
                </button>
              </div>
            )}
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
